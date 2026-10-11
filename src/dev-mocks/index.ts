/** Mock mode: `?mock=1` previews the app with invented data, `?mock=0` leaves
 *  it. Dev builds only, unless built with `VITE_ENABLE_MOCKS=1` (see
 *  `main.tsx`).
 *
 *  Two guarantees:
 *  - No request reaches SchoolSoft. Every `/schoolsoft/*` call is answered
 *    here; one without a route gets a 404 and a console warning instead of
 *    being forwarded. Signing in re-enters mock mode (`LoginPage`) instead
 *    of navigating to SchoolSoft.
 *  - A real session on the same origin is set aside, not used. Entering mock
 *    mode moves it to `bss_real_session` and seeds a mock one; leaving
 *    restores it. */

import { MOCK_FLAG } from "../lib/mock-mode.ts";
import { createRoutes, type MockRequest } from "./routes.ts";
import { ROBIN, SCHOOL, SCHOOL_NAME, ORG_ID } from "./people.ts";

const SESSION = "bss_session";
const CHILD = "bss_child";
const REAL_SESSION = "bss_real_session";
const REAL_CHILD = "bss_real_child";

/** A session mock mode made: the mock school, or mock tokens (a sign-in
 *  callback that completed while mock mode was on gets those from the mocked
 *  token endpoint). Anything else is a real session to keep. */
const isMockSession = (raw: string | null) => {
  if (!raw) return false;
  try {
    const s = JSON.parse(raw) as { school?: unknown; eva?: { accessToken?: unknown } };
    return (
      s.school === SCHOOL ||
      (typeof s.eva?.accessToken === "string" && s.eva.accessToken.startsWith("mock-"))
    );
  } catch {
    return false;
  }
};

export function shouldInstallMocks(): boolean {
  if (typeof window === "undefined") return false;
  const param = new URLSearchParams(window.location.search).get("mock");
  if (param === "1") {
    localStorage.setItem(MOCK_FLAG, "1");
    return true;
  }
  if (param === "0") {
    localStorage.removeItem(MOCK_FLAG);
    leaveMockSession();
    return false;
  }
  return localStorage.getItem(MOCK_FLAG) === "1";
}

function enterMockSession() {
  const current = localStorage.getItem(SESSION);
  if (isMockSession(current)) return;
  /* A real session here is the newest one (another tab may have refreshed
   * its tokens since the stash was made), so it replaces the stash. */
  if (current) {
    localStorage.setItem(REAL_SESSION, current);
    const child = localStorage.getItem(CHILD);
    if (child) localStorage.setItem(REAL_CHILD, child);
    else localStorage.removeItem(REAL_CHILD);
  }
  localStorage.setItem(
    SESSION,
    JSON.stringify({
      school: SCHOOL,
      orgId: ORG_ID,
      orgName: SCHOOL_NAME,
      name: "Alex",
      lastName: "Morgan",
      userType: "2",
      eva: {
        accessToken: "mock-access",
        refreshToken: "mock-refresh",
        expiresAt: Date.now() + 3_600_000,
      },
    }),
  );
  localStorage.setItem(CHILD, String(ROBIN));
}

function leaveMockSession() {
  const current = localStorage.getItem(SESSION);
  /* A real session signed in since takes precedence; drop the stale stash. */
  if (current && !isMockSession(current)) {
    localStorage.removeItem(REAL_SESSION);
    localStorage.removeItem(REAL_CHILD);
    return;
  }
  /* Mock session, or none after a logout in mock mode: restore the stash. */
  const real = localStorage.getItem(REAL_SESSION);
  const realChild = localStorage.getItem(REAL_CHILD);
  if (real) localStorage.setItem(SESSION, real);
  else localStorage.removeItem(SESSION);
  if (realChild) localStorage.setItem(CHILD, realChild);
  else localStorage.removeItem(CHILD);
  localStorage.removeItem(REAL_SESSION);
  localStorage.removeItem(REAL_CHILD);
}

/** Whether `url` is bound for SchoolSoft, through our proxy or directly. */
function schoolsoftPath(url: URL): string | null {
  if (url.hostname.endsWith("schoolsoft.se")) return url.pathname;
  if (url.origin === window.location.origin && url.pathname.startsWith("/schoolsoft/")) {
    return url.pathname.slice("/schoolsoft".length);
  }
  return null;
}

async function readBody(input: RequestInfo | URL, init?: RequestInit): Promise<unknown> {
  const raw =
    typeof init?.body === "string"
      ? init.body
      : input instanceof Request
        ? await input.clone().text()
        : "";
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
}

export function installMocks() {
  enterMockSession();
  const routes = createRoutes();
  const realFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const href = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(href, window.location.href);
    const upstream = schoolsoftPath(url);
    if (upstream === null) return realFetch(input, init);

    /* `/<school>/eva/...` → `/eva/...`; `/internal/rest-api/...` likewise. */
    const path = upstream.replace(/^\/[^/]+/, "");
    const method = (
      init?.method ?? (input instanceof Request ? input.method : "GET")
    ).toUpperCase();
    const req: MockRequest = {
      method,
      path,
      query: url.searchParams,
      body: await readBody(input, init),
    };
    for (const [m, pattern, handler] of routes) {
      if (m !== method) continue;
      const match = pattern.exec(path);
      if (match) return handler(match, req);
    }
    console.warn(
      `[mock] no mock for ${method} ${path}; answered 404 instead of calling SchoolSoft`,
    );
    return new Response("Not mocked", { status: 404 });
  };

  queueMicrotask(() => {
    if (document.querySelector("#bss-mock-banner")) return;
    const b = document.createElement("div");
    b.id = "bss-mock-banner";
    b.textContent = "Mock data · add ?mock=0 to leave";
    b.style.cssText =
      "position:fixed;bottom:0;left:0;right:0;background:#f59e0b;color:#1e293b;font-size:12px;font-weight:600;text-align:center;padding:4px 8px;z-index:9999;font-family:-apple-system,sans-serif";
    document.body.appendChild(b);
  });
}

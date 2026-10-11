/** PKCE helpers for the SchoolSoft OAuth flow (clientId=vApp).
 *  The SchoolSoft React SPA at /{school}/react/#/login/{usertype} reads
 *  `client_id`, `redirect_uri`, `state`, `code_challenge`, `code_challenge_method`
 *  from URL params (verified by inspecting the SPA's login chunk).
 *  After successful auth, it redirects to `redirect_uri?code=<6char>&state=<state>`.
 */

import { isSchoolSlug } from "../lib/safe-url.ts";

const USERTYPES: readonly string[] = ["parent", "student", "staff"];

const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";

function randomString(len: number): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHA[bytes[i]! % ALPHA.length];
  return out;
}

function base64urlEncode(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export interface PkcePair {
  codeVerifier: string;
  codeChallenge: string;
  state: string;
}

export async function generatePkce(): Promise<PkcePair> {
  const codeVerifier = randomString(128);
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(codeVerifier));
  const codeChallenge = base64urlEncode(hash);
  const state = randomString(24);
  return { codeVerifier, codeChallenge, state };
}

const PREFIX = "bss_pkce:";
const LEGACY_KEY = "bss_pkce";

interface StoredPkce extends PkcePair {
  school: string;
  usertype: "parent" | "student" | "staff";
  ts: number;
}

/** How long a sign-in may take between leaving for SchoolSoft and coming
 *  back (BankID included). */
const PKCE_TTL_MS = 15 * 60_000;

/* One record per sign-in, keyed by its `state`, in localStorage rather than
 * sessionStorage: an installed app can be restarted while the user switches
 * to BankID, which empties sessionStorage. Keying by state keeps two tabs'
 * sign-ins apart, and a callback whose state has no record is refused.
 * Records expire and are removed on use, on failure and on logout. */
function prune(now = Date.now()): void {
  localStorage.removeItem(LEGACY_KEY);
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (!key?.startsWith(PREFIX)) continue;
    try {
      const p = JSON.parse(localStorage.getItem(key) ?? "") as StoredPkce;
      if (now - p.ts < PKCE_TTL_MS) continue;
    } catch {
      /* unreadable: drop it */
    }
    localStorage.removeItem(key);
  }
}

export function savePkce(p: StoredPkce): void {
  prune();
  localStorage.setItem(PREFIX + p.state, JSON.stringify(p));
}

/** The record for the sign-in that `state` belongs to, if it is still valid. */
export function loadPkce(state: string | null): StoredPkce | null {
  prune();
  if (!state) return null;
  const raw = localStorage.getItem(PREFIX + state);
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as StoredPkce;
    return p.state === state ? p : null;
  } catch {
    return null;
  }
}

/** Drop one sign-in's record. Without a state there is nothing to drop:
 *  a callback missing its state must not touch other sign-ins in flight. */
export function clearPkce(state: string | null): void {
  if (state) localStorage.removeItem(PREFIX + state);
}

/** Drop every sign-in record (logout). */
export function clearAllPkce(): void {
  localStorage.removeItem(LEGACY_KEY);
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (key?.startsWith(PREFIX)) localStorage.removeItem(key);
  }
}

/** Build the SchoolSoft React-SPA authorize URL.
 *
 * The SPA uses a HashRouter; it reads `client_id`/`redirect_uri`/`state`/`code_challenge` from
 * `useLocation().search` which corresponds to the query string AFTER the `#`, not before.
 * The login chunk constructs URLs as `#/login/{usertype}?state=…&client_id=…` — we mirror that.
 */
export function buildAuthorizeUrl(args: {
  school: string;
  usertype: "parent" | "student" | "staff";
  redirectUri: string;
  pkce: PkcePair;
}): string {
  /* Both values come from form controls and land in the URL path, so re-check them here at the
   * sink rather than trusting the caller's types — a tampered <select> can submit anything. */
  if (!isSchoolSlug(args.school)) throw new Error("Invalid school identifier");
  if (!USERTYPES.includes(args.usertype)) throw new Error("Invalid user type");
  const qs = new URLSearchParams({
    state: args.pkce.state,
    client_id: "vApp",
    redirect_uri: args.redirectUri,
    code_challenge: args.pkce.codeChallenge,
    code_challenge_method: "S256",
  });
  return `https://sms.schoolsoft.se/${args.school}/react/#/login/${args.usertype}?${qs.toString()}`;
}

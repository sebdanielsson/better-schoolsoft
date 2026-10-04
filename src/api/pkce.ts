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

const STORAGE_KEY = "bss_pkce";

interface StoredPkce extends PkcePair {
  school: string;
  usertype: "parent" | "student" | "staff";
  ts: number;
}

export function savePkce(p: StoredPkce): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}

export function loadPkce(): StoredPkce | null {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredPkce;
  } catch {
    return null;
  }
}

export function clearPkce(): void {
  sessionStorage.removeItem(STORAGE_KEY);
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

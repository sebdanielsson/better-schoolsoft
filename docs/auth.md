# Authentication and transports

How the app signs in and how it talks to SchoolSoft. Endpoint details live in [eva-api.md](eva-api.md).

## Sign-in

Sign-in mirrors the official "Vårdnadshavare" app's OAuth flow (`clientId=vApp`, PKCE, S256):

1. `LoginPage` sends the browser to SchoolSoft's own login SPA at `https://sms.schoolsoft.se/{school}/react/#/login/{usertype}?client_id=vApp&redirect_uri=…&state=…&code_challenge=…`. The PKCE verifier, state, school and user type wait in `sessionStorage` (`src/api/pkce.ts`).
2. SchoolSoft redirects back to `/oauth/callback?code=…&state=…`. `OAuthCallbackPage` checks the state and exchanges the code at `POST /{school}/rest-api/login/token` for a short-lived access token and a refresh token.
3. The callback reads `/eva/api/v1/parent` for the guardian's name, children and schools, and stores the session in `localStorage` under `bss_session`.

Only guardian accounts can complete step 3 today; see #66.

## Two transports

SchoolSoft exposes the data the app needs through two APIs with different authentication. Both are reached through the `/schoolsoft/*` proxy (below), never cross-origin.

| Transport      | Paths                                                    | Auth                                   | Used for                                                                                                                     |
| -------------- | -------------------------------------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Eva bearer     | `/{school}/eva/api/v1…`, `v2…`                           | `Authorization: Bearer {access_token}` | Everything the iOS app shows: lessons tiles, lunch, news, messages, bookings, absence, staff, profile                        |
| Cookie session | `/{school}/rest-api/parent/…`, `/{school}/jsp/student/…` | `JSESSIONID` + hash cookies            | What the iOS app shows in a webview: week schedule, subject rooms, assignments, plannings, assessments, library, school info |

**Rule:** use Eva when an Eva endpoint exists. Use the cookie session only for data Eva doesn't expose; those are the screens the official app renders as a webview.

### Eva bearer

`useAuth().getEvaToken()` returns a valid access token, refreshing it 30 s before expiry with `grant_type=refresh_token` at the same token endpoint. Concurrent refreshes share one request.

### Cookie session

The cookie session is minted from an Eva token: `GET /{school}/eva-apps/auth/login/parent` with headers `token`, `userId`, `orgId` and `childInFocus` answers with `Set-Cookie`. This is what the iOS app does before opening a webview.

The session has exactly one child in focus server-side, so `src/api/schoolsoft.ts` tracks which `(school, guardian, org, child)` the cookies were minted for (`sessionFocus`):

- `bootstrapSchoolsoftSession` / `acquireCookieFocus` re-mint only when the focus changes, and serialize re-mints so the last one started is the last one applied.
- `useSchoolsoftContext().withCookies` rejects a response if the focus changed mid-request, so one child's data is never cached under a sibling's keys.
- Upstream drops idle sessions and answers 401. `cookieFetch` then re-mints the same focus with the newest Eva token and retries once; concurrent 401s share one renewal.

Two ways to call a cookie endpoint safely:

- **Cached reads** (anything stored in the query cache under child-scoped keys) must go through `useSchoolsoftContext().withCookies`, so a response served for a sibling is rejected rather than cached.
- **Effect-local reads** may call `bootstrapSchoolsoftSession` and the endpoint directly (as `HomePage`, `SchedulePage` and `WeekCard` do), provided the effect depends on the child, ignores results once cleaned up (a `cancelled` flag), and tags any state it keeps with the child so a sibling's data is never rendered. A child switch re-runs the effect, whose own bootstrap is serialized after the old one.

### Removed: legacy app token

Earlier versions also used the app-key API (`/rest/app/token`, `/api/lessons`, `/api/notices`, `/api/lunchmenus`). It needs an `appKey` from the password login (`logintype 4`), which OAuth sessions never get, so every call returned 401. It was removed in #67.

## The `/schoolsoft` proxy

`vercel.json` rewrites `/schoolsoft/*` to the `api/schoolsoft.ts` function; in dev, `vite.config.ts` proxies the same prefix. Both use `api/_lib/proxy-rewrites.ts` to:

- re-scope upstream `Set-Cookie` paths under `/schoolsoft/` and drop `Domain`, so cookies land on our origin;
- keep upstream redirects on our origin;
- add `Content-Security-Policy: sandbox` and `nosniff` to every response.

The production function and the dev proxy also refuse (#72):

- requests a browser marks as cross-site (`Sec-Fetch-Site`, falling back to `Origin`; production only);
- anything outside the API namespaces the SPA calls. `eva/api/` and `rest-api/` accept GET, HEAD, POST, PUT and DELETE; `eva-apps/auth/`, `jsp/student/` and `files/` are read-only (GET, HEAD).

This is a namespace allowlist, not a route list: the relay only acts with the caller's own cookies or token, so enumerating routes would add upkeep without separating privileges. A new endpoint in a new namespace needs an entry in `api/_lib/proxy-rewrites.ts`; the dev proxy enforces the same rules, so a miss shows up in `pnpm dev`.

A Vercel Firewall rule rate-limits `/schoolsoft/*` per IP; it lives in the project's firewall settings, not in this repo.

## Logout

SchoolSoft has no logout or token-revocation endpoint. The official iOS app's logout is local-only: it clears its stored tokens and never calls the server. This app does the same and additionally calls the proxy-local `POST /schoolsoft/{school}/__logout`, which expires the HttpOnly cookies the proxy planted on our origin (JS can't clear them).

Consequences:

- The refresh token stays valid upstream until SchoolSoft expires it.
- The upstream cookie session ends on its own idle timeout.

Moving tokens out of `localStorage` is tracked in #179.

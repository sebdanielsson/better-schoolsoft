// oxlint-disable typescript/no-floating-promises -- node:test `test()` returns a
// promise the runner owns; awaiting it at the call site would serialize the suite.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LOGOUT_PATH,
  isAllowedUpstreamPath,
  logoutCookies,
  isSameOriginRequest,
  rewriteCookiePath,
  rewriteLocation,
  upstreamUrlFor,
} from "./proxy-rewrites.ts";

test("re-scopes the upstream cookie path under /schoolsoft", () => {
  assert.equal(
    rewriteCookiePath("JSESSIONID=abc; Path=/mock-school; HttpOnly"),
    "JSESSIONID=abc; Path=/schoolsoft/mock-school; HttpOnly",
  );
});

test("handles a root path", () => {
  assert.equal(rewriteCookiePath("a=b; Path=/"), "a=b; Path=/schoolsoft/");
});

test("is case-insensitive on the attribute name", () => {
  assert.equal(rewriteCookiePath("a=b; path=/x"), "a=b; path=/schoolsoft/x");
});

/* Upstream scopes cookies to its own domain, which never matches the SPA's
 * origin — the browser would reject the cookie outright. Dropping the attribute
 * makes it host-only on our origin instead. */
test("drops the Domain attribute", () => {
  assert.equal(
    rewriteCookiePath("a=b; Domain=sms.schoolsoft.se; Path=/x; Secure"),
    "a=b; Path=/schoolsoft/x; Secure",
  );
});

test("leaves other attributes alone", () => {
  assert.equal(
    rewriteCookiePath("a=b; Path=/x; Secure; SameSite=None; HttpOnly"),
    "a=b; Path=/schoolsoft/x; Secure; SameSite=None; HttpOnly",
  );
});

test("leaves a cookie without a Path untouched", () => {
  /* No Path attribute means the browser defaults to the request's directory,
   * which is already under /schoolsoft. */
  assert.equal(rewriteCookiePath("a=b; HttpOnly"), "a=b; HttpOnly");
});

test("moves absolute upstream redirects under /schoolsoft", () => {
  assert.equal(
    rewriteLocation("https://sms.schoolsoft.se/files/x/tmp_file_1.tmp?md5=a&expires=1"),
    "/schoolsoft/files/x/tmp_file_1.tmp?md5=a&expires=1",
  );
  assert.equal(rewriteLocation("https://sms.schoolsoft.se"), "/schoolsoft/");
  assert.equal(
    rewriteLocation("http://sms.schoolsoft.se/school/eva-apps/auth/null?error=other"),
    "/schoolsoft/school/eva-apps/auth/null?error=other",
  );
});

test("moves root-relative redirects under /schoolsoft once", () => {
  assert.equal(
    rewriteLocation("/mock-school/jsp/Login.jsp"),
    "/schoolsoft/mock-school/jsp/Login.jsp",
  );
  assert.equal(rewriteLocation("/schoolsoft/mock-school/x"), "/schoolsoft/mock-school/x");
});

test("leaves other hosts and relative paths alone", () => {
  assert.equal(rewriteLocation("https://example.com/a"), "https://example.com/a");
  /* Look-alike host must not be treated as upstream. */
  assert.equal(
    rewriteLocation("https://sms.schoolsoft.se.evil.example/a"),
    "https://sms.schoolsoft.se.evil.example/a",
  );
  assert.equal(rewriteLocation("//evil.example/a"), "//evil.example/a");
  assert.equal(rewriteLocation("right_student_app_blocked.jsp"), "right_student_app_blocked.jsp");
});

test("upstreamUrlFor reads the rewritten path parameter and drops it", () => {
  assert.equal(
    upstreamUrlFor("https://app.example/api/schoolsoft?__proxy_path=school/rest-api/x&week=40"),
    "https://sms.schoolsoft.se/school/rest-api/x?week=40",
  );
});

test("upstreamUrlFor also accepts the /schoolsoft/... shape", () => {
  assert.equal(
    upstreamUrlFor("https://app.example/schoolsoft/school/jsp/a.jsp?requestid=1"),
    "https://sms.schoolsoft.se/school/jsp/a.jsp?requestid=1",
  );
  assert.equal(upstreamUrlFor("https://app.example/schoolsoft"), "https://sms.schoolsoft.se/");
});

test("upstreamUrlFor never leaves the upstream origin", () => {
  for (const p of [
    "@evil.example/x",
    "//evil.example/x",
    "/\\evil.example/x",
    "%2F%2Fevil.example",
  ]) {
    const out = upstreamUrlFor(
      `https://app.example/api/schoolsoft?__proxy_path=${encodeURIComponent(p)}`,
    );
    assert.ok(
      out === null || new URL(out).origin === "https://sms.schoolsoft.se",
      `${p} -> ${out}`,
    );
  }
});

test("upstreamUrlFor returns null instead of throwing on unparseable paths", () => {
  for (const p of ["%5C%5B", "%5C%5C%5B", "%5C%5Cx%3A99999"]) {
    assert.doesNotThrow(() =>
      upstreamUrlFor(`https://app.example/api/schoolsoft?__proxy_path=${p}`),
    );
  }
  assert.equal(upstreamUrlFor("https://app.example/api/schoolsoft?__proxy_path=%5C%5B"), null);
});

const UP = "https://sms.schoolsoft.se";

test("isAllowedUpstreamPath accepts every path shape the SPA calls", () => {
  for (const p of [
    "/internal/rest-api/login/schoollist",
    "/engelska/eva/api/v1/parent",
    "/engelska/eva/api/v2/parent/1/schools/2/news?studentId=3",
    "/engelska/eva-apps/auth/login/parent",
    "/engelska/rest-api/login/token?grant_type=refresh_token",
    "/engelska/rest-api/parent/calendar/lessons/week/40",
    "/engelska/jsp/student/right_student_library_download.jsp?requestid=1",
    "/files/abc/report.pdf",
  ]) {
    assert.ok(isAllowedUpstreamPath(UP + p), p);
  }
});

test("isAllowedUpstreamPath refuses everything else", () => {
  for (const p of [
    "/",
    "/engelska",
    "/engelska/react/",
    "/engelska/jsp/admin/start.jsp",
    "/engelska/rest/app/token",
    "/engelska/api/lessons/student/1",
    "/Engelska/eva/api/v1/parent",
  ]) {
    assert.ok(!isAllowedUpstreamPath(UP + p), p);
  }
});

test("isAllowedUpstreamPath sees the normalised path, so dot segments can't escape", () => {
  for (const p of ["engelska/eva/api/../../react/", "engelska/eva/api/%2e%2e/%2e%2e/react/"]) {
    const out = upstreamUrlFor(
      `https://app.example/api/schoolsoft?__proxy_path=${encodeURIComponent(p)}`,
    );
    assert.ok(out !== null && !isAllowedUpstreamPath(out), `${p} -> ${out}`);
  }
});

test("isSameOriginRequest trusts Fetch Metadata first", () => {
  const url = "https://app.example/api/schoolsoft";
  assert.ok(isSameOriginRequest(new Headers({ "sec-fetch-site": "same-origin" }), url));
  for (const site of ["cross-site", "same-site", "none"]) {
    assert.ok(!isSameOriginRequest(new Headers({ "sec-fetch-site": site }), url), site);
  }
  /* A matching Origin can't override a cross-site Fetch Metadata verdict. */
  assert.ok(
    !isSameOriginRequest(
      new Headers({ "sec-fetch-site": "cross-site", origin: "https://app.example" }),
      url,
    ),
  );
});

test("isSameOriginRequest falls back to Origin, then lets header-less clients through", () => {
  const url = "https://app.example/api/schoolsoft";
  assert.ok(isSameOriginRequest(new Headers({ origin: "https://app.example" }), url));
  assert.ok(!isSameOriginRequest(new Headers({ origin: "https://evil.example" }), url));
  assert.ok(isSameOriginRequest(new Headers(), url));
});

test("LOGOUT_PATH matches only the school-scoped logout route", () => {
  assert.equal(LOGOUT_PATH.exec("/engelska/__logout")?.[1], "engelska");
  assert.equal(LOGOUT_PATH.exec("/engelska/eva/__logout"), null);
  assert.equal(LOGOUT_PATH.exec("/__logout"), null);
});

test("logoutCookies expires each sent cookie on both upstream path shapes", () => {
  assert.deepEqual(logoutCookies("JSESSIONID=abc; hash=x=y", "engelska"), [
    "JSESSIONID=; Path=/schoolsoft/engelska; Max-Age=0; Secure; HttpOnly; SameSite=Lax",
    "JSESSIONID=; Path=/schoolsoft/engelska/; Max-Age=0; Secure; HttpOnly; SameSite=Lax",
    "JSESSIONID=; Path=/schoolsoft/; Max-Age=0; Secure; HttpOnly; SameSite=Lax",
    "hash=; Path=/schoolsoft/engelska; Max-Age=0; Secure; HttpOnly; SameSite=Lax",
    "hash=; Path=/schoolsoft/engelska/; Max-Age=0; Secure; HttpOnly; SameSite=Lax",
    "hash=; Path=/schoolsoft/; Max-Age=0; Secure; HttpOnly; SameSite=Lax",
  ]);
});

test("logoutCookies ignores a missing header and malformed names", () => {
  assert.deepEqual(logoutCookies(null, "s"), []);
  assert.deepEqual(logoutCookies("a b=1; =2; c\r\nd=3", "s"), []);
});

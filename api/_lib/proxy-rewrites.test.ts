// oxlint-disable typescript/no-floating-promises -- node:test `test()` returns a
// promise the runner owns; awaiting it at the call site would serialize the suite.
import { test } from "node:test";
import assert from "node:assert/strict";
import { rewriteCookiePath, rewriteLocation, upstreamUrlFor } from "./proxy-rewrites.ts";

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

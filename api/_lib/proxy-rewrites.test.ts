// oxlint-disable typescript/no-floating-promises -- node:test `test()` returns a
// promise the runner owns; awaiting it at the call site would serialize the suite.
import { test } from "node:test";
import assert from "node:assert/strict";
import { rewriteCookiePath, rewriteLocation } from "./proxy-rewrites.ts";

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

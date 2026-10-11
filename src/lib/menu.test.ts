// oxlint-disable typescript/no-floating-promises -- node:test `test()` returns a
// promise the runner owns; awaiting it at the call site would serialize the suite.
import { test } from "node:test";
import assert from "node:assert/strict";
import { featureForPath, hasFeature, menuFromResponse, pathAllowed } from "./menu.ts";

test("menuFromResponse keeps the type strings and ignores junk", () => {
  const menu = menuFromResponse([
    { type: "SCHEDULE" },
    { type: "BOOKINGS" },
    { type: 3 },
    null,
    "NEWS",
    {},
  ]);
  assert.deepEqual([...menu].sort(), ["BOOKINGS", "SCHEDULE"]);
  assert.equal(menuFromResponse(null).size, 0);
  assert.equal(menuFromResponse({ type: "NEWS" }).size, 0);
});

test("an unknown menu shows everything", () => {
  assert.equal(hasFeature(null, "BOOKINGS"), true);
  assert.equal(pathAllowed(null, "/bookings/12"), true);
});

test("a known menu gates its sections", () => {
  const menu = new Set(["SCHEDULE", "NEWS"]);
  assert.equal(hasFeature(menu, "SCHEDULE"), true);
  assert.equal(hasFeature(menu, "BOOKINGS"), false);
  assert.equal(pathAllowed(menu, "/calendar"), true);
  assert.equal(pathAllowed(menu, "/bookings"), false);
  assert.equal(pathAllowed(menu, "/bookings/12"), false);
  assert.equal(pathAllowed(menu, "/plannings/1/2"), false);
});

test("ungated routes are always allowed", () => {
  const menu = new Set<string>();
  for (const path of ["/", "/messages", "/school", "/profile"]) {
    assert.equal(featureForPath(path), null, path);
    assert.equal(pathAllowed(menu, path), true, path);
  }
});

test("route prefixes match whole segments", () => {
  assert.equal(featureForPath("/newsletter"), null);
  assert.equal(featureForPath("/news"), "NEWS");
  assert.equal(featureForPath("/subjects/123"), "SUBJECT_ROOMS");
});

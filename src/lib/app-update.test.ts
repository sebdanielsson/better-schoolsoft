/* node:test's `test()` returns a promise the runner owns, so every call below is
 * prefixed with `void`: awaiting them at the call site would serialize the suite. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { MIN_INTERVAL_MS, createUpdateChecker } from "./app-update.ts";

function setup(deployed: () => Promise<string | null>) {
  let t = 0;
  let fetches = 0;
  const checker = createUpdateChecker({
    current: "v1",
    fetchVersion: () => {
      fetches++;
      return deployed();
    },
    now: () => t,
  });
  return {
    checker,
    fetches: () => fetches,
    advance: (ms: number) => {
      t += ms;
    },
  };
}

void test("reports nothing while the deployed version matches", async () => {
  const { checker } = setup(() => Promise.resolve("v1"));
  await checker.check();
  assert.equal(checker.available(), false);
});

void test("reports a different deployed version and notifies once", async () => {
  const { checker, advance, fetches } = setup(() => Promise.resolve("v2"));
  let notified = 0;
  checker.subscribe(() => notified++);
  await checker.check();
  assert.equal(checker.available(), true);
  advance(MIN_INTERVAL_MS);
  await checker.check();
  assert.equal(notified, 1);
  assert.equal(fetches(), 1, "stops checking once an update is found");
});

void test("skips checks closer together than the minimum interval", async () => {
  const { checker, advance, fetches } = setup(() => Promise.resolve("v1"));
  await checker.check();
  await checker.check();
  assert.equal(fetches(), 1);
  advance(MIN_INTERVAL_MS);
  await checker.check();
  assert.equal(fetches(), 2);
});

void test("treats a failed or empty fetch as no news", async () => {
  const failing = setup(() => Promise.reject(new TypeError("offline")));
  await failing.checker.check();
  assert.equal(failing.checker.available(), false);
  const empty = setup(() => Promise.resolve(null));
  await empty.checker.check();
  assert.equal(empty.checker.available(), false);
});

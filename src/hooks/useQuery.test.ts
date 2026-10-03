/* node:test's `test()` returns a promise the runner owns, so every call below is
 * prefixed with `void`: awaiting them at the call site would serialize the suite. */
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { clearQueryCache, invalidateQueries } from "../lib/query-cache.ts";
import { useQuery, type QueryResult } from "./useQuery.ts";

before(() => {
  const { window } = new JSDOM("<!doctype html><div id=root></div>");
  Object.assign(globalThis, { window, document: window.document, IS_REACT_ACT_ENVIRONMENT: true });
});

void test("a query whose first fetch is abandoned by invalidation refetches instead of hanging", async () => {
  clearQueryCache();
  let calls = 0;
  const resolvers: Array<(v: string) => void> = [];
  const fn = () => {
    calls++;
    return new Promise<string>((r) => resolvers.push(r));
  };
  let latest: QueryResult<string> | undefined;
  function Probe() {
    latest = useQuery("q", fn);
    return null;
  }
  const root = createRoot(document.getElementById("root")!);
  await act(async () => {
    root.render(createElement(Probe));
  });
  assert.equal(calls, 1);
  assert.equal(latest?.loading, true);

  /* Invalidate while the very first fetch is still in flight. */
  await act(async () => {
    invalidateQueries("q");
  });
  assert.equal(calls, 2, "invalidation should trigger a fresh fetch");

  await act(async () => {
    resolvers[0]!("stale");
    resolvers[1]!("fresh");
  });
  assert.equal(latest?.loading, false);
  assert.equal(latest?.data, "fresh");
  await act(async () => root.unmount());
});

void test("an errored query does not retry in a loop", async () => {
  clearQueryCache();
  let calls = 0;
  const fn = () => {
    calls++;
    return Promise.reject(new Error("boom"));
  };
  let latest: QueryResult<string> | undefined;
  function Probe() {
    latest = useQuery("e", fn);
    return null;
  }
  const root = createRoot(document.getElementById("root")!);
  await act(async () => {
    root.render(createElement(Probe));
  });
  await act(async () => {
    await new Promise((r) => setTimeout(r, 20));
  });
  assert.equal(latest?.error?.message, "boom");
  assert.ok(calls <= 2, `retried ${calls} times`);
  await act(async () => root.unmount());
});

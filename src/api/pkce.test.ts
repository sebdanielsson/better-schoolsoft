// oxlint-disable typescript/no-floating-promises -- node:test `test()` returns a
// promise the runner owns; awaiting it at the call site would serialize the suite.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { clearPkce, loadPkce, savePkce } from "./pkce.ts";

/* A Map-backed localStorage, enough for pkce.ts. */
const store = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  get length() {
    return store.size;
  },
  key: (i: number) => [...store.keys()][i] ?? null,
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

const record = (state: string, ts = Date.now()) => ({
  codeVerifier: `verifier-${state}`,
  codeChallenge: `challenge-${state}`,
  state,
  school: "exampleschool",
  usertype: "parent" as const,
  ts,
});

beforeEach(() => store.clear());

test("each sign-in is found by its own state", () => {
  savePkce(record("a"));
  savePkce(record("b"));
  assert.equal(loadPkce("a")?.codeVerifier, "verifier-a");
  assert.equal(loadPkce("b")?.codeVerifier, "verifier-b");
  assert.equal(loadPkce("c"), null);
  assert.equal(loadPkce(null), null);
});

test("expired records are refused and pruned", () => {
  savePkce(record("old", Date.now() - 16 * 60_000));
  assert.equal(loadPkce("old"), null);
  assert.equal(store.size, 0);
});

test("clearing one state keeps the others; clearing all removes every record", () => {
  savePkce(record("a"));
  savePkce(record("b"));
  store.set("bss_pkce", "legacy");
  store.set("unrelated", "keep");
  clearPkce("a");
  assert.equal(loadPkce("a"), null);
  assert.ok(loadPkce("b"));
  clearPkce();
  assert.deepEqual([...store.keys()], ["unrelated"]);
});

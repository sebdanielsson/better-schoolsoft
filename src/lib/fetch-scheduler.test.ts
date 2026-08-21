/* node:test's `test()` returns a promise the runner owns, so every call below is
 * prefixed with `void`: awaiting them at the call site would serialize the suite. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { schedule } from "./fetch-scheduler.ts";

const MAX_CONCURRENT = 6;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

void test("runs tasks and resolves with their value", async () => {
  assert.equal(await schedule("high", () => Promise.resolve(42)), 42);
});

void test("propagates rejections to the caller", async () => {
  await assert.rejects(() => schedule("high", () => Promise.reject(new Error("boom"))), /boom/);
});

void test("caps concurrency", async () => {
  let running = 0;
  let peak = 0;
  const gate = deferred<void>();

  const tasks = Array.from({ length: MAX_CONCURRENT + 4 }, () =>
    schedule("high", async () => {
      running++;
      peak = Math.max(peak, running);
      await gate.promise;
      running--;
    }),
  );

  /* Let the queue drain as far as it will before anything completes. */
  await new Promise((r) => setImmediate(r));
  assert.equal(peak, MAX_CONCURRENT);

  gate.resolve();
  await Promise.all(tasks);
});

void test("drains high priority before low", async () => {
  const order: string[] = [];
  const gate = deferred<void>();

  /* Fill every slot so the next tasks have to queue. */
  const blockers = Array.from({ length: MAX_CONCURRENT }, () =>
    schedule("high", () => gate.promise),
  );
  const low = schedule("low", () => {
    order.push("low");
    return Promise.resolve();
  });
  const high = schedule("high", () => {
    order.push("high");
    return Promise.resolve();
  });

  gate.resolve();
  await Promise.all([...blockers, low, high]);
  assert.deepEqual(order, ["high", "low"]);
});

/* Regression: a task that threw before its first await skipped the `.finally`
 * that releases the slot. Six of those permanently deadlocked the queue, so
 * every later scheduled fetch — avatars, staff details — hung forever. */
void test("releases the slot when a task throws synchronously", async () => {
  for (let i = 0; i < MAX_CONCURRENT + 2; i++) {
    await assert.rejects(
      () =>
        schedule("high", (): Promise<never> => {
          throw new Error("sync boom");
        }),
      /sync boom/,
    );
  }

  /* The queue must still accept work. Without the fix this never settles. */
  const after = await Promise.race([
    schedule("high", () => Promise.resolve("alive")),
    new Promise<string>((_, reject) =>
      setTimeout(() => {
        reject(new Error("scheduler deadlocked"));
      }, 1000),
    ),
  ]);
  assert.equal(after, "alive");
});

void test("normalizes a non-Error synchronous throw", async () => {
  await assert.rejects(
    () =>
      schedule("high", (): Promise<never> => {
        throw "just a string";
      }),
    (err: unknown) => err instanceof Error && err.message === "just a string",
  );
});

/* node:test's `test()` returns a promise the runner owns, so every call below is
 * prefixed with `void`: awaiting them at the call site would serialize the suite. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { isSelectable, sameSlot, sortBookings, studentSlot, toDate } from "./bookings.ts";
import type { TimebookingDetail, TimebookingSummary, TimebookingTime } from "../api/schoolsoft.ts";

void test("toDate accepts millis, ISO and SchoolSoft local strings", () => {
  assert.equal(toDate(0)?.getTime(), 0);
  assert.equal(toDate("2026-10-13T08:00:00Z")?.toISOString(), "2026-10-13T08:00:00.000Z");
  assert.equal(toDate("2026-10-13 08:15")?.getHours(), 8);
  assert.equal(toDate(""), null);
  assert.equal(toDate(null), null);
  assert.equal(toDate("garbage"), null);
});

const summary = (
  id: number,
  status: string,
  first?: string,
  booked?: string,
): TimebookingSummary => ({
  timebookingId: id,
  name: `b${id}`,
  status,
  isRead: true,
  firstTimebookingTime: first ?? null,
  studentBookedDate: booked ?? null,
});

void test("sortBookings puts actionable first, then booked by date", () => {
  const sorted = sortBookings([
    summary(1, "NOT_AVAILABLE"),
    summary(2, "BOOKED", undefined, "2026-11-02 10:00"),
    summary(3, "AVAILABLE", "2026-10-20 08:00"),
    summary(4, "NEEDS_CONFIRMATION"),
    summary(5, "BOOKED", undefined, "2026-10-21 10:00"),
    summary(6, "SOMETHING_NEW"),
  ]);
  assert.deepEqual(
    sorted.map((b) => b.timebookingId),
    [4, 3, 5, 2, 1, 6],
  );
});

const slot = (seq: number, extra: Partial<TimebookingTime> = {}): TimebookingTime => ({
  timebookingTimeKey: { timebookingid: 9, sequence: seq },
  startTime: "2026-10-20 08:00",
  endTime: "2026-10-20 08:20",
  ...extra,
});

const detail = (extra: Partial<TimebookingDetail> = {}): TimebookingDetail => ({
  timebookingId: 9,
  name: "SPM",
  status: "AVAILABLE",
  isRead: true,
  bookable: true,
  timebookingDates: [
    {
      date: "2026-10-20",
      timebookingTimes: [slot(1, { booked: true }), slot(2), slot(3, { bookedByStudent: true })],
    },
  ],
  ...extra,
});

void test("studentSlot finds the slot held by the student", () => {
  assert.equal(studentSlot(detail())?.timebookingTimeKey.sequence, 3);
  assert.equal(studentSlot(detail({ timebookingDates: [] })), undefined);
});

void test("sameSlot compares keys", () => {
  assert.equal(sameSlot(slot(2), slot(2)), true);
  assert.equal(sameSlot(slot(2), slot(3)), false);
  assert.equal(sameSlot(undefined, slot(3)), false);
});

void test("isSelectable only allows free slots on open, guardian-bookable bookings", () => {
  const d = detail();
  assert.equal(isSelectable(d, slot(2)), true);
  assert.equal(isSelectable(d, slot(1, { booked: true })), false);
  assert.equal(isSelectable(detail({ onlyStudent: true }), slot(2)), false);
  assert.equal(isSelectable(detail({ bookable: false }), slot(2)), false);
  assert.equal(isSelectable(detail({ status: "BOOKED" }), slot(2)), false);
});

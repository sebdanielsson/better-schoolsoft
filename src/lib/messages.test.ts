/* node:test's `test()` returns a promise the runner owns, so every call below is
 * prefixed with `void`: awaiting them at the call site would serialize the suite. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildReplyBody, filterMessages, safeDownloadName, senderName } from "./messages.ts";
import type { EvaMessageDetail, EvaMessageInbox } from "../api/schoolsoft.ts";

const sender = { id: 7, firstName: "Åsa", lastName: "Lärare", picture: "" };

void test("senderName handles the system sender and blanks", () => {
  assert.equal(senderName({ id: -1, firstName: "", lastName: "", picture: "" }), "SchoolSoft");
  assert.equal(senderName(sender), "Åsa Lärare");
  assert.equal(senderName({ id: 1, firstName: "", lastName: "", picture: "" }), "Unknown");
});

void test("filterMessages folds case and accents", () => {
  const rows: EvaMessageInbox[] = [
    {
      id: 1,
      subject: "Inställd lektion",
      message: "",
      isRead: true,
      sender,
      date: "",
      hasFiles: false,
    },
    {
      id: 2,
      subject: "Utflykt",
      message: "Ta med matsäck",
      isRead: true,
      sender,
      date: "",
      hasFiles: false,
    },
  ];
  assert.deepEqual(
    filterMessages(rows, "installd").map((m) => m.id),
    [1],
  );
  assert.deepEqual(
    filterMessages(rows, "MATSÄCK").map((m) => m.id),
    [2],
  );
  assert.deepEqual(
    filterMessages(rows, "asa").map((m) => m.id),
    [1, 2],
  );
  assert.equal(filterMessages(rows, "  ").length, 2);
});

void test("buildReplyBody quotes the original like the official app", () => {
  const original = {
    id: 1,
    subject: "Utflykt",
    message: "Ta med matsäck",
    sender,
    replyTo: true,
    isRead: true,
    date: "",
    recipients: [],
    attachments: [],
    sentByUser: false,
  } satisfies EvaMessageDetail;
  const body = buildReplyBody("Tack!", original, "2026-10-01 08:00");
  assert.ok(body.startsWith("Tack!\r\n\r\nFrån: Åsa Lärare"));
  assert.match(body, /Rubrik: Utflykt/);
  assert.ok(body.endsWith("Ta med matsäck"));
});

void test("safeDownloadName strips separators and control characters", () => {
  assert.equal(safeDownloadName("../../etc/passwd"), "_.._etc_passwd");
  assert.equal(safeDownloadName("a\u0000b.pdf"), "a_b.pdf");
  assert.equal(safeDownloadName(""), "attachment");
  assert.equal(safeDownloadName("Schema v41.pdf"), "Schema v41.pdf");
});

// oxlint-disable typescript/no-floating-promises -- node:test `test()` returns a
// promise the runner owns; awaiting it at the call site would serialize the suite.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { Window } from "happy-dom";
import { decodeLegacyBody, parseLibrary, parseSchoolInfo } from "./legacy-pages.ts";

before(() => {
  const window = new Window();
  (globalThis as { DOMParser?: unknown }).DOMParser = window.DOMParser;
});

/* Trimmed from right_student_library.jsp. */
const LIBRARY = `
<div class="h2_container" id="library_con"><div class="h2_box"><div class=" h2 ">Generella</div></div>
<div id="library_con_content" class="h2_innerno_pad">
  <div class="h3_bold">Utan kategori</div>
  <table class="table"><tr><td>
    <a href="https://www.example-kommun.se/skadeanmalan/" target="_blank"><img src="x.png" alt="" />&nbsp;Accident form</a>
    <div>Blankett för skadeanmälan.</div>
  </td></tr><tr><td>
    <a href="javascript:alert(1)">Evil link</a>
  </td></tr><tr><td>
    <div class="heading_bold">Locker Policy</div><div>Please find locker policy of school.</div>
    <a href="right_student_library_download.jsp?requestid=16414" title = "Locker Policy.pdf"><img alt="" src="pdf.png"/>Locker P...pdf</a> (60&nbsp;KB)<br />
  </td></tr><tr><td>
    <div class="heading_bold">Broken</div>
    <a href="right_student_library_download.jsp?requestid=abc" title="x.pdf">x</a>
  </td></tr></table>
  <div class="h3_bold">Policies</div>
  <table class="table"><tr><td>
    <a href="https://example.com/privacy" target="_blank">Privacy</a>
  </td></tr></table>
</div></div>`;

void test("parseLibrary reads categories, links and files", () => {
  const cats = parseLibrary(LIBRARY);
  assert.equal(cats.length, 2);
  assert.equal(cats[0]?.section, "Generella");
  assert.equal(cats[0]?.category, "Utan kategori");
  assert.deepEqual(cats[0]?.items, [
    {
      kind: "link",
      title: "Accident form",
      description: "Blankett för skadeanmälan.",
      href: "https://www.example-kommun.se/skadeanmalan/",
    },
    {
      kind: "file",
      title: "Locker Policy",
      description: "Please find locker policy of school.",
      requestId: 16414,
      fileName: "Locker Policy.pdf",
      size: "60 KB",
    },
  ]);
  assert.equal(cats[1]?.category, "Policies");
});

void test("parseLibrary drops unsafe links and non-numeric downloads", () => {
  const titles = parseLibrary(LIBRARY).flatMap((c) => c.items.map((i) => i.title));
  assert.ok(!titles.includes("Evil link"));
  assert.ok(!titles.includes("Broken"));
});

/* Trimmed from right_student_school.jsp. */
const SCHOOL = `<div class="formtable"><table>
<tr><td>Adress</td><td>Exempelskolan</td></tr>
<tr><td></td><td>Skolvägen 1</td></tr>
<tr><td></td><td></td></tr>
<tr><td></td><td>123 45 Exempelstad</td></tr>
<tr><td>Hemsida</td><td><a href="http://www.exempelskolan.se">http://www.exempelskolan.se</a></td></tr>
<tr><td>E-post</td><td></td></tr>
</table></div>`;

void test("parseSchoolInfo joins continuation rows and drops empty fields", () => {
  assert.deepEqual(parseSchoolInfo(SCHOOL), [
    { label: "Adress", lines: ["Exempelskolan", "Skolvägen 1", "123 45 Exempelstad"] },
    {
      label: "Hemsida",
      lines: ["http://www.exempelskolan.se"],
      href: "http://www.exempelskolan.se/",
    },
  ]);
});

void test("decodeLegacyBody reads ISO-8859-1 correctly", () => {
  const bytes = new Uint8Array([
    0x53, 0x6b, 0x61, 0x64, 0x65, 0x61, 0x6e, 0x6d, 0xe4, 0x6c, 0x61, 0x6e,
  ]);
  assert.equal(decodeLegacyBody(bytes.buffer, "text/html;charset=ISO-8859-1"), "Skadeanmälan");
  assert.equal(
    decodeLegacyBody(
      new TextEncoder().encode("Skadeanmälan").buffer as ArrayBuffer,
      "text/html; charset=UTF-8",
    ),
    "Skadeanmälan",
  );
});

// oxlint-disable typescript/no-floating-promises -- node:test `test()` returns a
// promise the runner owns; awaiting it at the call site would serialize the suite.
import { test } from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { decodeEntities, htmlToText } from "./text.ts";

/** Run `fn` with a jsdom `document` installed, as in the browser. */
function withDom(fn: () => void): void {
  const g = globalThis as { document?: unknown };
  g.document = new JSDOM("").window.document;
  try {
    fn();
  } finally {
    delete g.document;
  }
}

test("decodes named and numeric entities", () => {
  withDom(() => {
    assert.equal(decodeEntities("Caf&eacute; &bull; 1&ndash;2 &amp; more"), "Café • 1–2 & more");
    assert.equal(decodeEntities("&#229;&#xE4;&#246;"), "åäö");
  });
});

test("leaves plain text alone", () => {
  withDom(() => {
    assert.equal(decodeEntities("Kära vårdnadshavare,\nhej"), "Kära vårdnadshavare,\nhej");
  });
});

/* A textarea's content is never parsed as markup, so tags come back as text
 * rather than being dropped or executed. */
test("returns markup as literal text", () => {
  withDom(() => {
    assert.equal(decodeEntities("&lt;b&gt;x&lt;/b&gt; <i>y</i>"), "<b>x</b> <i>y</i>");
  });
});

test("is the identity without a DOM", () => {
  assert.equal(decodeEntities("&amp; stays"), "&amp; stays");
});

test("htmlToText drops tags, decodes entities and collapses whitespace", () => {
  const g = globalThis as { DOMParser?: unknown };
  g.DOMParser = new JSDOM("").window.DOMParser;
  try {
    assert.equal(
      htmlToText("<p>Bring <b>lunch</b>\n &amp; water</p><script>x()</script>"),
      "Bring lunch & water",
    );
  } finally {
    delete g.DOMParser;
  }
});

test("htmlToText strips tags without a DOM", () => {
  assert.equal(htmlToText("<p>Bring <b>lunch</b></p>"), "Bring lunch");
});

test("htmlToText keeps adjacent blocks apart", () => {
  const g = globalThis as { DOMParser?: unknown };
  g.DOMParser = new JSDOM("").window.DOMParser;
  try {
    assert.equal(htmlToText("<p>one</p><p>two</p><style>p{}</style>"), "one two");
  } finally {
    delete g.DOMParser;
  }
});

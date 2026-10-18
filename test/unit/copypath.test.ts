import { test } from "node:test";
import assert from "node:assert/strict";
import {
  absolutePaths,
  relativePaths,
  selectedItems,
} from "../../src/copypath";

// Shape of a tree element as produced by TeamDocsExplorerProvider
const el = (fsPath: string, relative: string) => ({
  uri: { fsPath },
  relative,
});

const uriLike = (fsPath: string) => ({ fsPath });

test("selectedItems returns the single item when no multi-select", () => {
  const items = selectedItems(el("/d/a.md", "/a.md"), undefined);
  assert.equal(items.length, 1);
  assert.equal(items[0].uri.fsPath, "/d/a.md");
});

test("selectedItems prefers the multi-select array when present", () => {
  const a = el("/d/a.md", "/a.md");
  const b = el("/d/b.md", "/b.md");
  const items = selectedItems(a, [a, b]);
  assert.equal(items.length, 2);
});

test("selectedItems drops entries without a path", () => {
  const items = selectedItems(undefined, [null, {}, el("/d/a.md", "/a.md")]);
  assert.equal(items.length, 1);
});

test("absolutePaths handles tree elements and bare Uri-like values", () => {
  assert.deepEqual(absolutePaths(el("/d/a.md", "/a.md"), undefined), ["/d/a.md"]);
  assert.deepEqual(absolutePaths(uriLike("/d/a.md"), undefined), ["/d/a.md"]);
});

test("absolutePaths joins nothing for empty selection", () => {
  assert.deepEqual(absolutePaths(undefined, undefined), []);
});

test("relativePaths strips the docs root and leading separator", () => {
  assert.deepEqual(
    relativePaths("/d", el("/d/sub/nested.md", "/sub/nested.md"), undefined),
    ["sub/nested.md"]
  );
  assert.deepEqual(relativePaths("/d", el("/d/a.md", "/a.md"), undefined), [
    "a.md",
  ]);
});

test("relativePaths falls back to the absolute path outside the root", () => {
  assert.deepEqual(relativePaths("/d", uriLike("/elsewhere/x.md"), undefined), [
    "/elsewhere/x.md",
  ]);
  assert.deepEqual(relativePaths("", el("/d/a.md", "/a.md"), undefined), [
    "/d/a.md",
  ]);
});

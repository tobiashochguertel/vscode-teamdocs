"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// test/unit/copypath.test.ts
var import_node_test = require("node:test");
var import_strict = __toESM(require("node:assert/strict"));

// src/copypath.ts
function selectedItems(item, items) {
  const list = Array.isArray(items) && items.length ? items : [item];
  return list.filter((i) => i && (i.fsPath !== void 0 || i.uri?.fsPath));
}
function toFsPath(i) {
  return i.fsPath !== void 0 ? i.fsPath : i.uri.fsPath;
}
function absolutePaths(item, items) {
  return selectedItems(item, items).map(toFsPath);
}
function relativePaths(workspaceRoot, item, items) {
  return selectedItems(item, items).map((i) => {
    const fsPath = toFsPath(i);
    return workspaceRoot && fsPath.startsWith(workspaceRoot) ? fsPath.slice(workspaceRoot.length).replace(/^[/\\]/, "") : fsPath;
  });
}

// test/unit/copypath.test.ts
var el = (fsPath, relative) => ({
  uri: { fsPath },
  relative
});
var uriLike = (fsPath) => ({ fsPath });
(0, import_node_test.test)("selectedItems returns the single item when no multi-select", () => {
  const items = selectedItems(el("/d/a.md", "/a.md"), void 0);
  import_strict.default.equal(items.length, 1);
  import_strict.default.equal(items[0].uri.fsPath, "/d/a.md");
});
(0, import_node_test.test)("selectedItems prefers the multi-select array when present", () => {
  const a = el("/d/a.md", "/a.md");
  const b = el("/d/b.md", "/b.md");
  const items = selectedItems(a, [a, b]);
  import_strict.default.equal(items.length, 2);
});
(0, import_node_test.test)("selectedItems drops entries without a path", () => {
  const items = selectedItems(void 0, [null, {}, el("/d/a.md", "/a.md")]);
  import_strict.default.equal(items.length, 1);
});
(0, import_node_test.test)("absolutePaths handles tree elements and bare Uri-like values", () => {
  import_strict.default.deepEqual(absolutePaths(el("/d/a.md", "/a.md"), void 0), ["/d/a.md"]);
  import_strict.default.deepEqual(absolutePaths(uriLike("/d/a.md"), void 0), ["/d/a.md"]);
});
(0, import_node_test.test)("absolutePaths joins nothing for empty selection", () => {
  import_strict.default.deepEqual(absolutePaths(void 0, void 0), []);
});
(0, import_node_test.test)("relativePaths strips the docs root and leading separator", () => {
  import_strict.default.deepEqual(
    relativePaths("/d", el("/d/sub/nested.md", "/sub/nested.md"), void 0),
    ["sub/nested.md"]
  );
  import_strict.default.deepEqual(relativePaths("/d", el("/d/a.md", "/a.md"), void 0), [
    "a.md"
  ]);
});
(0, import_node_test.test)("relativePaths falls back to the absolute path outside the root", () => {
  import_strict.default.deepEqual(relativePaths("/d", uriLike("/elsewhere/x.md"), void 0), [
    "/elsewhere/x.md"
  ]);
  import_strict.default.deepEqual(relativePaths("", el("/d/a.md", "/a.md"), void 0), [
    "/d/a.md"
  ]);
});

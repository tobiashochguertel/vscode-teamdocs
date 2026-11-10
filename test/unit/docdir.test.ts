import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DOC_ENTRY_BROKEN_SYMLINK,
  DOC_ENTRY_DIRECTORY,
  DOC_ENTRY_FILE,
  readDocDirectory,
} from "../../src/docdir";

let root: string;

before(() => {
  root = mkdtempSync(join(tmpdir(), "teamdocs-docdir-"));
  writeFileSync(join(root, "guide.md"), "# Hello\n");
  writeFileSync(join(root, "notes.txt"), "plain\n");
  mkdirSync(join(root, "sub"));
  writeFileSync(join(root, "sub", "nested.md"), "# Nested\n");
  symlinkSync(join(root, "guide.md"), join(root, "linked-file.md"));
  symlinkSync(join(root, "sub"), join(root, "linked-dir"));
  symlinkSync(join(root, "does-not-exist.md"), join(root, "broken.md"));
});

after(() => {
  rmSync(root, { recursive: true, force: true });
});

const kinds = (entries: { name: string; kind: string }[]) =>
  Object.fromEntries(entries.map((e) => [e.name, e.kind]));

test("lists files and folders like before", () => {
  const entries = readDocDirectory(root, root, []);
  const map = kinds(entries);
  assert.equal(map["guide.md"], DOC_ENTRY_FILE);
  assert.equal(map["notes.txt"], DOC_ENTRY_FILE);
  assert.equal(map["sub"], DOC_ENTRY_DIRECTORY);
});

test("a broken symlink does not hide the other entries", () => {
  const entries = readDocDirectory(root, root, []);
  const names = entries.map((e) => e.name);
  for (const expected of ["guide.md", "notes.txt", "sub", "broken.md"]) {
    assert.ok(names.includes(expected), `${expected} missing from listing`);
  }
});

test("broken symlinks are flagged and expose their target", () => {
  const entries = readDocDirectory(root, root, []);
  const broken = entries.find((e) => e.name === "broken.md");
  assert.ok(broken, "broken.md missing");
  assert.equal(broken.kind, DOC_ENTRY_BROKEN_SYMLINK);
  assert.equal(broken.target, join(root, "does-not-exist.md"));
});

test("working symlinks resolve to the target's kind", () => {
  const entries = readDocDirectory(root, root, []);
  const map = kinds(entries);
  assert.equal(map["linked-file.md"], DOC_ENTRY_FILE);
  assert.equal(map["linked-dir"], DOC_ENTRY_DIRECTORY);
});

test("directories sort before files; broken links sort with files", () => {
  const entries = readDocDirectory(root, root, []);
  const names = entries.map((e) => e.name);
  const lastDir = Math.max(names.indexOf("sub"), names.indexOf("linked-dir"));
  const firstFile = Math.min(
    names.indexOf("broken.md"),
    names.indexOf("guide.md")
  );
  assert.ok(lastDir < firstFile, "directories must come first");
});

test("reads entries inside subdirectories too", () => {
  const entries = readDocDirectory(root, join(root, "sub"), []);
  const map = kinds(entries);
  assert.equal(map["nested.md"], DOC_ENTRY_FILE);
});

test("exclude patterns hide matching entries", () => {
  const entries = readDocDirectory(root, root, ["**/notes.txt", "**/sub"]);
  const names = entries.map((e) => e.name);
  assert.ok(!names.includes("notes.txt"));
  assert.ok(!names.includes("sub"));
  assert.ok(names.includes("guide.md"));
});

test("returns an empty list for a missing folder", () => {
  assert.deepEqual(readDocDirectory(root, join(root, "nope"), []), []);
});

test("a broken symlink inside a subdir does not fail that dir's listing", () => {
  symlinkSync(join(root, "sub", "gone.md"), join(root, "sub", "sub-broken.md"));
  const entries = readDocDirectory(root, join(root, "sub"), []);
  const map = kinds(entries);
  assert.equal(map["nested.md"], DOC_ENTRY_FILE);
  assert.equal(map["sub-broken.md"], DOC_ENTRY_BROKEN_SYMLINK);
  rmSync(join(root, "sub", "sub-broken.md"));
});

test("an unreadable folder yields an empty list instead of throwing", { skip: process.getuid?.() === 0 }, () => {
  const locked = join(root, "locked");
  mkdirSync(locked);
  chmodSync(locked, 0o000);
  try {
    assert.deepEqual(readDocDirectory(root, locked, []), []);
  } finally {
    chmodSync(locked, 0o755);
    rmSync(locked, { recursive: true, force: true });
  }
});

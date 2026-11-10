"use strict";

// Directory scanning for the TeamDocs explorer — pure fs/path logic with no
// vscode imports, so the unit tests can run under plain `node --test`.
//
// statSync() follows symlinks and throws ENOENT when the target is gone.
// Calling it on every entry (like the old readDirectory did) meant a single
// broken symlink killed the whole listing and the panel rendered empty.
// Entries are classified from the readdir Dirent instead, and statSync() is
// only attempted on symlinks — inside try/catch — so a dead link degrades to
// a flagged entry instead of an exception.

import { Dirent, existsSync, readdirSync, readlinkSync, statSync } from "fs";
import { join } from "path";
import { minimatch } from "minimatch";

export const DOC_ENTRY_FILE = "file";
export const DOC_ENTRY_DIRECTORY = "directory";
export const DOC_ENTRY_BROKEN_SYMLINK = "brokenSymlink";

export interface DocEntry {
  path: string;
  relative: string;
  name: string;
  kind: string;
  // Raw symlink target, set for broken links so the UI can show where it points.
  target?: string;
}

function classify(file: string, relative: string, dirent: Dirent): DocEntry {
  if (dirent.isSymbolicLink()) {
    try {
      const stat = statSync(file);
      return {
        path: file,
        relative: relative,
        name: dirent.name,
        kind: stat.isDirectory() ? DOC_ENTRY_DIRECTORY : DOC_ENTRY_FILE,
      };
    } catch {
      let target: string | undefined;
      try {
        target = readlinkSync(file);
      } catch {
        target = undefined;
      }
      return {
        path: file,
        relative: relative,
        name: dirent.name,
        kind: DOC_ENTRY_BROKEN_SYMLINK,
        target: target,
      };
    }
  }

  return {
    path: file,
    relative: relative,
    name: dirent.name,
    kind: dirent.isDirectory() ? DOC_ENTRY_DIRECTORY : DOC_ENTRY_FILE,
  };
}

export function readDocDirectory(
  root: string,
  folder: string,
  excludePatterns: string[]
): DocEntry[] {
  if (!existsSync(folder)) {
    return [];
  }

  const children: DocEntry[] = [];
  let dirents: Dirent[];
  try {
    dirents = readdirSync(folder, { withFileTypes: true });
  } catch {
    // Unreadable directory (permissions, vanished mid-scan) — show nothing for
    // it rather than failing the whole tree.
    return [];
  }

  dirents.forEach(function (dirent: Dirent) {
    const file = join(folder, dirent.name);
    const relative = file.replace(root, "");

    // Check if the file matches any of the exclude patterns
    if (excludePatterns.some((pattern) => minimatch(relative, pattern))) {
      return;
    }

    children.push(classify(file, relative, dirent));
  });

  children.sort(function (a, b) {
    const aDir = a.kind === DOC_ENTRY_DIRECTORY;
    const bDir = b.kind === DOC_ENTRY_DIRECTORY;
    if (aDir === bDir) {
      return a.relative.localeCompare(b.relative);
    }

    return aDir ? -1 : 1;
  });

  return children;
}

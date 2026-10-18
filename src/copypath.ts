"use strict";

// Pure path logic for the copy commands — no vscode imports so the unit tests
// can run under plain `node --test` without an extension host.
//
// view/item/context handlers receive the tree element ({uri, relative, ...});
// with multi-select the second arg is the array of selected elements. A Uri
// passed directly (e.g. from tests) has fsPath on the value itself.

export function selectedItems(item: any, items: any): any[] {
  const list = Array.isArray(items) && items.length ? items : [item];
  return list.filter((i: any) => i && (i.fsPath !== undefined || i.uri?.fsPath));
}

function toFsPath(i: any): string {
  return i.fsPath !== undefined ? i.fsPath : i.uri.fsPath;
}

export function absolutePaths(item: any, items: any): string[] {
  return selectedItems(item, items).map(toFsPath);
}

export function relativePaths(
  workspaceRoot: string,
  item: any,
  items: any
): string[] {
  return selectedItems(item, items).map((i: any) => {
    const fsPath = toFsPath(i);
    return workspaceRoot && fsPath.startsWith(workspaceRoot)
      ? fsPath.slice(workspaceRoot.length).replace(/^[/\\]/, "")
      : fsPath;
  });
}

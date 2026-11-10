"use strict";

import { join } from "path";
import {
  Event,
  EventEmitter,
  TreeItem,
  FileType,
  ThemeColor,
  ThemeIcon,
  TreeItemCollapsibleState,
  Uri,
  TreeDataProvider,
  window,
} from "vscode";
import {
  DOC_ENTRY_BROKEN_SYMLINK,
  DOC_ENTRY_DIRECTORY,
  DocEntry,
  readDocDirectory,
} from "./docdir";
import { getRootPath, getExcludePatterns } from "./util";

export class TeamDocsExplorerProvider implements TreeDataProvider<any> {
  private _onDidChangeTreeData: EventEmitter<any | undefined | null | void> =
    new EventEmitter<any | undefined | null | void>();
  readonly onDidChangeTreeData: Event<any | undefined | null | void> =
    this._onDidChangeTreeData.event;

  // Paths of broken symlinks the user was already notified about — a warning
  // fires once per link per session, not on every refresh.
  private reportedBrokenLinks = new Set<string>();

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: any): TreeItem {
    const treeItem = new TreeItem(
      element.uri,
      element.type === FileType.Directory
        ? TreeItemCollapsibleState.Collapsed
        : TreeItemCollapsibleState.None
    );

    if (element.brokenLink) {
      treeItem.contextValue = "brokenSymlink";
      treeItem.description = "broken link";
      treeItem.iconPath = new ThemeIcon(
        "warning",
        new ThemeColor("list.warningForeground")
      );
      treeItem.tooltip = element.target
        ? `Broken symbolic link → ${element.target}`
        : "Broken symbolic link (target missing)";
      return treeItem;
    }

    if (element.type === FileType.File) {
      treeItem.command = {
        command: "teamDocs.previewFile",
        title: "Preview File",
        arguments: [element.uri],
      };

      treeItem.contextValue = "file";
    } else {
      treeItem.contextValue = "folder";
    }

    return treeItem;
  }

  getChildren(element: any): Promise<any> {
    const workspaceRoot = getRootPath();
    if (!workspaceRoot) {
      return Promise.resolve([]);
    }

    let folder = join(workspaceRoot);
    if (element) {
      folder = join(workspaceRoot, element.relative);
    }

    return Promise.resolve(this.readDirectory(workspaceRoot, folder));
  }

  readDirectory(root: string, folder: string): Array<any> {
    const entries = readDocDirectory(root, folder, getExcludePatterns());
    this.warnAboutBrokenLinks(entries);

    return entries.map(function (entry) {
      return {
        uri: Uri.file(entry.path),
        relative: entry.relative,
        name: entry.name,
        type:
          entry.kind === DOC_ENTRY_DIRECTORY
            ? FileType.Directory
            : FileType.File,
        brokenLink: entry.kind === DOC_ENTRY_BROKEN_SYMLINK,
        target: entry.target,
      };
    });
  }

  private warnAboutBrokenLinks(entries: DocEntry[]): void {
    const fresh = entries.filter(
      (entry) =>
        entry.kind === DOC_ENTRY_BROKEN_SYMLINK &&
        !this.reportedBrokenLinks.has(entry.path)
    );
    if (!fresh.length) {
      return;
    }

    fresh.forEach((entry) => this.reportedBrokenLinks.add(entry.path));

    const names = fresh
      .slice(0, 3)
      .map((entry) => entry.name)
      .join(", ");
    const more = fresh.length > 3 ? ` and ${fresh.length - 3} more` : "";
    window.showWarningMessage(
      `TeamDocs: broken symbolic link${
        fresh.length > 1 ? "s" : ""
      } in the docs folder: ${names}${more}`
    );
  }
}

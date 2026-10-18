import * as vscode from "vscode";
import { TeamDocsExplorerProvider } from "./explorer";
import { getRootPath, getExcludePatterns, isMarkdownFile } from "./util";
import { ReviewManager } from "./review";

export function activate(context: vscode.ExtensionContext) {
  const review = new ReviewManager(context, {
    extensionId: "lucasprag.teamdocs",
    extensionName: "TeamDocs",
    commandPrefix: "teamDocs.review",
    gracePeriodDays: 14,
    reminderIntervalDays: 30,
  });

  void review.initialize();

  const provider = new TeamDocsExplorerProvider();

  vscode.window.registerTreeDataProvider("teamdocs", provider);

  vscode.commands.registerCommand("teamDocs.previewFile", function (resource) {
    if (isMarkdownFile(resource.path)) {
      vscode.commands.executeCommand("markdown.showPreview", resource);
    } else {
      vscode.commands.executeCommand("vscode.open", resource);
    }
  });

  vscode.commands.registerCommand("teamDocs.openSettings", function () {
    vscode.commands.executeCommand("workbench.action.openSettings", "teamdocs");
  });

  // view/item/context handlers receive the tree element ({uri, relative, ...});
  // with multi-select the second arg is the array of selected elements.
  const selectedItems = function (item: any, items: any): any[] {
    const list = Array.isArray(items) && items.length ? items : [item];
    return list.filter((i: any) => i && (i instanceof vscode.Uri || i.uri));
  };

  vscode.commands.registerCommand(
    "teamDocs.copyPath",
    async function (item: any, items: any) {
      const paths = selectedItems(item, items).map((i: any) =>
        i instanceof vscode.Uri ? i.fsPath : i.uri.fsPath
      );
      if (paths.length) {
        await vscode.env.clipboard.writeText(paths.join("\n"));
      }
    }
  );

  vscode.commands.registerCommand(
    "teamDocs.copyRelativePath",
    async function (item: any, items: any) {
      const workspaceRoot = getRootPath();
      const paths = selectedItems(item, items).map((i: any) => {
        const fsPath = i instanceof vscode.Uri ? i.fsPath : i.uri.fsPath;
        return workspaceRoot && fsPath.startsWith(workspaceRoot)
          ? fsPath.slice(workspaceRoot.length).replace(/^[/\\]/, "")
          : fsPath;
      });
      if (paths.length) {
        await vscode.env.clipboard.writeText(paths.join("\n"));
      }
    }
  );

  vscode.commands.registerCommand("teamDocs.search", async () => {
    const workspaceRoot = getRootPath();
    if (workspaceRoot) {
      const excludePatterns = getExcludePatterns();

      const files = await vscode.workspace.findFiles(
        new vscode.RelativePattern(workspaceRoot, "**/**/**/**/**/**/*"),
        `{${excludePatterns.join(",")}}`
      );

      const fileNames = files.map((file) => {
        return file.path.replace(`${workspaceRoot}/`, "");
      });

      const selectedFile = await vscode.window.showQuickPick(fileNames, {
        placeHolder: "Type to search files...",
      });

      if (selectedFile) {
        const selectedFileUri = vscode.Uri.file(
          `${workspaceRoot}/${selectedFile}`
        );

        if (isMarkdownFile(selectedFile)) {
          vscode.commands.executeCommand(
            "markdown.showPreview",
            selectedFileUri
          );
        } else {
          vscode.commands.executeCommand("vscode.open", selectedFileUri);
        }
      }
    }
  });

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(function (e) {
      if (e.affectsConfiguration("teamdocs")) {
        provider.refresh();
      }
    })
  );

  const workspaceRoot = getRootPath();
  if (workspaceRoot === "") {
    vscode.window
      .showInformationMessage(
        "TeamDocs is missing the `teamdocs.path_to_docs_folder` configuration. Please set the path to your docs folder.",
        "Open Settings"
      )
      .then(function () {
        vscode.commands.executeCommand("teamDocs.openSettings");
      });
  } else {
    // customize view title based on dir name
    const dirName = workspaceRoot.split("/").slice(-1).join("");
    const view = vscode.window.createTreeView("teamdocs", {
      treeDataProvider: provider,
    });
    view.title = dirName;
  }
}

export function deactivate() {}

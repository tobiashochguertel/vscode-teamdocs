import * as vscode from "vscode";
import { TeamDocsExplorerProvider } from "./explorer";
import { getRootPath, getExcludePatterns, isMarkdownFile } from "./util";
import { absolutePaths, relativePaths } from "./copypath";
import { ReviewManager } from "./review";

export function activate(context: vscode.ExtensionContext) {
  const review = new ReviewManager(context, {
    extensionId: "TobiasHochguertel.teamdocs",
    extensionName: "TeamDocs",
    commandPrefix: "teamDocs.review",
    gracePeriodDays: 14,
    reminderIntervalDays: 30,
  });

  void review.initialize();

  const provider = new TeamDocsExplorerProvider();

  vscode.window.registerTreeDataProvider("teamdocs", provider);

  vscode.commands.registerCommand(
    "teamDocs.previewFile",
    async function (resource) {
      // markdown.showPreview is missing when the built-in
      // markdown-language-features extension is disabled (e.g. VS Code
      // forks like Devin) — fall back to the plain text editor then.
      const hasPreview = (
        await vscode.commands.getCommands(true)
      ).includes("markdown.showPreview");
      if (isMarkdownFile(resource.path) && hasPreview) {
        vscode.commands.executeCommand("markdown.showPreview", resource);
      } else {
        vscode.commands.executeCommand("vscode.open", resource);
      }
    }
  );

  vscode.commands.registerCommand("teamDocs.openSettings", function () {
    vscode.commands.executeCommand("workbench.action.openSettings", "teamdocs");
  });

  vscode.commands.registerCommand(
    "teamDocs.copyPath",
    async function (item: any, items: any) {
      const paths = absolutePaths(item, items);
      if (paths.length) {
        await vscode.env.clipboard.writeText(paths.join("\n"));
      }
    }
  );

  vscode.commands.registerCommand(
    "teamDocs.copyRelativePath",
    async function (item: any, items: any) {
      const paths = relativePaths(getRootPath(), item, items);
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

  vscode.commands.registerCommand("teamDocs.refresh", function () {
    provider.refresh();
  });

  let watcher: vscode.FileSystemWatcher | undefined;
  const watchDocs = function () {
    watcher?.dispose();
    const root = getRootPath();
    if (root === "") {
      return;
    }
    watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(root, "**/*")
    );
    watcher.onDidCreate(() => provider.refresh());
    watcher.onDidChange(() => provider.refresh());
    watcher.onDidDelete(() => provider.refresh());
    context.subscriptions.push(watcher);
  };

  watchDocs();

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(function (e) {
      if (e.affectsConfiguration("teamdocs")) {
        provider.refresh();
        watchDocs();
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

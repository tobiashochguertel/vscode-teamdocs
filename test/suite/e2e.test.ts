import * as assert from "assert";
import * as vscode from "vscode";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { TeamDocsExplorerProvider } from "../../src/explorer";

// End-to-end: drives the real tree provider, gets the TreeItem the UI would
// show, and executes its command exactly like a user click.
suite("TeamDocs explorer click flow (e2e)", function () {
  this.timeout(30000);
  let docsDir: string;
  let mdUri: vscode.Uri;

  suiteSetup(async () => {
    docsDir = fs.mkdtempSync(path.join(os.tmpdir(), "teamdocs-e2e-"));
    mdUri = vscode.Uri.file(path.join(docsDir, "guide.md"));
    fs.writeFileSync(mdUri.fsPath, "# Hello\n");
    fs.writeFileSync(path.join(docsDir, "notes.txt"), "plain\n");
    fs.mkdirSync(path.join(docsDir, "sub"));
    fs.writeFileSync(path.join(docsDir, "sub", "nested.md"), "# Nested\n");

    await vscode.workspace
      .getConfiguration("teamdocs")
      .update(
        "path_to_docs_folder",
        docsDir,
        vscode.ConfigurationTarget.Global
      );
    await vscode.commands.executeCommand("teamdocs.focus");
    for (let i = 0; i < 20; i++) {
      const cmds = await vscode.commands.getCommands(true);
      if (cmds.includes("teamDocs.previewFile")) break;
      await new Promise((r) => setTimeout(r, 500));
    }
  });

  async function clickElement(item: any) {
    const provider = new TeamDocsExplorerProvider();
    const treeItem = provider.getTreeItem(item);
    assert.ok(treeItem.command, "tree item has no command");
    await vscode.commands.executeCommand(
      treeItem.command!.command,
      ...(treeItem.command!.arguments ?? [])
    );
  }

  test("provider lists files and folders from the configured docs dir", async () => {
    const provider = new TeamDocsExplorerProvider();
    const children = await provider.getChildren(undefined);
    const names = children.map((c: any) => c.name);
    assert.ok(names.includes("sub"), "folder missing");
    assert.ok(names.includes("guide.md"), "file missing");
    assert.ok(names.includes("notes.txt"), "file missing");
  });

  test("clicking a markdown file opens the markdown preview", async () => {
    const provider = new TeamDocsExplorerProvider();
    const children = await provider.getChildren(undefined);
    const md = children.find((c: any) => c.name === "guide.md");
    assert.ok(md);
    await clickElement(md);
    await new Promise((r) => setTimeout(r, 2000));
    const labels = vscode.window.tabGroups.all.flatMap((g) =>
      g.tabs.map((t) => t.label)
    );
    assert.ok(
      labels.some((l) => l.includes("guide.md")),
      `expected a guide.md tab, got ${JSON.stringify(labels)}`
    );
  });

  test("clicking a non-markdown file opens it as an editor", async () => {
    const provider = new TeamDocsExplorerProvider();
    const children = await provider.getChildren(undefined);
    const txt = children.find((c: any) => c.name === "notes.txt");
    assert.ok(txt);
    await clickElement(txt);
    await new Promise((r) => setTimeout(r, 1000));
    assert.equal(
      vscode.window.activeTextEditor?.document.uri.fsPath,
      path.join(docsDir, "notes.txt")
    );
  });
});

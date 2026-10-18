import * as assert from "assert";
import * as vscode from "vscode";

suite("TeamDocs copy commands (integration)", () => {
  suiteSetup(async function () {
    this.timeout(20000);
    await vscode.workspace
      .getConfiguration("teamdocs")
      .update("path_to_docs_folder", "/tmp", vscode.ConfigurationTarget.Global);
    await vscode.commands.executeCommand("teamdocs.focus");
    // wait for the extension to finish activating
    for (let i = 0; i < 20; i++) {
      const cmds = await vscode.commands.getCommands(true);
      if (cmds.includes("teamDocs.copyPath")) return;
      await new Promise((r) => setTimeout(r, 500));
    }
    assert.fail("teamDocs.copyPath was never registered");
  });

  test("extension activates and registers all commands", async () => {
    const ext = vscode.extensions.all.find(
      (e) => e.packageJSON.name === "teamdocs"
    );
    assert.ok(ext, "teamdocs extension not found");
    assert.ok(ext.isActive, "teamdocs extension is not active");

    const cmds = await vscode.commands.getCommands(true);
    for (const c of [
      "teamDocs.previewFile",
      "teamDocs.search",
      "teamDocs.openSettings",
      "teamDocs.copyPath",
      "teamDocs.copyRelativePath",
    ]) {
      assert.ok(cmds.includes(c), `missing command ${c}`);
    }
  });

  test("copy commands are contributed to the item context menu", () => {
    const pkg = vscode.extensions.all.find(
      (e) => e.packageJSON.name === "teamdocs"
    )!.packageJSON;
    const items = pkg.contributes?.menus?.["view/item/context"] ?? [];
    const cmds = items.map((i: any) => i.command);
    assert.ok(cmds.includes("teamDocs.copyPath"));
    assert.ok(cmds.includes("teamDocs.copyRelativePath"));
    for (const i of items) {
      assert.match(i.when, /view == teamdocs/);
    }
  });

  test("teamDocs.copyPath writes the absolute path to the clipboard", async () => {
    const element = { uri: vscode.Uri.file("/tmp/td-docs/a.md") };
    await vscode.commands.executeCommand("teamDocs.copyPath", element);
    assert.equal(await vscode.env.clipboard.readText(), "/tmp/td-docs/a.md");
  });

  test("teamDocs.copyRelativePath writes the path relative to the docs folder", async () => {
    const element = { uri: vscode.Uri.file("/tmp/sub/nested.md") };
    await vscode.commands.executeCommand(
      "teamDocs.copyRelativePath",
      element
    );
    assert.equal(await vscode.env.clipboard.readText(), "sub/nested.md");
  });

  test("multi-select copies one path per line", async () => {
    const a = { uri: vscode.Uri.file("/tmp/a.md") };
    const b = { uri: vscode.Uri.file("/tmp/b.md") };
    await vscode.commands.executeCommand("teamDocs.copyPath", a, [a, b]);
    assert.equal(
      await vscode.env.clipboard.readText(),
      "/tmp/a.md\n/tmp/b.md"
    );
  });
});

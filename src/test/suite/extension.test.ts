import * as assert from "assert";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import * as vscode from "vscode";

const VIEW_TYPE = "cera.markdownEditor";

function createTempMarkdown(content: string): vscode.Uri {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cera-it-"));
  const file = path.join(dir, "doc.md");
  fs.writeFileSync(file, content, "utf8");
  return vscode.Uri.file(file);
}

// End-to-end coverage of the Phase 1 (read-only) custom editor lifecycle through
// a real Extension Development Host. Webview-driven edit/commit and undo UX
// arrive with Phase 2 (#8–#11) and get their own integration coverage then.
describe("Cera custom editor lifecycle", function () {
  this.timeout(30000);

  before(async () => {
    // Activation is lazy (on first custom-editor use); activate explicitly so
    // the contributed command is registered before the first assertion.
    const ext = vscode.extensions.getExtension("Alpharius99.cera");
    assert.ok(ext, "Cera extension should be present");
    await ext.activate();
  });

  it("registers the cera.openWith command", async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes("cera.openWith"), "cera.openWith should be registered");
  });

  it("opens a Markdown document in the Cera custom editor", async () => {
    const uri = createTempMarkdown("# Hello\n\nBody.\n");
    await vscode.commands.executeCommand("vscode.openWith", uri, VIEW_TYPE);
    const doc = await vscode.workspace.openTextDocument(uri);
    assert.strictEqual(doc.getText(), "# Hello\n\nBody.\n");
  });

  it("reflects an external edit made while the editor is open", async () => {
    const uri = createTempMarkdown("# Title\n");
    await vscode.commands.executeCommand("vscode.openWith", uri, VIEW_TYPE);
    const doc = await vscode.workspace.openTextDocument(uri);

    const edit = new vscode.WorkspaceEdit();
    edit.insert(uri, new vscode.Position(1, 0), "Inserted line.\n");
    assert.ok(await vscode.workspace.applyEdit(edit));
    assert.ok(doc.getText().includes("Inserted line."), "external edit should be reflected");
  });

  it("commits a block splice into the document via WorkspaceEdit (#9)", async () => {
    const original = "# Title\n\nBody.\n";
    const uri = createTempMarkdown(original);
    await vscode.commands.executeCommand("vscode.openWith", uri, VIEW_TYPE);
    const doc = await vscode.workspace.openTextDocument(uri);

    // The same range splice _commitBlock performs: replace the heading block.
    // The edit goes through WorkspaceEdit, so VS Code records undo history and
    // dirty state (undo itself is native and verified manually — the headless
    // test host does not process the `undo` command).
    const edit = new vscode.WorkspaceEdit();
    edit.replace(uri, new vscode.Range(0, 0, 0, doc.lineAt(0).text.length), "# Changed");
    assert.ok(await vscode.workspace.applyEdit(edit));
    assert.strictEqual(doc.getText(), "# Changed\n\nBody.\n");
    assert.ok(doc.isDirty, "commit should mark the document dirty");
  });

  it("tracks dirty state and saves while the Cera editor owns the document", async () => {
    const uri = createTempMarkdown("# Save\n");
    await vscode.commands.executeCommand("vscode.openWith", uri, VIEW_TYPE);
    const doc = await vscode.workspace.openTextDocument(uri);

    const edit = new vscode.WorkspaceEdit();
    edit.insert(uri, new vscode.Position(1, 0), "More.\n");
    await vscode.workspace.applyEdit(edit);
    assert.strictEqual(doc.isDirty, true, "document should be dirty after edit");

    assert.ok(await doc.save(), "save should succeed");
    assert.strictEqual(doc.isDirty, false, "document should be clean after save");
    assert.strictEqual(fs.readFileSync(uri.fsPath, "utf8"), "# Save\nMore.\n");
  });
});

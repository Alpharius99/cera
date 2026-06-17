import * as vscode from "vscode";
import { CeraEditorProvider } from "./ceraEditorProvider";

// Entry point. VS Code calls this when the custom editor is first needed, or
// when the Cera Welcome view in the side bar is opened.
export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(CeraEditorProvider.register(context));

  // The Welcome view in the primary side bar. It carries no tree items, so VS
  // Code shows the contributed `viewsWelcome` content (the action buttons).
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider("cera.welcome", new WelcomeViewProvider()),
  );

  // Convenience command: reopen the active file in the Cera editor.
  context.subscriptions.push(
    vscode.commands.registerCommand("cera.openWith", () => {
      const uri: vscode.Uri | undefined = vscode.window.activeTextEditor?.document.uri;
      if (uri === undefined) {
        vscode.window.showInformationMessage("Cera: no active file to open.");
        return;
      }
      vscode.commands.executeCommand("vscode.openWith", uri, CeraEditorProvider.viewType);
    }),
  );

  // Start a fresh document directly in Cera, with no file to pick first.
  context.subscriptions.push(
    vscode.commands.registerCommand("cera.newDocument", () => {
      const uri: vscode.Uri = vscode.Uri.parse("untitled:Untitled.md");
      vscode.commands.executeCommand("vscode.openWith", uri, CeraEditorProvider.viewType);
    }),
  );

  // Pick a Markdown file and open it in Cera.
  context.subscriptions.push(
    vscode.commands.registerCommand("cera.openMarkdownFile", async () => {
      const picked: vscode.Uri[] | undefined = await vscode.window.showOpenDialog({
        canSelectMany: false,
        openLabel: "Open in Cera",
        filters: { Markdown: ["md", "markdown"] },
      });
      if (picked === undefined || picked.length === 0) {
        return;
      }
      vscode.commands.executeCommand("vscode.openWith", picked[0], CeraEditorProvider.viewType);
    }),
  );
}

export function deactivate(): void {
  // Nothing to clean up yet.
}

// An empty tree provider: the Welcome view shows only its `viewsWelcome`
// content, so it never has to supply tree items.
class WelcomeViewProvider implements vscode.TreeDataProvider<never> {
  public getTreeItem(element: never): vscode.TreeItem {
    return element;
  }

  public getChildren(): never[] {
    return [];
  }
}

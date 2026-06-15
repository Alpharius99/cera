import * as vscode from "vscode";
import { CeraEditorProvider } from "./ceraEditorProvider";

// Entry point. VS Code calls this when the custom editor is first needed.
export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(CeraEditorProvider.register(context));

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
}

export function deactivate(): void {
  // Nothing to clean up yet.
}

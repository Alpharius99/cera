import * as vscode from "vscode";

// Cera's reveal-on-focus editor is a webview-based custom editor over the
// raw Markdown text. Using CustomTextEditorProvider means VS Code gives us
// document sync, dirty tracking, undo/redo, and save for free — we only own
// the rendering and the edits.
export class CeraEditorProvider implements vscode.CustomTextEditorProvider {
  public static readonly viewType: string = "cera.markdownEditor";

  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    const provider: CeraEditorProvider = new CeraEditorProvider(context);
    return vscode.window.registerCustomEditorProvider(
      CeraEditorProvider.viewType,
      provider,
      {
        webviewOptions: { retainContextWhenHidden: true },
        supportsMultipleEditorsPerDocument: false,
      },
    );
  }

  private constructor(private readonly _context: vscode.ExtensionContext) {}

  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken,
  ): Promise<void> {
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this._context.extensionUri, "media")],
    };
    webviewPanel.webview.html = this._getHtml(webviewPanel.webview);

    // Push the current document text into the webview.
    const updateWebview = (): void => {
      webviewPanel.webview.postMessage({ type: "update", text: document.getText() });
    };

    // Keep the webview in sync when the underlying document changes
    // (e.g. edited elsewhere, reverted, or formatted).
    const changeSubscription: vscode.Disposable = vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.uri.toString() === document.uri.toString()) {
        updateWebview();
      }
    });
    webviewPanel.onDidDispose(() => changeSubscription.dispose());

    // Edits coming back from the webview are applied as workspace edits so
    // VS Code records undo history and dirty state correctly.
    webviewPanel.webview.onDidReceiveMessage((message: { type: string; text?: string }) => {
      if (message.type === "edit" && typeof message.text === "string") {
        this._replaceDocument(document, message.text);
      } else if (message.type === "ready") {
        updateWebview();
      }
    });
  }

  private _replaceDocument(document: vscode.TextDocument, newText: string): Thenable<boolean> {
    const edit: vscode.WorkspaceEdit = new vscode.WorkspaceEdit();
    const fullRange: vscode.Range = new vscode.Range(
      document.positionAt(0),
      document.positionAt(document.getText().length),
    );
    edit.replace(document.uri, fullRange, newText);
    return vscode.workspace.applyEdit(edit);
  }

  private _getHtml(webview: vscode.Webview): string {
    const scriptUri: vscode.Uri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._context.extensionUri, "media", "cera.bundle.js"),
    );
    const styleUri: vscode.Uri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._context.extensionUri, "media", "cera.css"),
    );
    const nonce: string = getNonce();

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy"
    content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link href="${styleUri}" rel="stylesheet" />
  <title>Cera</title>
</head>
<body>
  <div id="cera-document" class="cera-document"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function getNonce(): string {
  let text: string = "";
  const possible: string = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i: number = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

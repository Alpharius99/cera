import * as vscode from "vscode";
import { buildCsp } from "./csp";

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
    // The document's own folder is a local resource root so workspace-relative
    // images can be loaded via asWebviewUri (#7).
    const documentDir: vscode.Uri = vscode.Uri.joinPath(document.uri, "..");
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this._context.extensionUri, "media"),
        documentDir,
      ],
    };
    webviewPanel.webview.html = this._getHtml(webviewPanel.webview);

    const baseUri: string = webviewPanel.webview.asWebviewUri(documentDir).toString();

    // Push the current document text (plus image policy) into the webview.
    const updateWebview = (): void => {
      const remoteMode: string = vscode.workspace
        .getConfiguration("cera")
        .get<string>("images.remote", "render");
      webviewPanel.webview.postMessage({
        type: "update",
        text: document.getText(),
        baseUri,
        remoteMode,
      });
    };

    // Keep the webview in sync when the underlying document changes
    // (e.g. edited elsewhere, reverted, or formatted).
    const changeSubscription: vscode.Disposable = vscode.workspace.onDidChangeTextDocument((e) => {
      if (e.document.uri.toString() === document.uri.toString()) {
        updateWebview();
      }
    });
    // Re-render when the remote-image setting changes.
    const configSubscription: vscode.Disposable = vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("cera.images.remote")) {
        updateWebview();
      }
    });
    webviewPanel.onDidDispose(() => {
      changeSubscription.dispose();
      configSubscription.dispose();
    });

    // Block commits coming back from the webview are spliced into the document
    // as workspace edits, so VS Code records undo history and dirty state.
    webviewPanel.webview.onDidReceiveMessage(
      (message: { type: string; text?: string; startLine?: number; endLine?: number }) => {
        if (
          message.type === "commit" &&
          typeof message.text === "string" &&
          typeof message.startLine === "number" &&
          typeof message.endLine === "number"
        ) {
          this._commitBlock(document, message.startLine, message.endLine, message.text);
        } else if (message.type === "ready") {
          updateWebview();
        }
      },
    );
  }

  // Replace the source lines [startLine, endLine) with `text`. The range covers
  // the block's content (col 0 of the first line to the end of the last line),
  // leaving the surrounding newlines intact. Stale/out-of-bounds ranges are
  // rejected here; version-based rebasing of concurrent edits is #10.
  private _commitBlock(
    document: vscode.TextDocument,
    startLine: number,
    endLine: number,
    text: string,
  ): Thenable<boolean> | undefined {
    const lastLine: number = endLine - 1;
    if (startLine < 0 || lastLine < startLine || lastLine >= document.lineCount) {
      return undefined;
    }
    const range: vscode.Range = new vscode.Range(
      new vscode.Position(startLine, 0),
      new vscode.Position(lastLine, document.lineAt(lastLine).text.length),
    );
    // The webview produces LF text; match the document's EOL so CRLF files stay
    // byte-for-byte CRLF (#32).
    const eol: string = document.eol === vscode.EndOfLine.CRLF ? "\r\n" : "\n";
    const normalizedText: string = text.replace(/\r?\n/g, eol);
    const edit: vscode.WorkspaceEdit = new vscode.WorkspaceEdit();
    edit.replace(document.uri, range, normalizedText);
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
  <meta http-equiv="Content-Security-Policy" content="${buildCsp(webview.cspSource, nonce)}" />
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

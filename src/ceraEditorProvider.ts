import * as vscode from "vscode";
import { buildCsp } from "./csp";
import { resolveBlockRange } from "./splice";

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
        version: document.version,
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
      async (message: {
        type: string;
        text?: string;
        startLine?: number;
        endLine?: number;
        baseVersion?: number;
        originalText?: string;
      }) => {
        if (
          message.type === "commit" &&
          typeof message.text === "string" &&
          typeof message.startLine === "number" &&
          typeof message.endLine === "number"
        ) {
          const applied: boolean = await this._commitBlock(
            document,
            message.startLine,
            message.endLine,
            message.text,
            message.baseVersion,
            message.originalText ?? "",
          );
          // On a successful commit the document change re-renders the webview;
          // on a rejected/conflicting commit, refresh it to the current state.
          if (!applied) {
            updateWebview();
          }
        } else if (message.type === "undo") {
          // Cmd/Ctrl+Z is swallowed by the focused webview; run the workbench
          // undo on its behalf so block commits revert through native history.
          vscode.commands.executeCommand("undo");
        } else if (message.type === "redo") {
          // Forwarding is in place, but redo does not yet re-apply the edit for
          // this custom editor — tracked in #33.
          vscode.commands.executeCommand("redo");
        } else if (message.type === "ready") {
          updateWebview();
        }
      },
    );
  }

  // Splice the block's edited `text` back into the document. If the document
  // changed since the editor opened (version mismatch), re-resolve the block's
  // current range first and abort on conflict, so a stale range can never
  // overwrite unrelated content (#10). Returns whether an edit was applied.
  private async _commitBlock(
    document: vscode.TextDocument,
    startLine: number,
    endLine: number,
    text: string,
    baseVersion: number | undefined,
    originalText: string,
  ): Promise<boolean> {
    let start: number = startLine;
    let end: number = endLine;

    if (baseVersion !== undefined && document.version !== baseVersion) {
      const resolution = resolveBlockRange(document.getText(), originalText, startLine, endLine);
      if (resolution.status === "conflict") {
        await vscode.window.showWarningMessage(
          "Cera: this block changed outside the editor, so your edit was not applied (to avoid overwriting other changes).",
        );
        return false;
      }
      start = resolution.startLine;
      end = resolution.endLine;
    }

    const lastLine: number = end - 1;
    if (start < 0 || lastLine < start || lastLine >= document.lineCount) {
      return false;
    }
    const range: vscode.Range = new vscode.Range(
      new vscode.Position(start, 0),
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
    // VS Code codicon font, copied into media/ at build time, for the native
    // active-block controls (#35). Loaded under the CSP's cspSource font-src.
    const codiconUri: vscode.Uri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._context.extensionUri, "media", "codicons", "codicon.css"),
    );
    const nonce: string = getNonce();

    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${buildCsp(webview.cspSource, nonce)}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link href="${codiconUri}" rel="stylesheet" />
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

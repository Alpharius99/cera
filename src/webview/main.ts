// Webview entry point. esbuild bundles this into media/cera.bundle.js, which the
// custom editor loads via a nonce under the strict CSP — no CDN, no inline script.
//
// Phase 1 asset-pipeline step: behavior is unchanged from the Phase 0 skeleton
// (render the raw Markdown text). Standing the bundle up now means later webview
// dependencies (markdown-it, DOMPurify) ship through this single bundle instead
// of a CDN or inline tag.

interface VsCodeApi {
  postMessage(message: unknown): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

const vscode = acquireVsCodeApi();
const root = document.getElementById("cera-document") as HTMLElement;

/** Render the document. For now, show raw text in a single pre block. */
function render(text: string): void {
  root.textContent = "";
  const pre = document.createElement("pre");
  pre.className = "cera-raw";
  pre.textContent =
    text.length > 0 ? text : "Empty document. Start typing in the underlying editor.";
  root.appendChild(pre);
}

// Messages arrive over VS Code's trusted host<->webview channel (the webview is
// sandboxed and isolated; there is no cross-origin sender to validate).
window.addEventListener("message", (event: MessageEvent) => {
  const message = event.data as { type: string; text?: string };
  if (message.type === "update" && typeof message.text === "string") {
    render(message.text);
  }
});

// Tell the extension host we're ready to receive the document.
vscode.postMessage({ type: "ready" });

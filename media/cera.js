// @ts-check
// Webview-side script. Runs in an isolated browser context inside VS Code.
// Phase 0 skeleton: renders the raw Markdown text. The reveal-on-focus block
// model (parse -> render blocks -> click to edit source) lands in later phases.
(function () {
  const vscode = acquireVsCodeApi();
  const root = /** @type {HTMLElement} */ (document.getElementById("cera-document"));

  /** Render the document. For now, show raw text in a single pre block. */
  function render(text) {
    root.textContent = "";
    const pre = document.createElement("pre");
    pre.className = "cera-raw";
    pre.textContent = text.length > 0 ? text : "Empty document. Start typing in the underlying editor.";
    root.appendChild(pre);
  }

  // Messages arrive over VS Code's trusted host<->webview channel (the webview
  // is sandboxed and isolated; there is no cross-origin sender to validate).
  window.addEventListener("message", (event) => {
    const message = event.data;
    if (message.type === "update") {
      render(message.text);
    }
  });

  // Tell the extension host we're ready to receive the document.
  vscode.postMessage({ type: "ready" });
})();

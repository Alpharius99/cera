// Webview entry point. esbuild bundles this into media/cera.bundle.js, which the
// custom editor loads via a nonce under the strict CSP — no CDN, no inline script.
//
// Phase 1 read-only renderer (#5): parse the document into top-level blocks and
// render each to sanitized HTML, preserving block order and a stable index. The
// reveal-on-focus source editing (click a block to edit) lands in Phase 2.

import { parseBlocks } from "./blocks";
import { sanitizeHtml } from "./sanitize";
import { applyImagePolicy, ImagePolicy } from "./images";

interface VsCodeApi {
  postMessage(message: unknown): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

const vscode = acquireVsCodeApi();
const root = document.getElementById("cera-document") as HTMLElement;

// Image policy supplied by the host (CSP base URI + remote-image setting).
const policy: ImagePolicy = { remoteMode: "render", baseUri: "" };

/** Render the document as an ordered list of sanitized block elements. */
function render(text: string): void {
  root.textContent = "";

  const blocks = parseBlocks(text);
  if (blocks.length === 0) {
    const empty = document.createElement("p");
    empty.className = "cera-empty";
    empty.textContent = "Empty document. Start typing in the underlying editor.";
    root.appendChild(empty);
    return;
  }

  for (const block of blocks) {
    const el = document.createElement("div");
    el.className = "cera-block";
    el.dataset.blockIndex = String(block.index);
    el.dataset.blockType = block.type;
    // Sanitized: see sanitize.ts. markdown-it runs with html:false, and the
    // output is run through DOMPurify before injection (defense in depth).
    el.innerHTML = sanitizeHtml(block.html);
    // Resolve/guard images per the host's CSP + remote-image policy (#7).
    applyImagePolicy(el, policy);
    root.appendChild(el);
  }
}

// Messages arrive over VS Code's trusted host<->webview channel (the webview is
// sandboxed and isolated; there is no cross-origin sender to validate).
window.addEventListener("message", (event: MessageEvent) => {
  const message = event.data as {
    type: string;
    text?: string;
    baseUri?: string;
    remoteMode?: string;
  };
  if (message.type === "update" && typeof message.text === "string") {
    if (typeof message.baseUri === "string") {
      policy.baseUri = message.baseUri;
    }
    if (message.remoteMode === "render" || message.remoteMode === "placeholder") {
      policy.remoteMode = message.remoteMode;
    }
    render(message.text);
  }
});

// Tell the extension host we're ready to receive the document.
vscode.postMessage({ type: "ready" });

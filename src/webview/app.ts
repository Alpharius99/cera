import { parseBlocks } from "./blocks";
import { sanitizeHtml } from "./sanitize";
import { applyImagePolicy, ImagePolicy } from "./images";

/** Minimal host interface (VS Code's webview API surface Cera uses). */
export interface WebviewHost {
  postMessage(message: unknown): void;
}

/**
 * Mount the read-only renderer: render the document into `root` on each host
 * `update` message, and announce readiness. Returns a dispose function that
 * detaches the message listener — tests use it to avoid global leakage, and it
 * keeps the mount self-contained.
 */
export function mountWebview(
  root: HTMLElement,
  host: WebviewHost,
  target: EventTarget = window,
): () => void {
  // Image policy supplied by the host (CSP base URI + remote-image setting).
  const policy: ImagePolicy = { remoteMode: "render", baseUri: "" };

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
      el.dataset.blockKind = block.kind;
      // Sanitized: see sanitize.ts. markdown-it runs with html:false, and the
      // output is run through DOMPurify before injection (defense in depth).
      el.innerHTML = sanitizeHtml(block.html);
      // Resolve/guard images per the host's CSP + remote-image policy (#7).
      applyImagePolicy(el, policy);
      root.appendChild(el);
    }
  }

  // Messages arrive over VS Code's trusted host<->webview channel (the webview
  // is sandboxed and isolated; there is no cross-origin sender to validate).
  const onMessage = (event: Event): void => {
    const message = (event as MessageEvent).data as {
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
  };

  target.addEventListener("message", onMessage);

  // Tell the extension host we're ready to receive the document.
  host.postMessage({ type: "ready" });

  return () => target.removeEventListener("message", onMessage);
}

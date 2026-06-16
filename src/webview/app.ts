import { parseBlocks, Block } from "./blocks";
import { sanitizeHtml } from "./sanitize";
import { applyImagePolicy, ImagePolicy } from "./images";
import { BlockEditor, createBlockEditor } from "./editor";

/** Minimal host interface (VS Code's webview API surface Cera uses). */
export interface WebviewHost {
  postMessage(message: unknown): void;
}

export interface MountOptions {
  /** Event source for host messages (defaults to window). */
  target?: EventTarget;
  /** Editor factory (defaults to CodeMirror); injected in tests. */
  createEditor?: (doc: string, nonce: string) => BlockEditor;
  /** CSP nonce, forwarded to the editor for style injection. */
  nonce?: string;
}

/**
 * Mount the reveal-on-focus webview: render the document into `root` on each
 * host `update`, and open a source editor for a block when it is clicked (#8).
 * Returns a dispose function that detaches listeners and closes any open editor.
 */
export function mountWebview(root: HTMLElement, host: WebviewHost, options: MountOptions = {}): () => void {
  const target = options.target ?? window;
  const createEditor = options.createEditor ?? createBlockEditor;
  const nonce = options.nonce ?? "";

  const policy: ImagePolicy = { remoteMode: "render", baseUri: "" };
  let blocks: Block[] = [];
  let active: { el: HTMLElement; editor: BlockEditor; block: Block } | null = null;

  // Paint a block's rendered HTML into its element.
  function paintBlock(el: HTMLElement, block: Block): void {
    // Sanitized: see sanitize.ts. markdown-it runs with html:false, and the
    // output is run through DOMPurify before injection (defense in depth).
    el.innerHTML = sanitizeHtml(block.html);
    // Resolve/guard images per the host's CSP + remote-image policy (#7).
    applyImagePolicy(el, policy);
  }

  // Collapse the active editor back to the rendered view. Edits are discarded
  // for now; committing on close lands in #9.
  function closeActive(): void {
    if (!active) {
      return;
    }
    active.editor.destroy();
    active.el.classList.remove("cera-block--editing");
    paintBlock(active.el, active.block);
    active = null;
  }

  function render(text: string): void {
    closeActive();
    root.textContent = "";

    blocks = parseBlocks(text);
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
      paintBlock(el, block);
      root.appendChild(el);
    }
  }

  // Reveal-on-focus: click a rendered block to edit its raw Markdown source.
  function openEditor(blockEl: HTMLElement, block: Block): void {
    closeActive();
    const editor = createEditor(block.raw, nonce);
    blockEl.classList.add("cera-block--editing");
    blockEl.replaceChildren(editor.dom);
    editor.focus();
    active = { el: blockEl, editor, block };
  }

  const onClick = (event: Event): void => {
    const blockEl = (event.target as HTMLElement).closest<HTMLElement>(".cera-block");
    if (!blockEl) {
      // Clicked outside any block — collapse the open editor.
      closeActive();
      return;
    }
    if (blockEl === active?.el) {
      return;
    }
    const block = blocks[Number(blockEl.dataset.blockIndex)];
    if (block) {
      openEditor(blockEl, block);
    }
  };
  root.addEventListener("click", onClick);

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

  return () => {
    target.removeEventListener("message", onMessage);
    root.removeEventListener("click", onClick);
    closeActive();
  };
}

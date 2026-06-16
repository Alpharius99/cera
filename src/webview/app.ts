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
  let active: { el: HTMLElement; editor: BlockEditor; block: Block; baseVersion: number } | null = null;
  // Latest document state from the host. While a block is being edited, external
  // updates are deferred (not re-rendered) so the open editor is not destroyed.
  let latestText = "";
  let latestVersion = 0;

  // Paint a block's rendered HTML into its element.
  function paintBlock(el: HTMLElement, block: Block): void {
    // Sanitized: see sanitize.ts. markdown-it runs with html:false, and the
    // output is run through DOMPurify before injection (defense in depth).
    el.innerHTML = sanitizeHtml(block.html);
    // Resolve/guard images per the host's CSP + remote-image policy (#7).
    applyImagePolicy(el, policy);
  }

  // Collapse the active editor back to the rendered view without committing
  // (used by re-render, and as the final step of a commit).
  function destroyActive(): void {
    if (!active) {
      return;
    }
    active.editor.destroy();
    active.el.classList.remove("cera-block--editing");
    paintBlock(active.el, active.block);
    active = null;
  }

  // After committing a split (the editor stays open), re-tag the active block to
  // the text just committed so further edits target the now-larger range. The
  // host's #10 resolution rebases via originalText, which now sits in the doc.
  function retagActive(committedText: string): void {
    if (!active) {
      return;
    }
    const start = active.block.map[0];
    const lineCount = committedText.split(/\r?\n/).length;
    active.block = { ...active.block, raw: committedText, map: [start, start + lineCount] };
  }

  /**
   * Exit the active editor (#11). Always commits changed text. Collapse rules:
   * - single-block edit, or an `explicit` exit (× / navigation) → collapse;
   * - split edit with an implicit exit (Escape / blur) → persist but stay in
   *   source mode, so a blur can never silently discard or collapse a split.
   */
  function exitEditor(explicit: boolean): void {
    if (!active) {
      return;
    }
    const text = active.editor.getText();
    const changed = text !== active.block.raw;
    const split = parseBlocks(text).length > 1;
    const baseVersion = active.baseVersion;

    if (changed) {
      // The host resolves the range against the current document (#10) and
      // echoes an update (apply) or refreshes the webview (conflict).
      host.postMessage({
        type: "commit",
        startLine: active.block.map[0],
        endLine: active.block.map[1],
        text,
        baseVersion,
        originalText: active.block.raw,
      });
    }

    if (split && !explicit) {
      // Split + implicit exit: persist, stay in source mode.
      if (changed) {
        retagActive(text);
      }
      return;
    }

    destroyActive();
    // No commit means no host echo; if external edits arrived while editing,
    // catch the view up to the current document now.
    if (!changed && latestVersion !== baseVersion) {
      render(latestText);
    }
  }

  function render(text: string): void {
    destroyActive();
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
    const editor = createEditor(block.raw, nonce);
    blockEl.classList.add("cera-block--editing");

    // Explicit-exit affordance: always commits and collapses (even when split).
    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "cera-block-close";
    closeButton.title = "Done editing";
    closeButton.textContent = "×";
    closeButton.addEventListener("click", (event) => {
      event.stopPropagation();
      exitEditor(true);
    });

    blockEl.replaceChildren(editor.dom, closeButton);
    // Escape is an implicit exit: commits, and collapses unless the edit split
    // the block into several (#11).
    editor.dom.addEventListener("keydown", (event) => {
      if ((event as KeyboardEvent).key === "Escape") {
        event.preventDefault();
        exitEditor(false);
      }
    });
    editor.focus();
    // Tag the editor with the document version it was opened against (#10).
    active = { el: blockEl, editor, block, baseVersion: latestVersion };
  }

  const onClick = (event: Event): void => {
    const blockEl = (event.target as HTMLElement).closest<HTMLElement>(".cera-block");
    if (blockEl === active?.el) {
      return;
    }
    // A click elsewhere is an implicit (blur) exit. In split mode this commits
    // but keeps the editor open, so the new block is not opened.
    if (active) {
      const stayOpen = parseBlocks(active.editor.getText()).length > 1;
      exitEditor(false);
      if (stayOpen) {
        return;
      }
    }
    if (blockEl) {
      const block = blocks[Number(blockEl.dataset.blockIndex)];
      if (block) {
        openEditor(blockEl, block);
      }
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
      version?: number;
    };
    if (message.type === "update" && typeof message.text === "string") {
      if (typeof message.baseUri === "string") {
        policy.baseUri = message.baseUri;
      }
      if (message.remoteMode === "render" || message.remoteMode === "placeholder") {
        policy.remoteMode = message.remoteMode;
      }
      latestText = message.text;
      if (typeof message.version === "number") {
        latestVersion = message.version;
      }
      // Defer re-rendering while a block is being edited so the open editor is
      // not destroyed by an external change (#10); the commit reconciles.
      if (!active) {
        render(message.text);
      }
    }
  };
  target.addEventListener("message", onMessage);

  // VS Code keybindings don't reach the workbench while the webview is focused,
  // so forward undo/redo to the host from the rendered view. The block commits
  // are in VS Code's native undo history (#9), so this makes Cmd/Ctrl+Z work.
  // While a block is open, CodeMirror owns undo/redo for the in-progress edit.
  const onKeyDown = (event: KeyboardEvent): void => {
    if (active || !(event.metaKey || event.ctrlKey)) {
      return;
    }
    const key = event.key.toLowerCase();
    if (key === "z" && !event.shiftKey) {
      event.preventDefault();
      host.postMessage({ type: "undo" });
    } else if ((key === "z" && event.shiftKey) || key === "y") {
      event.preventDefault();
      host.postMessage({ type: "redo" });
    }
  };
  window.addEventListener("keydown", onKeyDown);

  // Tell the extension host we're ready to receive the document.
  host.postMessage({ type: "ready" });

  return () => {
    target.removeEventListener("message", onMessage);
    window.removeEventListener("keydown", onKeyDown);
    root.removeEventListener("click", onClick);
    destroyActive();
  };
}

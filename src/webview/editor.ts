import { EditorView, ViewPlugin, ViewUpdate, keymap } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { autocompletion, completionKeymap } from "@codemirror/autocomplete";
import { slashCompletions } from "./slash";
import { createSelectionBubble, SelectionBubble } from "./bubble";
import { TRANSFORMS, TransformName } from "./transforms";

/** A per-block source editor, abstracted so the webview wiring can be tested
 *  without constructing a real CodeMirror view. */
export interface BlockEditor {
  /** The editor's root element to mount into the block. */
  dom: HTMLElement;
  /** Current source text. */
  getText(): string;
  focus(): void;
  destroy(): void;
}

// Minimal, theme-native CodeMirror appearance. Generated as a nonced <style>
// (CSP-safe via EditorView.cspNonce); colors come from VS Code theme tokens.
const ceraTheme = EditorView.theme({
  "&": {
    // position:relative so the selection bubble (#16), appended to the editor
    // root, is positioned within the editor rather than the page.
    position: "relative",
    backgroundColor: "var(--vscode-editor-background)",
    color: "var(--vscode-editor-foreground)",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-content": {
    fontFamily: "var(--vscode-editor-font-family, monospace)",
    caretColor: "var(--vscode-editorCursor-foreground)",
  },
  ".cm-cursor": { borderLeftColor: "var(--vscode-editorCursor-foreground)" },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
    backgroundColor: "var(--vscode-editor-selectionBackground)",
  },
  // Slash menu (#14): styled to match VS Code's native suggest widget.
  ".cm-tooltip.cm-tooltip-autocomplete": {
    backgroundColor: "var(--vscode-editorSuggestWidget-background)",
    border: "1px solid var(--vscode-editorSuggestWidget-border, var(--vscode-editorWidget-border))",
    borderRadius: "5px",
  },
  ".cm-tooltip-autocomplete > ul > li": {
    color: "var(--vscode-editorSuggestWidget-foreground)",
    padding: "2px 6px",
  },
  ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
    backgroundColor: "var(--vscode-editorSuggestWidget-selectedBackground)",
    color: "var(--vscode-editorSuggestWidget-selectedForeground, var(--vscode-editorSuggestWidget-foreground))",
  },
  ".cm-completionDetail": {
    color: "var(--vscode-editorSuggestWidget-foreground)",
    opacity: "0.7",
    fontStyle: "normal",
  },
});

// Delay before the selection bubble appears after a selection settles (#16).
const BUBBLE_DELAY_MS = 200;

// Selection bubble: a floating formatting toolbar shown above a non-empty
// selection (#16). The bubble DOM lives in bubble.ts; this plugin owns the
// CodeMirror-specific glue — debounced show/hide, positioning, and applying a
// shared transform (#17) while restoring the selection.
const selectionBubble = ViewPlugin.fromClass(
  class {
    private readonly bubble: SelectionBubble;
    private timer: ReturnType<typeof setTimeout> | undefined;

    constructor(private readonly view: EditorView) {
      this.bubble = createSelectionBubble((name) => this.apply(name));
      view.dom.appendChild(this.bubble.dom);
    }

    update(update: ViewUpdate): void {
      if (update.selectionSet || update.docChanged || update.focusChanged) {
        this.schedule();
      }
    }

    private schedule(): void {
      clearTimeout(this.timer);
      const selection = this.view.state.selection.main;
      if (selection.empty || !this.view.hasFocus) {
        this.bubble.hide();
        return;
      }
      this.timer = setTimeout(() => this.position(), BUBBLE_DELAY_MS);
    }

    private position(): void {
      const selection = this.view.state.selection.main;
      const coords = this.view.coordsAtPos(selection.from);
      if (!coords) {
        this.bubble.hide();
        return;
      }
      const box = this.view.dom.getBoundingClientRect();
      // Reveal first so the bubble has measurable dimensions, then place it.
      this.bubble.showAt(0, 0);
      const height = this.bubble.dom.offsetHeight;
      const gap = 8;
      const left = Math.max(0, coords.left - box.left);
      // Prefer above the selection; flip below when there is no room (e.g. a
      // selection on the first line, which would otherwise clip off the top).
      const above = coords.top - box.top - height - gap;
      const top = above >= 0 ? above : coords.bottom - box.top + gap;
      this.bubble.showAt(left, top);
    }

    private apply(name: TransformName): void {
      const selection = this.view.state.selection.main;
      if (selection.empty) {
        return;
      }
      const doc = this.view.state.doc.toString();
      const result = TRANSFORMS[name](doc, { from: selection.from, to: selection.to });
      this.view.dispatch({
        changes: { from: 0, to: doc.length, insert: result.text },
        selection: { anchor: result.selection.from, head: result.selection.to },
      });
      this.view.focus();
    }

    destroy(): void {
      clearTimeout(this.timer);
      this.bubble.destroy();
    }
  },
);

/**
 * Create a CodeMirror 6 source editor seeded with `doc`. The CSP nonce lets
 * CodeMirror inject its theme styles under the strict webview CSP (#8).
 */
export function createBlockEditor(doc: string, nonce: string): BlockEditor {
  try {
    const view = new EditorView({
      state: EditorState.create({
        doc,
        extensions: [
          history(),
          // completionKeymap is listed first so the slash menu owns Up/Down/
          // Enter/Escape while it is open; when closed those commands no-op and
          // fall through to the default editing bindings (#14).
          keymap.of([...completionKeymap, ...defaultKeymap, ...historyKeymap]),
          markdown(),
          EditorView.lineWrapping,
          EditorView.cspNonce.of(nonce),
          autocompletion({ override: [slashCompletions], activateOnTyping: true, icons: false }),
          selectionBubble,
          ceraTheme,
        ],
      }),
    });
    return {
      dom: view.dom,
      getText: () => view.state.doc.toString(),
      focus: () => view.focus(),
      destroy: () => view.destroy(),
    };
  } catch {
    // Contingency only (not a user-facing option): if CodeMirror fails to
    // initialize, fall back to a plain textarea so the block stays editable.
    return createTextareaFallback(doc);
  }
}

function createTextareaFallback(doc: string): BlockEditor {
  const textarea = document.createElement("textarea");
  textarea.className = "cera-fallback-editor";
  textarea.value = doc;
  return {
    dom: textarea,
    getText: () => textarea.value,
    focus: () => textarea.focus(),
    destroy: () => textarea.remove(),
  };
}

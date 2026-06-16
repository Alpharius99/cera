import { EditorView, keymap } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { autocompletion, completionKeymap } from "@codemirror/autocomplete";
import { slashCompletions } from "./slash";

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

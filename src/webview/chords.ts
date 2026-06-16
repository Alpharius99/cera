import { TransformName } from "./transforms";

// Shortcut ownership matrix (#18). Before the chord overlay (#19) can dispatch
// modifier chords, we must decide who owns each one across three layers:
//   - VS Code keybindings (save, undo, find, clipboard, …)
//   - browser/webview defaults (clipboard, select-all)
//   - CodeMirror's keymap (history, select-all)
// The webview *claims* the formatting chords below: it runs the transform and
// calls preventDefault so nothing double-fires. Everything VS Code/the browser
// reserve is left alone (passed through). Each chord uses a letter key so its
// `KeyboardEvent.key` is layout-stable, and Shift disambiguates a claimed chord
// from a reserved one on the same letter (e.g. Mod+Shift+X vs Mod+X cut).

/** One row of the ownership matrix. */
export interface ChordRow {
  /** Lower-case `KeyboardEvent.key`, matched while Cmd/Ctrl (Mod) is held. */
  key: string;
  /** Whether Shift is part of the chord. */
  shift: boolean;
  /** `webview` claims and handles it; `vscode` chords pass through untouched. */
  owner: "webview" | "vscode";
  /** True only for claimed chords — the webview calls preventDefault. */
  preventDefault: boolean;
  /** The formatting action a claimed chord runs (webview-owned rows only). */
  action?: TransformName;
  /** What a reserved chord is for (vscode-owned rows only). */
  reservedFor?: string;
  /** Human-readable chord label, e.g. "B" or "Shift+X" (Mod prefix added by UI). */
  label: string;
}

// Webview-claimed formatting chords — one per shared transform (#17).
const CLAIMED: ChordRow[] = [
  { key: "b", shift: false, owner: "webview", preventDefault: true, action: "bold", label: "B" },
  { key: "i", shift: false, owner: "webview", preventDefault: true, action: "italic", label: "I" },
  { key: "k", shift: false, owner: "webview", preventDefault: true, action: "link", label: "K" },
  { key: "e", shift: false, owner: "webview", preventDefault: true, action: "inlineCode", label: "E" },
  { key: "x", shift: true, owner: "webview", preventDefault: true, action: "strikethrough", label: "Shift+X" },
  { key: "c", shift: true, owner: "webview", preventDefault: true, action: "codeBlock", label: "Shift+C" },
  { key: "u", shift: true, owner: "webview", preventDefault: true, action: "bulletList", label: "Shift+U" },
  { key: "o", shift: true, owner: "webview", preventDefault: true, action: "numberedList", label: "Shift+O" },
  { key: "l", shift: true, owner: "webview", preventDefault: true, action: "checklist", label: "Shift+L" },
];

// VS Code / browser / CodeMirror reserved chords — never intercepted (#18).
const RESERVED: ChordRow[] = [
  { key: "s", shift: false, owner: "vscode", preventDefault: false, reservedFor: "Save (VS Code)", label: "S" },
  { key: "z", shift: false, owner: "vscode", preventDefault: false, reservedFor: "Undo (VS Code)", label: "Z" },
  { key: "z", shift: true, owner: "vscode", preventDefault: false, reservedFor: "Redo (VS Code)", label: "Shift+Z" },
  { key: "y", shift: false, owner: "vscode", preventDefault: false, reservedFor: "Redo (VS Code)", label: "Y" },
  { key: "f", shift: false, owner: "vscode", preventDefault: false, reservedFor: "Find (VS Code)", label: "F" },
  { key: "c", shift: false, owner: "vscode", preventDefault: false, reservedFor: "Copy (browser)", label: "C" },
  { key: "x", shift: false, owner: "vscode", preventDefault: false, reservedFor: "Cut (browser)", label: "X" },
  { key: "v", shift: false, owner: "vscode", preventDefault: false, reservedFor: "Paste (browser)", label: "V" },
  { key: "a", shift: false, owner: "vscode", preventDefault: false, reservedFor: "Select all (CodeMirror)", label: "A" },
];

/** The full ownership matrix: claimed formatting chords + reserved chords. */
export const CHORD_MATRIX: ChordRow[] = [...CLAIMED, ...RESERVED];

/** The webview-claimed formatting chords (those the overlay lists, #19). */
export const CLAIMED_CHORDS: ChordRow[] = CLAIMED;

/**
 * Resolve a key event to its matrix row, if any. Only matches while Cmd/Ctrl is
 * held; Shift must match exactly so a claimed chord and a reserved chord on the
 * same letter stay distinct. A `webview` row means apply + preventDefault; a
 * `vscode` row means leave it alone; `undefined` means it is not in the matrix.
 */
export function matchChord(event: {
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  key: string;
}): ChordRow | undefined {
  if (!(event.metaKey || event.ctrlKey)) {
    return undefined;
  }
  const key = event.key.toLowerCase();
  return CHORD_MATRIX.find((row) => row.key === key && row.shift === event.shiftKey);
}

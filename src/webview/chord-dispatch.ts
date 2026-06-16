import { matchChord } from "./chords";
import { TransformName } from "./transforms";

// Minimal shape of a keydown event the dispatcher needs — a real KeyboardEvent
// satisfies it, and tests can pass a plain object with a preventDefault spy.
export interface ChordKeyEvent {
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  key: string;
  repeat: boolean;
  preventDefault(): void;
}

/**
 * Dispatch a keydown against the shortcut ownership matrix (#18, #19).
 *
 * - A webview-claimed formatting chord runs its transform exactly once and calls
 *   preventDefault (so it can't also fire via the browser/CodeMirror), then
 *   returns true.
 * - Reserved chords (save/undo/find/clipboard/…) and anything not in the matrix
 *   are left untouched — no preventDefault — and return false so they pass
 *   through to VS Code/CodeMirror.
 * - Auto-repeat (holding the key) is ignored so a chord fires once per press.
 */
export function handleChordKeydown(event: ChordKeyEvent, apply: (name: TransformName) => void): boolean {
  if (event.repeat) {
    return false;
  }
  const row = matchChord(event);
  if (!row || row.owner !== "webview" || !row.action) {
    return false;
  }
  event.preventDefault();
  apply(row.action);
  return true;
}

/** True when the event is a bare Cmd/Ctrl press (used to arm the hold overlay). */
export function isChordModifier(key: string): boolean {
  return key === "Meta" || key === "Control";
}

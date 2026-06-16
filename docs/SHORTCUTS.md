# Shortcut ownership matrix (#18)

Cera's source editor lives inside a focused webview, so three layers compete for
modifier chords. Before the chord overlay (#19) can dispatch anything, we decide
who owns each chord and resolve the conflicts. This document is the human form of
the machine-readable matrix in [`src/webview/chords.ts`](../src/webview/chords.ts);
the two are kept in lock-step and the test suite drives **one row per shortcut**.

## The three layers

- **VS Code keybindings** — Save, Undo/Redo, Find, etc. While the webview is
  focused these do **not** reach the workbench, but we still leave them alone so
  behaviour is predictable if/when focus returns.
- **Browser / webview defaults** — Clipboard (Copy/Cut/Paste) and Select-all.
  These must keep working; the webview never intercepts them.
- **CodeMirror keymap** — History and Select-all live here. The claimed
  formatting chords below are **not** in CodeMirror's keymap, so handling them in
  the webview cannot double-fire.

## Webview-claimed formatting chords

The webview runs the shared transform (#17) and calls `preventDefault`. All chords
are pressed with **Cmd** (macOS) / **Ctrl** (Windows/Linux) held.

| Chord            | Action          | preventDefault |
| ---------------- | --------------- | -------------- |
| Mod+B            | Bold            | yes            |
| Mod+I            | Italic          | yes            |
| Mod+K            | Link            | yes            |
| Mod+E            | Inline code     | yes            |
| Mod+Shift+X      | Strikethrough   | yes            |
| Mod+Shift+C      | Code block      | yes            |
| Mod+Shift+U      | Bullet list     | yes            |
| Mod+Shift+O      | Numbered list   | yes            |
| Mod+Shift+L      | Checklist       | yes            |

A letter key is used for every chord so `KeyboardEvent.key` is layout-stable, and
`Shift` disambiguates a claimed chord from a reserved one on the same letter
(e.g. **Mod+Shift+X** strikethrough vs **Mod+X** cut, **Mod+Shift+C** code block
vs **Mod+C** copy).

## Reserved chords (passed through, never intercepted)

| Chord       | Reserved for            |
| ----------- | ----------------------- |
| Mod+S       | Save (VS Code)          |
| Mod+Z       | Undo (VS Code)          |
| Mod+Shift+Z | Redo (VS Code)          |
| Mod+Y       | Redo (VS Code)          |
| Mod+F       | Find (VS Code)          |
| Mod+C       | Copy (browser)          |
| Mod+X       | Cut (browser)           |
| Mod+V       | Paste (browser)         |
| Mod+A       | Select all (CodeMirror) |

## Dispatch rule (for #19)

For a key event with Cmd/Ctrl held, look it up via `matchChord`:

- **`webview` row** → run `row.action` and `preventDefault` (fires exactly once).
- **`vscode` row** → do nothing, let it pass through.
- **no match** → not a chord; ignore.

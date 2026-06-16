# Architecture

Technical design for the Cera VS Code extension, and how the desktop app's
concepts map onto VS Code APIs.

## Overview

Cera is a webview-based **custom editor** for `.md` files. The extension host
(Node) owns the document and lifecycle; the webview (browser sandbox) owns
rendering and per-block source editing. They communicate over VS Code's
host↔webview message channel.

```
┌─────────────────────────── Extension Host (Node) ───────────────────────────┐
│ extension.ts            activate(), registers provider + command             │
│ ceraEditorProvider.ts   CustomTextEditorProvider                             │
│   • resolveCustomTextEditor(doc, panel)                                      │
│   • doc -> webview:  postMessage({type:"update", text})                      │
│   • webview -> doc:  WorkspaceEdit (undo/redo/save handled by VS Code)       │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                    │  postMessage / onDidReceiveMessage
┌──────────────────────────────────┴──── Webview (sandboxed browser) ──────────┐
│ media/cera.js     render loop, block model, reveal-on-focus, formatting UI    │
│ media/cera.css    zen layout + theme via --vscode-* CSS variables             │
└───────────────────────────────────────────────────────────────────────────────┘
```

## Desktop → VS Code mapping

| Desktop (C# / Avalonia)              | VS Code extension                                  |
|--------------------------------------|----------------------------------------------------|
| Avalonia `Window`                    | Webview panel inside a `CustomTextEditorProvider`  |
| `DocumentViewModel` / block list     | Block model built in the webview from markdown-it   |
| Markdig `UsePreciseSourceLocation()` | markdown-it + source-map plugin (line ranges)       |
| Markdown.Avalonia (render block)     | markdown-it render → sanitized HTML in webview      |
| AvaloniaEdit (edit source)           | CodeMirror 6 in webview (textarea fallback)         |
| `FormattingService`                  | Shared TS formatting module in the webview          |
| SlashCommandMenu / SelectionBubble / ChordOverlay | DOM overlays in the webview           |
| `IFileService` / save                | VS Code `TextDocument` + `WorkspaceEdit` + native save |
| Undo (open BUG-013 on desktop)       | Native VS Code undo/redo via `WorkspaceEdit`        |

A notable win: the desktop app has an open undo bug (AvaloniaEdit history resets
per block activation). Routing all edits through `WorkspaceEdit` gives correct,
document-wide undo/redo for free.

## Edit flow (reveal-on-focus)

1. Host sends document text to the webview.
2. Webview parses text → ordered blocks, each tagged with its source line range.
3. Webview renders blocks (rendered HTML).
4. User clicks a block → that block swaps to a CodeMirror source editor (push-down animation).
5. On commit (Esc / blur / close), the webview sends the new block text + its range.
6. Host splices it into the document with a `WorkspaceEdit`; VS Code updates dirty state and undo history.
7. Host re-sends updated text (or a targeted update); webview re-renders the affected block.

## Security

- Strict CSP: `default-src 'none'`, scripts only via nonce, styles only from `webview.cspSource`.
  From Phase 1, `img-src ${webview.cspSource} data: https:` (no `http:`); remote-image
  rendering is gated by the `cera.images.remote` setting (`render` | `placeholder`).
- `localResourceRoots` limited to `media/`.
- markdown-it runs with `html: false`; raw HTML blocks are shown as raw editable source,
  not rendered — avoids executing author-supplied HTML in the webview.
- Rendered Markdown HTML is sanitized (DOMPurify) before injection (defense in depth).
- The webview message listener trusts the host↔webview channel by design (sandboxed,
  isolated; no cross-origin sender exists). This is the documented VS Code webview pattern.

## Build & tooling

- **Language:** TypeScript (extension host and webview).
- **Build:** `tsc` for the host. The **webview bundle is built with esbuild from Phase 1**
  (not deferred to packaging) because webview deps can't load ad hoc under the strict CSP;
  Phase 10 adds `vsce` release packaging on top of the same bundler.
- **Parsing/render:** markdown-it with `html: false` (+ source-map, GFM plugins). Raw HTML
  blocks are shown as raw editable source, never rendered live. DOMPurify sanitizes the
  rendered Markdown HTML as defense in depth (author-controlled link/image attributes).
- **Source editor:** CodeMirror 6.
- **Tests:** **Vitest** (unit, introduced in Phase 1), `@vscode/test-electron` (integration), DOM tests (webview UI).

See [ROADMAP.md](ROADMAP.md) for the phased plan.

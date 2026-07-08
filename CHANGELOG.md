# Changelog

All notable changes to Cera are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project aims to
follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.0.6] - 2026-07-08

### Added

- Floating heading outline navigation overlay for quick document movement.

### Changed

- Block edit mode now opens only on double-click, leaving single-click text
  selection available in rendered blocks
  ([#53](https://github.com/Alpharius99/cera/issues/53)).

### Fixed

- Release workflow now creates the next patch release on every push to `main`,
  updates package metadata inside CI, builds a downloadable VSIX, and leaves VS
  Code Marketplace upload as a manual publisher-dashboard step.

## [0.0.4] - 2026-06-17

### Added

- **Cera Welcome panel** in the primary side bar, with a Cera icon in the
  Activity Bar ([#50](https://github.com/Alpharius99/cera/issues/50)). Offers
  **New Document**, **Open a Markdown File**, and **Open Current File in Cera**
  — a frictionless way to start editing in Cera.
- Marketplace gallery icon (`media/icon.png`).

### Changed

- Marketplace publisher set to `PavelSpakowski`.

## [0.0.1] - 2026-06-17

First pre-release build, distributed as a downloadable VSIX (not yet on the
Marketplace).

### Added

- Custom editor (`cera.markdownEditor`) for `.md` files, opt-in via **Reopen
  With…** or the **Cera: Open Current File in Cera Editor** command.
- Read-only rendered Markdown view: an ordered block model with stable source
  ranges, CommonMark + GFM rendering (tables, strikethrough, autolinks, task
  lists), sanitized with DOMPurify.
- Block classification — rendered, raw (front matter, raw HTML, link reference
  definitions), and special-case placeholders (mermaid/plantuml diagrams,
  placeholder-only for v1).
- Image policy: explicit `img-src` CSP (`cspSource`, `data:`, `https:`; no
  `http:`), workspace-relative paths resolved via `asWebviewUri`, and the
  `cera.images.remote` setting (`render` | `placeholder`).
- Theme-native styling driven entirely by `--vscode-*` tokens.
- Reveal-on-focus editing: click a block to edit its raw Markdown in a
  CodeMirror 6 editor (under the strict CSP), committed back to the document via
  `WorkspaceEdit` with native dirty/undo, preserving CRLF line endings.
- Block navigation and active-block affordances: keyboard navigation between
  blocks, a focus-border accent, and native VS Code codicon controls
  (previous / next / done) that mirror the keyboard.
- Formatting layer 1 — **slash commands**: a `/` menu at the start of a line
  (`/h1`–`/h6`, `/table`, `/code`, `/quote`, `/hr`, `/list`, `/checklist`) with
  fuzzy matching (e.g. `/tb` → table).
- Formatting layer 2 — **selection bubble**: a floating toolbar on selection
  with nine actions (bold, italic, link, strikethrough, inline code · code block
  · bullet / numbered / checklist); one-click apply keeps the selection,
  re-applying toggles off.
- Formatting layer 3 — **chord overlay**: hold Cmd/Ctrl to reveal a shortcut
  cheat-sheet and apply formatting by chord, dispatched against a documented
  shortcut-ownership matrix so reserved chords pass through to VS Code.
- Shared formatting transforms behind all three layers, with apply/toggle and
  single- and multi-line handling.
- Zen polish: centered reading column with the `cera.maxReadingWidth` setting,
  gentle active-block and overlay transitions, and `prefers-reduced-motion`
  support.
- Tooling: Vitest unit/UI/fidelity/theme suites, a `@vscode/test-electron`
  integration suite, a byte-for-byte fidelity corpus, and VSIX packaging.

### Known issues

- Redo does not re-apply a committed block edit after undo
  ([#33](https://github.com/Alpharius99/cera/issues/33)) — a VS Code platform
  behavior for redo of programmatic edits to a document shown only in a custom
  editor. Undo works normally.

[Unreleased]: https://github.com/Alpharius99/cera/compare/v0.0.6...HEAD
[0.0.6]: https://github.com/Alpharius99/cera/compare/v0.0.4...v0.0.6
[0.0.4]: https://github.com/Alpharius99/cera/compare/v0.0.3...v0.0.4
[0.0.1]: https://github.com/Alpharius99/cera/releases/tag/v0.0.1

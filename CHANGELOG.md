# Changelog

All notable changes to Cera are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project aims to
follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Custom editor (`cera.markdownEditor`) for `.md` files, opt-in via **Reopen
  With…** or the **Cera: Open Current File in Cera Editor** command.
- Read-only rendered Markdown view: an ordered block model with stable source
  ranges, CommonMark + GFM rendering (tables, strikethrough, autolinks, task
  lists), sanitized with DOMPurify.
- Block classification — rendered, raw (front matter, raw HTML, link reference
  definitions), and special-case placeholders (mermaid/plantuml diagrams).
- Image policy: explicit `img-src` CSP (`cspSource`, `data:`, `https:`; no
  `http:`), workspace-relative paths resolved via `asWebviewUri`, and the
  `cera.images.remote` setting (`render` | `placeholder`).
- Theme-native styling driven entirely by `--vscode-*` tokens.
- Reveal-on-focus editing: click a block to edit its raw Markdown in a
  CodeMirror 6 editor (under the strict CSP), committed back to the document via
  `WorkspaceEdit` with native dirty/undo/redo, preserving CRLF line endings.
- Tooling: Vitest unit/UI/fidelity/theme suites, a `@vscode/test-electron`
  integration suite, a byte-for-byte fidelity corpus, and VSIX packaging.

[Unreleased]: https://github.com/Alpharius99/cera-vscode/commits/main

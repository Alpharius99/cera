# Cera for VS Code — Roadmap (Draft)

A phased plan to port the [Cera desktop editor](https://github.com/Alpharius99/MarkItDown)
(C# / Avalonia) to a VS Code extension while preserving its core experience:
**reveal-on-focus block editing**, **zen-mode minimalism**, and **three invisible
formatting layers**.

This is a draft. Phases are ordered to keep the extension buildable and
demonstrable at every step. Each phase lists a **goal**, **scope**, and a
**done-when** check. Following the desktop project's convention: tests and docs
come before/with implementation, not after.

---

## Guiding principles (carried over from the desktop app)

1. **Zen mode first** — no toolbar, sidebar, or status bar inside the editor.
2. **Reveal-on-focus** — rendered Markdown by default; click a block to edit raw source.
3. **Complete visibility** — every byte of the file is shown, navigable, editable. Unrenderable blocks fall back to raw text, never hidden.
4. **Keyboard-driven** — every action reachable without the mouse.
5. **Theme-native** — inherit the user's VS Code theme via CSS variables; no hardcoded colors.
6. **Opt-in** — register as `priority: "option"` so default Markdown editing is never hijacked.

---

## Core technical decision

The desktop app renders blocks with Markdown.Avalonia and edits source with
AvaloniaEdit. The VS Code equivalent is a **webview-based `CustomTextEditorProvider`**:

- VS Code owns the `TextDocument` → free document sync, dirty tracking, **undo/redo, and save**.
- The webview owns rendering (rendered blocks) and per-block source editing.
- Parsing uses **markdown-it** (the same engine as VS Code's built-in preview) with a
  source-map plugin so each rendered block knows its line range in the raw text — this
  is the analog of Markdig's `UsePreciseSourceLocation()`.
- **Markdown flavor — decided: CommonMark + GFM** (tables, task lists, strikethrough,
  autolinks). The desktop app already supports tables and checklists, and GFM features
  drive later slash commands (`/table`, `/checklist`) and selection-bubble actions
  (strikethrough, lists). This is fixed before Phase 1 because it shapes the parser
  config, the block taxonomy, and the formatting transforms.
- Per-block source editing uses **CodeMirror 6** in the webview (syntax-highlighted,
  lightweight) — the analog of AvaloniaEdit. A `<textarea>` is the fallback if we want
  to defer CM6.

**Trade-off to revisit:** a webview custom editor gives full control over the
reveal-on-focus model but does not reuse VS Code's native text editor inside blocks
(multi-cursor, native find). CodeMirror recovers most of that within a block. This is
the same deliberate trade the desktop app made by going block-based instead of WYSIWYG.

---

## Phase 0 — Scaffold ✅ (this commit)

**Goal:** a buildable, installable empty extension.

- `package.json` manifest with `customEditors` contribution (`cera.markdownEditor`, `*.md`, opt-in).
- TypeScript build (`tsc`), `.vscode/launch.json` + `tasks.json` for F5 debugging.
- `CustomTextEditorProvider` that opens a webview, syncs document text → webview, and
  applies webview edits back as `WorkspaceEdit`s.
- Webview renders raw text in a centered, theme-aware zen column (placeholder render).
- CI (build), MIT license, README, this roadmap, ARCHITECTURE.

**Done when:** `npm run compile` succeeds; F5 opens a `.md` file in the Cera editor
showing its content in the zen column; the CI workflow (`.github/workflows/ci.yml`)
builds green on push/PR.

---

## Phase 1 — Rendered Markdown view (read-only)

**Goal:** the default view shows fully rendered Markdown, not raw text.

- Integrate **markdown-it** with a source-map plugin and GFM (tables, task lists,
  strikethrough, autolinks); parse the document into a list of top-level **blocks**
  (heading, paragraph, list, code fence, blockquote, table, HR, HTML, etc.).
- Render each block to HTML in the webview, preserving block order and a stable block index.
- Apply theme-native typography (headings, lists, code, tables, links) using VS Code CSS vars.
- Sanitize rendered HTML (e.g. DOMPurify) before injection — webview CSP stays strict.
- **Fixture:** `fixtures/sample.md` (imported from the desktop repo) is the acceptance
  artifact; extend it to exercise GFM tables, task lists, and strikethrough.
- **Tests (gate):** unit tests for the block parser and source-map — for each block type,
  assert the parsed block list and that each block's reported line range round-trips to its
  raw substring.

**Done when:** opening `fixtures/sample.md` renders all supported block types (incl. GFM)
correctly; editing the file elsewhere live-updates the rendered view; parser/source-map
tests pass in CI.

---

## Phase 2 — Reveal-on-focus block editing

**Goal:** click a rendered block → it expands to show raw Markdown source; commit on exit.

- Click handler maps the clicked DOM block → its source line range (from the source map).
- Replace the rendered block with a CodeMirror 6 source editor seeded with that block's raw text.
- VS Code/Xcode-style push-down expand animation (CSS height transition).
- **Commit** on Escape, blur (click outside), or explicit close → send the edited block
  text to the host, which splices it into the document via `WorkspaceEdit`, then re-renders.
- **Block splitting:** if an edit produces multiple blocks, stay in source mode until explicit exit.
- **Stale-range / concurrent-edit safety (critical):** Phase 1 live-updates from external
  edits, so the document can change while a block editor is open. Commit must not blindly
  overwrite a line range that has shifted. Approach: tag the open editor with the document
  version (`TextDocument.version`) and the original block text; on commit, if the version
  changed, re-resolve the block's current range (or rebase onto it) and abort with a notice
  if the block's own text was edited underneath. Never apply a range computed against a
  stale document.

**Done when:** a user can click any block, edit its source, and see it re-render on
commit; undo (Ctrl/Cmd+Z) reverts the edit through VS Code's native history; a test
proves an external edit elsewhere in the document while a block is open does **not**
corrupt or clobber unrelated content on commit.

---

## Phase 3 — Block navigation & active-block affordances

**Goal:** keyboard navigation between blocks with clear visual affordances (Visual Studio style).

- `Tab` / `Shift+Tab` commit the current block and move to next/previous; arrow keys stay within a block.
- `Ctrl/Cmd+↓` / `Ctrl/Cmd+↑` block navigation.
- Active block shows: 3–4px accent left border (`--vscode-focusBorder`), and right-aligned
  controls — **↓ next**, **↑ previous**, **× close**.

**Done when:** a user can move through the whole document via keyboard only, committing
each block as they go; the active block is unmistakable.

---

## Phase 4 — Formatting Layer 1: Slash commands

**Goal:** type `/` at line start to insert block-level Markdown.

- Inline (non-modal) autocomplete menu anchored at the caret inside the active source editor.
- Commands: `/h1`–`/h6`, `/table`, `/code`, `/quote`, `/hr`, `/list`, `/checklist`.
- Fuzzy matching (`/tb` → table); ↑/↓ navigate, Enter selects, Esc dismisses.
- **Tests (gate):** unit tests for the fuzzy matcher and for each command's inserted
  Markdown (snapshot the output for `/h1`–`/h6`, `/table`, `/code`, `/quote`, `/hr`,
  `/list`, `/checklist`).

**Done when:** each command inserts correct Markdown; fuzzy match and keyboard control
work; command-insertion tests pass in CI.

---

## Phase 5 — Formatting Layer 2: Selection bubble

**Goal:** select text → a floating toolbar appears above the selection.

- 9 buttons in 3 groups: **inline** (Bold, Italic, Link, Strikethrough, Code) ‖
  **block** (Code Block) ‖ **lists** (Bullet, Numbered, Checklist). (The desktop docs say
  "8 buttons" but list 9 — 9 is correct.)
- Appears ~200ms after selection; semi-transparent until hovered; single click applies and keeps selection.
- Toggle semantics (e.g. bold on/off; list prefixes multi-line aware), mirroring the desktop `FormattingService`.
- **Tests (gate):** unit tests for the formatting transforms — each action's apply **and**
  toggle-off, on single-line and multi-line selections (the formatting module is shared
  with Phases 4 and 6, so this is the core regression suite for all three layers).

**Done when:** all 9 actions apply/toggle correctly on single- and multi-line selections;
formatting-transform tests pass in CI.

---

## Phase 6 — Formatting Layer 3: Chord overlay

**Goal:** hold `Cmd`/`Ctrl` for 500ms → a centered overlay lists available shortcuts.

- Reactive overlay, no persistent state; dismisses instantly on modifier release.
- Pressing a key while the modifier is held applies the action.
- Power users who release before 500ms never see it.
- **Shortcut ownership matrix (prerequisite):** before implementing, document who owns each
  chord across three layers — VS Code keybindings, the webview/browser defaults, and
  CodeMirror's keymap — and resolve conflicts. Bindings the webview claims (e.g. Cmd/Ctrl+B,
  I, K) must `preventDefault` and be excluded from CodeMirror's keymap so they don't double-fire;
  bindings VS Code reserves (Cmd/Ctrl+S, Z, F) stay with VS Code. The matrix is a Phase-6
  deliverable, not an afterthought.

**Done when:** holding the modifier reveals shortcuts; chorded keys apply formatting; quick
release shows nothing; no chord double-fires or is swallowed by VS Code/CodeMirror per the matrix.

---

## Phase 7 — Complete visibility & fidelity

**Goal:** never hide or mangle content the renderer can't handle.

- **Spec-renderable** blocks → rendered.
- **Unrenderable** blocks (link reference definitions, raw HTML blocks, front matter) →
  shown as raw text with distinct `raw-text-block` styling, still navigable/editable.
- **Special-case** blocks (e.g. Mermaid diagrams) → placeholder with click-to-edit hint.
- Round-trip guarantee: open → no edits → save produces a byte-identical file.

**Done when:** a fidelity test corpus round-trips byte-for-byte; unrenderable blocks are
visible and editable.

---

## Phase 8 — Zen polish & theming

**Goal:** the editor feels calm and native across themes.

- Centered reading column, generous line height, no chrome inside the editor surface.
- Verify light/dark/high-contrast themes via VS Code CSS variables.
- Smooth expand/collapse and selection-bubble transitions.
- Optional setting: max reading-column width.

**Done when:** the editor looks correct and cohesive across the built-in themes.

---

## Phase 9 — Test hardening & integration

**Goal:** consolidate coverage and add the layers that need a running VS Code, on top of
the per-phase unit gates already written in Phases 1–8.

> Note: unit tests are **not** deferred here. Each phase above ships its own unit gate
> (parser/source-map in P1, splice & concurrent-edit safety in P2, command insertion in P4,
> formatting transforms in P5). This phase adds the cross-cutting and host-driven tests.

- **Integration:** `@vscode/test-electron` driving the custom editor end-to-end (open, edit,
  commit, save, undo, external-edit-while-open).
- **Webview UI:** DOM-level tests for block activation, navigation, slash menu, selection bubble, chord overlay.
- **Fidelity:** byte-for-byte round-trip corpus from Phase 7.
- **Coverage check:** ensure every phase's unit gate is wired into the CI suite.

**Done when:** CI runs the full suite (unit + integration + UI + fidelity) green on every PR.

---

## Phase 10 — Packaging & publishing

**Goal:** shippable extension.

- Bundle with **esbuild**; `vsce package` → `.vsix`.
- Marketplace listing (icon, README, screenshots/GIFs), Open VSX for VSCodium.
- Release workflow: tag → build `.vsix` → attach to GitHub Release (+ Marketplace publish).
- Versioning and CHANGELOG.

**Done when:** a tagged release produces a `.vsix` and a published Marketplace version.

---

## Out of scope (for now)

- Multi-document tabs/split inside one Cera surface (VS Code already provides tabs).
- WYSIWYG inline editing within rendered blocks (the reveal-on-focus model is the
  deliberate alternative).
- Non-`.md` formats.

## Open questions

1. **CodeMirror 6 vs. textarea** for per-block source editing in Phase 2 — start with CM6 or defer?
2. **Diagrams** — port Mermaid support, or placeholder-only for v1?
3. **Marketplace publisher** — reuse `Alpharius99`, or register a dedicated publisher ID?

_Resolved:_ Markdown flavor — **CommonMark + GFM** (see Core technical decision).

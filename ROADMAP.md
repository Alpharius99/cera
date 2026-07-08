# Cera for VS Code — Roadmap (Draft)

A phased plan to port the [Cera desktop editor](https://github.com/Alpharius99/MarkItDown)
(C# / Avalonia) to a VS Code extension while preserving its core experience:
**reveal-on-focus block editing**, **zen-mode minimalism**, and **three invisible
formatting layers**.

The source project is private. Use [docs/MARKITDOWN-MIGRATION.md](docs/MARKITDOWN-MIGRATION.md)
as the migration reference map: it links the MarkItDown files and tests that
should be consulted for each phase.

This is a draft. Phases are ordered to keep the extension buildable and
demonstrable at every step. Each phase lists a **goal**, **scope**, and a
**done-when** check. Following the desktop project's convention: tests and docs
come before/with implementation, not after.

---

## Guiding principles (carried over from the desktop app)

1. **Zen mode first** — no toolbar, sidebar, or status bar inside the editor.
2. **Reveal-on-focus** — rendered Markdown by default; double-click a block to edit raw source.
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
- Parsing uses **markdown-it** (the same engine as VS Code's built-in preview). Block-level
  tokens natively carry a `.map = [startLine, endLine]` line range (this is what VS Code's
  own preview-sync uses) — the analog of Markdig's `UsePreciseSourceLocation()`. No extra
  plugin is required for block ranges; **the precision of these ranges is validated by a
  Phase 1 spike** (see below) because some constructs (loose lists, nested blockquotes, GFM
  tables, raw HTML, front matter) can report coarse or missing maps.
- **Markdown flavor — decided: CommonMark + GFM** (tables, task lists, strikethrough,
  autolinks). The desktop app already supports tables and checklists, and GFM features
  drive later slash commands (`/table`, `/checklist`) and selection-bubble actions
  (strikethrough, lists). This is fixed before Phase 1 because it shapes the parser
  config, the block taxonomy, and the formatting transforms.
- Per-block source editing uses **CodeMirror 6** in the webview (syntax-highlighted,
  lightweight) — the analog of AvaloniaEdit. A `<textarea>` is the fallback if we want
  to defer CM6.
- **Webview asset pipeline (from Phase 1, not Phase 10):** webview-side deps (markdown-it,
  GFM plugins, DOMPurify, later CodeMirror) cannot be loaded ad hoc under the strict CSP
  (`script-src 'nonce-…'`, no `unsafe-inline`/CDN). They are **bundled with esbuild** into a
  single nonce-loaded `media/cera.bundle.js`. This bundler is set up in Phase 1 and reused
  through Phase 10; Phase 10 only adds release packaging (`vsce`) on top of it.

Before starting a phase, read that phase's MarkItDown source/test list in
[docs/MARKITDOWN-MIGRATION.md](docs/MARKITDOWN-MIGRATION.md). The source repo is
the behavior reference; this repo's roadmap and architecture define the VS Code
translation.

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

- **Asset pipeline (first task):** set up the **esbuild** webview bundle
  (`media/cera.bundle.js`), loaded via nonce under the existing strict CSP. All webview
  deps go through it — no CDN, no inline scripts.
- Integrate **markdown-it** with GFM (tables, task lists, strikethrough, autolinks) and use
  block tokens' native `.map` ranges; parse the document into a list of top-level **blocks**
  (heading, paragraph, list, code fence, blockquote, table, HR, HTML, etc.).
- **Source-map spike (selection gate — do first, blocks Phase 2):** verify that every block
  type in `fixtures/sample.md` (esp. loose lists, nested blockquotes, GFM tables, raw HTML,
  front matter) yields a `.map` range whose raw substring round-trips exactly. Define the
  **fallback** for any construct with coarse/missing maps: treat that block as **atomic**
  (re-derive its range by re-tokenizing on commit, edit the whole block, never splice a
  partial range). If `.map` proves too coarse across the board, the gate's exit criterion is
  to adopt an alternative ranging approach before committing to Phase 2's splice design.
- Render each renderable block to HTML in the webview, preserving block order and a stable block index.
- **HTML-block policy (decided here — product/security, not polish):** raw HTML blocks are
  **not** rendered as live HTML. They are shown as **raw, editable source** with
  `raw-text-block` styling (consistent with Phase 7's "complete visibility"). Rationale:
  rendering arbitrary author HTML in the webview is an XSS/fidelity risk; showing source is
  safe, faithful, and editable. markdown-it's `html` option stays **off**.
- Sanitize rendered Markdown HTML (DOMPurify) before injection — defense in depth even with
  `html` off, since link/image attributes are still author-controlled.
- **Image policy + CSP `img-src` (decided here):** the strict CSP must add an explicit
  `img-src` or images silently fail. Policy: allow `${webview.cspSource}` (local/workspace
  images), `data:` (inline), and `https:` (remote). Remote images are a privacy/tracking
  vector, so this is paired with a setting `cera.images.remote` (`render` | `placeholder`);
  default **render**, with `placeholder` swapping remote `<img>` for a click-to-load chip.
  Workspace-relative image paths are resolved via `webview.asWebviewUri`. `http:` is **not**
  allowed (no mixed/insecure content).
- **Fixture:** `fixtures/sample.md` (imported from the desktop repo) is the acceptance
  artifact. It is annotated: the "Inline Extensions" section (`++ins++`, `==mark==`, sub/sup,
  emoji shortcodes) is **non-GFM** and must render as literal text — these double as Phase 7
  negative/raw cases, not supported features.
- **Test infrastructure (first gated phase — set up here):** add the test runner (**Vitest**),
  an `npm test` script, and wire `npm test` into `.github/workflows/ci.yml`.
- **Tests (gate):** unit tests for the block parser and source-map — for each block type,
  assert the parsed block list and that each block's reported line range round-trips to its
  raw substring; assert HTML blocks, YAML front matter, and the non-GFM extensions render as
  literal source.
- **Tests (gate) — images:** assert the emitted CSP contains `img-src ${cspSource} data: https:`
  and excludes `http:`; assert a workspace-relative image resolves via `asWebviewUri`, a
  `data:` image is allowed, and an `https:` image is allowed; assert `cera.images.remote =
  placeholder` replaces remote `<img>` with the click-to-load chip while local/`data:` images
  still render.

**Done when:** opening `fixtures/sample.md` renders all supported block types (incl. GFM)
correctly and shows HTML/front-matter/non-GFM content as literal source; images render per
the CSP/`cera.images.remote` policy; editing the file elsewhere live-updates the rendered
view; `npm test` runs parser, source-map, and image-policy tests green in CI.

---

## Phase 2 — Reveal-on-focus block editing

**Goal:** double-click a rendered block → it expands to show raw Markdown source; commit on exit.

- Double-click handler maps the clicked DOM block → its source line range (from the source map).
- Replace the rendered block with a CodeMirror 6 source editor seeded with that block's raw text.
- VS Code/Xcode-style push-down expand animation (CSS height transition).
- **Two distinct actions — *commit* (persist text to the document) vs *collapse* (re-render
  back to view mode).** Separating them resolves the split-mode rule below.
  - **Single-block mode (the edit still maps to one block):** Escape, blur (click outside),
    and explicit close all **commit + collapse**.
  - **Split mode (the edit produced multiple blocks):** Escape and blur **commit but do NOT
    collapse** — the edited text is persisted via `WorkspaceEdit` (never lost), but the source
    editor stays open over the now-multiple blocks. Only an **explicit exit** —the `×` close
    button or navigating away (Tab / `Ctrl/Cmd+↑↓`)— commits and then collapses/re-renders.
  This honors "stay in source mode until explicit exit" without ever risking unsaved edits,
  and gives Escape a single unambiguous meaning (always commit; collapse only when not split).
- **Stale-range / concurrent-edit safety (critical):** Phase 1 live-updates from external
  edits, so the document can change while a block editor is open. Commit must not blindly
  overwrite a line range that has shifted. Approach: tag the open editor with the document
  version (`TextDocument.version`) and the original block text; on commit, if the version
  changed, re-resolve the block's current range (or rebase onto it) and abort with a notice
  if the block's own text was edited underneath. Never apply a range computed against a
  stale document.

**Done when:** a user can double-click any block, edit its source, and see it re-render on
commit; undo (Ctrl/Cmd+Z) reverts the edit through VS Code's native history; a test
proves an external edit elsewhere in the document while a block is open does **not**
corrupt or clobber unrelated content on commit; a test proves that after an edit splits a
block, Escape/blur persist the text but keep source mode, and only explicit exit collapses.

---

## Phase 3 — Block navigation & active-block affordances

**Goal:** keyboard navigation between blocks with clear visual affordances (Visual Studio style).

- `Tab` / `Shift+Tab` commit the current block and move to next/previous; arrow keys stay within a block.
- `Ctrl/Cmd+↓` / `Ctrl/Cmd+↑` block navigation.
- **Navigation-key ownership (define here, ahead of the Phase 6 matrix):** when CodeMirror is
  active in a block it claims `Tab` (indentation) and the arrow keys. Decide per key: `Tab`/
  `Shift+Tab` are **removed from CodeMirror's keymap** so they always mean block-move (a
  block is one logical "field"); arrow keys **stay with CodeMirror** for in-block caret motion
  and only cross block boundaries when the caret is at the block's first/last line; the
  `Ctrl/Cmd+↑/↓` block-nav chords are global and excluded from CodeMirror. These rows feed
  directly into the Phase 6 ownership matrix.
- Active block shows: 3–4px accent left border (`--vscode-focusBorder`), and right-aligned
  controls — **↓ next**, **↑ previous**, **× close**.
- **Tests (gate):** unit/DOM tests for the navigation state machine — Tab/Shift+Tab and
  Ctrl/Cmd+↑/↓ move the active index correctly, commit-on-move fires, arrow keys stay within
  a block, and wraparound/edge behavior at first/last block is correct.

**Done when:** a user can move through the whole document via keyboard only, committing
each block as they go; the active block is unmistakable; navigation tests pass in CI.

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
- **Tests (gate):** DOM tests asserting each webview-owned chord applies exactly once and
  calls `preventDefault` (no double-fire via CodeMirror), and that reserved chords are not
  intercepted — one test row per entry in the ownership matrix.

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
- **Tests (gate):** a fidelity corpus (built from `fixtures/sample.md` plus the non-GFM
  negative cases and tricky edge cases) where each file asserts byte-for-byte round-trip,
  and the classifier assigns each block to rendered / raw / special-case as expected.

**Done when:** the fidelity corpus round-trips byte-for-byte in CI; unrenderable blocks are
visible and editable.

---

## Phase 8 — Zen polish & theming

**Goal:** the editor feels calm and native across themes.

- Centered reading column, generous line height, no chrome inside the editor surface.
- Verify light/dark/high-contrast themes via VS Code CSS variables.
- Smooth expand/collapse and selection-bubble transitions.
- Optional setting: max reading-column width.
- **Tests (gate):** an automated guard that fails on hardcoded colors in `media/` (only
  `var(--vscode-*)` tokens allowed), plus an integration smoke test that renders the editor
  under light/dark/high-contrast variants and asserts it mounts without errors. (Pixel-level
  visual checks remain manual.)

**Done when:** the editor looks correct and cohesive across the built-in themes; the
no-hardcoded-color guard and theme smoke test pass in CI.

---

## Phase 9 — Test hardening & integration

**Goal:** consolidate coverage and add the layers that need a running VS Code, on top of
the per-phase unit gates already written in Phases 1–8.

> Note: unit tests are **not** deferred here. Each phase above ships its own gate —
> parser/source-map (P1), splice & concurrent-edit safety (P2), navigation state machine
> (P3), command insertion (P4), formatting transforms (P5), shortcut-conflict behavior (P6),
> fidelity corpus (P7), no-hardcoded-color guard (P8). This phase adds the cross-cutting and
> host-driven tests on top.

- **Integration:** `@vscode/test-electron` driving the custom editor end-to-end (open, edit,
  commit, save, undo, external-edit-while-open).
- **Webview UI:** DOM-level tests for block activation, navigation, slash menu, selection bubble, chord overlay.
- **Fidelity:** byte-for-byte round-trip corpus from Phase 7.
- **Coverage check:** ensure every phase's unit gate is wired into the CI suite.

**Done when:** CI runs the full suite (unit + integration + UI + fidelity) green on every PR.

---

## Phase 10 — Packaging & publishing

**Goal:** shippable extension.

- Reuse the existing Phase-1 **esbuild** bundle (production/minified config); `vsce package` → `.vsix`.
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

_None outstanding._

_Resolved:_
- **Marketplace publisher** — publishing as **Pavel Spakowski** (publisher ID `PavelSpakowski`).
- **Diagrams (#31)** — **placeholder-only for v1.** `mermaid` and `plantuml` fences render as
  a labeled, read-only placeholder showing the raw source; any other fenced language renders
  as a normal code block. No diagram engine runs in the webview (keeps the strict CSP and
  byte-for-byte fidelity); live rendering is deferred past v1.
- Markdown flavor — **CommonMark + GFM** (see Core technical decision).
- Per-block source editor — **CodeMirror 6** (the Core decision fixes this; `<textarea>` is
  only an internal fallback if a CM6 integration risk surfaces during the Phase 1 spike, not
  an open product choice).

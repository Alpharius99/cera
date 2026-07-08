# Cera for VS Code - Roadmap

Last updated: 2026-07-08

Cera is a distraction-free, reveal-on-focus Markdown editor for VS Code. The
original Phase 0-10 implementation roadmap is now complete: the extension has a
rendered block model, CodeMirror-backed source editing, all three formatting
layers, fidelity and integration tests, VSIX packaging, and automatic GitHub
Release builds.

This roadmap now tracks the work after the pre-release baseline.

## Current status

**Release:** `0.0.6` pre-release

**Distribution:** downloadable VSIX attached to GitHub Releases. Marketplace
upload is still manual.

**Implementation baseline:**

- Opt-in `CustomTextEditorProvider` for `*.md` files.
- Rendered Markdown block view using CommonMark + GFM.
- Raw visibility for front matter, raw HTML, link reference definitions, and
  unsupported inline extensions.
- Placeholder-only diagram fences for `mermaid` and `plantuml`.
- Strict webview CSP, DOMPurify sanitization, workspace/data/https image policy,
  and the `cera.images.remote` setting.
- Reveal-on-focus block editing with CodeMirror 6.
- Block navigation, active-block controls, double-click activation, and a
  floating heading outline.
- Formatting layers: slash commands, selection bubble, and chord overlay.
- Theme-native styling enforced by tests.
- Vitest unit/UI/fidelity/theme suites and `@vscode/test-electron` integration
  coverage.
- Release workflow that creates the next patch release on every push to `main`,
  builds `cera.vsix`, uploads it as an artifact, and attaches it to a GitHub
  Release.

## Guiding principles

1. **Zen mode first** - no toolbar, sidebar, or status bar inside the editor.
2. **Reveal-on-focus** - rendered Markdown by default; double-click a block to
   edit raw source.
3. **Complete visibility** - every byte of the file is shown, navigable, and
   editable. Unrenderable blocks fall back to raw text, never hidden.
4. **Keyboard-driven** - every action reachable without the mouse.
5. **Theme-native** - inherit the user's VS Code theme via CSS variables.
6. **Opt-in** - register as `priority: "option"` so default Markdown editing is
   never hijacked.

## Near-term roadmap

### 1. Public listing readiness

**Goal:** make the current VSIX suitable for a first public Marketplace/Open VSX
listing.

**Tracking:** [#58](https://github.com/Alpharius99/cera/issues/58)

- Capture screenshots or short GIFs for the reveal-on-focus flow, slash menu,
  selection bubble, chord overlay, heading outline, and theme-native rendering.
- Add listing media under `media/` and reference it from `README.md`.
- Run the local packaging review (`npm run package` and `npx @vscode/vsce ls`)
  before the first upload.
- Clarify the Open VSX path: manual upload for parity with Marketplace, or token
  based automation after account/secrets setup.

**Done when:** the README renders as a usable listing page, the packaged VSIX has
the expected files, and the first public listing path is documented.

### 2. Publishing workflow follow-through

**Goal:** turn the release artifacts into public extension listings without
changing the extension build.

**Tracking:** [#59](https://github.com/Alpharius99/cera/issues/59)

- Download the VSIX from the GitHub Release for the version being published.
- Upload the exact release artifact to the VS Code Marketplace publisher portal.
- Publish the same version to Open VSX once the account/path is confirmed.
- Record any one-time account or token setup in `docs/PUBLISHING.md` and
  `RELEASING.md`.

**Done when:** users can install Cera from the public extension registries, and
the docs describe how to repeat the release.

### 3. First-run discoverability

**Goal:** help new users find the editor and core interactions without adding
persistent chrome to the editor surface.

**Tracking:** [#60](https://github.com/Alpharius99/cera/issues/60)

- Evaluate a VS Code walkthrough or a richer Welcome panel flow.
- Add a sample-document entry point that opens a Markdown file demonstrating
  reveal-on-focus editing, formatting layers, raw blocks, and diagram
  placeholders.
- Keep all guidance outside the editing surface so the zen editor remains quiet.

**Done when:** a first-time user can install Cera, open a useful sample or their
own Markdown file, and discover double-click editing plus keyboard formatting
from VS Code-native entry points.

### 4. Editor quality backlog

**Goal:** keep the shipped editor reliable as VS Code and its webview/custom
editor APIs evolve.

**Tracking:** [#61](https://github.com/Alpharius99/cera/issues/61)

- Re-evaluate the known redo limitation for programmatic `WorkspaceEdit` commits
  in custom editors. Issue #33 is closed as documented behavior, but it should
  be checked again against newer VS Code APIs before a stable release.
- Preserve the current rule that undo works normally and redo must not be
  simulated by maintaining a second, extension-owned document history unless the
  behavior can be proven correct.
- Continue expanding integration coverage only where real regressions or release
  risks appear.

**Done when:** the known limitation has either a verified platform workaround or
an up-to-date decision record saying why it remains documented behavior.

### 5. Post-v1 feature exploration

**Goal:** explore enhancements that are intentionally outside the first stable
release.

**Tracking:** [#62](https://github.com/Alpharius99/cera/issues/62)

- Optional live diagram rendering for `mermaid`/`plantuml`, gated behind a
  security and CSP review. The current v1 policy remains placeholder-only.
- Additional Markdown authoring affordances that preserve the reveal-on-focus
  model and do not introduce persistent editor chrome.
- Import/export or sharing helpers only if they fit VS Code workflows better
  than external Markdown tooling.

**Done when:** each candidate has a short design note and either a scoped issue
ready for implementation or a clear decision to defer.

## Out of scope for now

- Multi-document tabs or split panes inside one Cera surface. VS Code already
  provides tabs and editor groups.
- WYSIWYG inline editing within rendered blocks. The reveal-on-focus model is the
  deliberate alternative.
- Non-`.md` formats.
- Running arbitrary diagram or HTML code in the webview without a security
  review.

## Completed implementation history

- **Phase 0 - Scaffold:** extension manifest, custom editor shell, TypeScript
  build, launch/tasks, CI, README, architecture, and roadmap.
- **Phase 1 - Rendered Markdown view:** bundled webview assets, block parser,
  GFM rendering, raw HTML/front-matter policy, image CSP, fixtures, and tests.
- **Phase 2 - Reveal-on-focus editing:** CodeMirror block editor, safe document
  splicing, stale-range handling, split-block behavior, and undo integration.
- **Phase 3 - Block navigation:** keyboard movement, active-block affordances,
  and navigation tests.
- **Phase 4 - Slash commands:** fuzzy command menu and block insertion
  transforms.
- **Phase 5 - Selection bubble:** floating formatting toolbar and shared
  formatting transforms.
- **Phase 6 - Chord overlay:** shortcut ownership matrix and modifier-key
  overlay.
- **Phase 7 - Complete visibility:** raw/special-case block classification and
  byte-for-byte fidelity corpus.
- **Phase 8 - Zen polish and theming:** theme-native styling, max reading width,
  transitions, and color guards.
- **Phase 9 - Test hardening and integration:** unit, UI, fidelity, theme, and
  Extension Host integration gates.
- **Phase 10 - Packaging and release:** VSIX packaging, changelog/release
  metadata, GitHub Release artifacts, and manual Marketplace upload flow.

## Reference docs

- [README.md](README.md) - user-facing overview and install instructions.
- [ARCHITECTURE.md](ARCHITECTURE.md) - technical design and VS Code mapping.
- [docs/MARKITDOWN-MIGRATION.md](docs/MARKITDOWN-MIGRATION.md) - source-project
  reference map for porting behavior from MarkItDown.
- [docs/PUBLISHING.md](docs/PUBLISHING.md) - listing readiness and account tasks.
- [RELEASING.md](RELEASING.md) - release workflow and manual upload steps.
- [CHANGELOG.md](CHANGELOG.md) - release notes.

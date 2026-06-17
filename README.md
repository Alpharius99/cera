# Cera for VS Code

A distraction-free, **reveal-on-focus** Markdown editor for Visual Studio Code.

Cera is a port of the [Cera desktop editor](https://github.com/Alpharius99/MarkItDown)
(C# / Avalonia) to a VS Code extension. Same philosophy: see fully rendered
Markdown, click a block to edit its raw source, and never fight a toolbar.
The source project is private; migration notes and source-file pointers live in
[docs/MARKITDOWN-MIGRATION.md](docs/MARKITDOWN-MIGRATION.md).

> **Status:** Pre-release. The reveal-on-focus block model and all three
> formatting layers — slash commands, the selection bubble, and the chord
> overlay — are implemented. See the [Roadmap](ROADMAP.md) for what's next.

## Philosophy

**Zen mode first.** No toolbar, no sidebar, no status bar — just your text in a
centered reading column that inherits your VS Code theme.

- **Reveal-on-focus editing** — rendered Markdown by default; click a block to reveal raw source
- **Block granularity** — edit one block at a time (paragraph, heading, list, code, table…)
- **Keyboard-driven** — three invisible formatting layers (slash commands, selection bubble, chord overlay)
- **Complete visibility** — every byte of the file is shown; nothing is hidden

## How it works

Cera registers a **custom editor** (`cera.markdownEditor`) for `.md` files. It is
opt-in (`priority: "option"`): your default Markdown editing is untouched. Open a
file with Cera via **Reopen With…** in the editor menu, or run the command
**"Cera: Open Current File in Cera Editor"**.

Under the hood it is a `CustomTextEditorProvider` over the raw Markdown text, so
VS Code handles document sync, dirty state, undo/redo, and save natively.

## Formatting

Three invisible layers, all sharing one set of transforms:

- **Slash commands** — at the start of a line in a block's source, type `/` for a
  menu: `/h1`–`/h6`, `/table`, `/code`, `/quote`, `/hr`, `/list`, `/checklist`
  (fuzzy, so `/tb` finds the table).
- **Selection bubble** — select text to get a floating toolbar: bold, italic,
  link, strikethrough, code · code block · bullet/numbered/checklist. One click
  applies and keeps your selection; re-applying toggles off.
- **Chord overlay** — hold **Cmd/Ctrl** to reveal a shortcut cheat-sheet; press a
  key to apply (e.g. **⌘B** bold, **⌘K** link). Reserved chords (save, undo,
  find, clipboard) always pass through to VS Code.

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `cera.maxReadingWidth` | `740` | Maximum width (px) of the centered reading column. |
| `cera.images.remote` | `render` | `render` loads remote (https) images; `placeholder` shows a click-to-load chip instead. Local and `data:` images always render. |

## Requirements

- Visual Studio Code **1.90** or newer. No other dependencies — Cera is
  self-contained and works offline.

## Known limitations

- **Redo after undoing a block edit** ([#33](https://github.com/Alpharius99/cera/issues/33)) —
  after you commit a block edit and **undo** it, VS Code shows **Redo** as
  available but it does not re-apply the change. This is a platform behavior of
  redo for programmatic edits to a document shown only in a custom editor (the
  menu Redo is affected too, so it isn't a keybinding issue), not something Cera
  can currently work around. **Undo works normally**; to get the change back,
  re-make the edit.

## Develop

```bash
npm install
npm run compile        # or: npm run watch
```

### Tests

| Command | Covers |
|---------|--------|
| `npm test` | Vitest suite: unit, webview UI (jsdom), fidelity corpus, theme guard |
| `npm run test:integration` | `@vscode/test-electron` suite in a real Extension Host |
| `npm run test:all` | build + Vitest suite + integration (the full gate) |

CI runs the same gates on every push and PR — a `build` job (`npm run build`
then `npm test`) and an `integration` job (the Extension Host suite under
`xvfb`). See [.github/workflows/ci.yml](.github/workflows/ci.yml).

There are two ways to run the extension.

### Option A — Run from source (F5)

The everyday dev loop. Nothing is installed; the extension loads live from this
folder and is gone when you close the window.

1. Open this folder in VS Code.
2. Press **F5** ("Run Cera Extension"). VS Code runs the `compile` task and opens
   a second window titled **[Extension Development Host]** with Cera loaded.
3. In that window, open a `.md` file (e.g. `fixtures/sample.md`), then **Reopen
   With… → Cera Markdown Editor** or run **"Cera: Open Current File in Cera Editor"**.

### Option B — Package and install a VSIX

Build a real installable package — useful for testing as an installed extension
or sharing it.

```bash
npm run package                   # produces cera.vsix (runs the production build)
code --install-extension cera.vsix
```

Uninstall again with `code --uninstall-extension Alpharius99.cera`. CI can also
build the VSIX on demand (manual run) or on a `v*` tag — see
[.github/workflows/package.yml](.github/workflows/package.yml), which uploads
the `.vsix` as a build artifact.

## Theming

Cera's webview is theme-native: all styling derives from `var(--vscode-*)`
tokens, which VS Code supplies for light, dark, and high-contrast themes. This
is enforced in CI — `test/theme.test.ts` rejects hardcoded colors in `media/`
and requires every CSS variable to be a `--vscode-*` token.

Manual visual QA that the automated guard can't cover (run before a release):

- Open `fixtures/sample.md` in **Light+**, **Dark+**, and a **High Contrast**
  theme and confirm text, code blocks, blockquotes, tables, `raw-text-block`
  source, diagram placeholders, and the remote-image chip all remain legible.
- Live theme rendering will also be exercised by the custom-editor / webview
  integration tests (#25, #26).

## Documentation

- [ROADMAP.md](ROADMAP.md) — phased build plan
- [ARCHITECTURE.md](ARCHITECTURE.md) — technical design and VS Code mapping
- [docs/MARKITDOWN-MIGRATION.md](docs/MARKITDOWN-MIGRATION.md) — source-project
  reference map for porting behavior from MarkItDown
- [CHANGELOG.md](CHANGELOG.md) — release notes
- [RELEASING.md](RELEASING.md) — how to cut a release
- [docs/PUBLISHING.md](docs/PUBLISHING.md) — Marketplace / Open VSX listing readiness

## License

[MIT](LICENSE)

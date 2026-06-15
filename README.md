# Cera for VS Code

A distraction-free, **reveal-on-focus** Markdown editor for Visual Studio Code.

Cera is a port of the [Cera desktop editor](https://github.com/Alpharius99/MarkItDown)
(C# / Avalonia) to a VS Code extension. Same philosophy: see fully rendered
Markdown, click a block to edit its raw source, and never fight a toolbar.

> **Status:** Phase 0 — buildable skeleton. The reveal-on-focus block model and
> formatting layers are being built out per the [Roadmap](ROADMAP.md).

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

## Develop

```bash
npm install
npm run compile        # or: npm run watch
```

Press **F5** ("Run Cera Extension") to launch an Extension Development Host, then
open any `.md` file with the Cera editor.

## Documentation

- [ROADMAP.md](ROADMAP.md) — phased build plan
- [ARCHITECTURE.md](ARCHITECTURE.md) — technical design and VS Code mapping

## License

[MIT](LICENSE)

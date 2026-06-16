# MarkItDown Migration Reference

This extension is a port of the private source project
[Alpharius99/MarkItDown](https://github.com/Alpharius99/MarkItDown). Treat that
repository as the behavioral reference for Cera's editor model, but not as a
literal architecture template: the desktop app owns files and rendering inside
Avalonia, while the VS Code extension should let VS Code own `TextDocument`
sync, dirty state, undo/redo, and save.

## Quick Access

- Source repo: [Alpharius99/MarkItDown](https://github.com/Alpharius99/MarkItDown)
  (private; requires GitHub access).
- Source README: [README.md](https://github.com/Alpharius99/MarkItDown/blob/main/README.md)
- Source architecture: [docs/ARCHITECTURE.md](https://github.com/Alpharius99/MarkItDown/blob/main/docs/ARCHITECTURE.md)
- Source UI/UX spec: [docs/UI_UX.md](https://github.com/Alpharius99/MarkItDown/blob/main/docs/UI_UX.md)
- Source roadmap/progress: [PLAN.md](https://github.com/Alpharius99/MarkItDown/blob/main/PLAN.md)
- Source acceptance fixture: [sample.md](https://github.com/Alpharius99/MarkItDown/blob/main/sample.md)

Useful authenticated CLI checks:

```bash
rtk gh repo view Alpharius99/MarkItDown --json nameWithOwner,url,isPrivate,defaultBranchRef
rtk gh api 'repos/Alpharius99/MarkItDown/git/trees/main?recursive=1' --jq '.tree[] | .path'
```

## Migration Rule

Use MarkItDown to answer "what should the editor do?", then translate that into
VS Code/webview mechanics:

- Preserve: reveal-on-focus, block granularity, zen UI, complete visibility,
  formatting behavior, and the test corpus intent.
- Reinterpret: file I/O, save, dirty tracking, undo/redo, keyboard routing, and
  theme integration through VS Code APIs.
- Do not blindly copy: Avalonia window structure, MVVM plumbing, renderer
  workarounds that exist only because of Markdown.Avalonia, or desktop release
  packaging.

## Source-To-Extension Map

| MarkItDown source | VS Code extension target | Migration notes |
|---|---|---|
| [`src/Cera/Services/MarkdownParserService.cs`](https://github.com/Alpharius99/MarkItDown/blob/main/src/Cera/Services/MarkdownParserService.cs) | Phase 1 parser/block model | Port the block taxonomy and fidelity concerns. Markdig uses precise character spans; markdown-it exposes line `.map` ranges, so Phase 1 must validate range precision and define fallbacks. |
| [`src/Cera/Models/MarkdownBlock.cs`](https://github.com/Alpharius99/MarkItDown/blob/main/src/Cera/Models/MarkdownBlock.cs) and [`src/Cera/Models/BlockType.cs`](https://github.com/Alpharius99/MarkItDown/blob/main/src/Cera/Models/BlockType.cs) | Webview block DTO/model | Mirror concepts: `RawSource`, source range, block type, heading level, language, and leading separator. Keep the JS/TS model small and serializable. |
| [`src/Cera/ViewModels/BlockEditorState.cs`](https://github.com/Alpharius99/MarkItDown/blob/main/src/Cera/ViewModels/BlockEditorState.cs) | Phase 2 edit state and splice logic | Important reference for surgical block splicing, structural split handling, persistent source ranges, merge behavior, and save-safe sync of in-progress edits. Adapt it around `TextDocument.version` and `WorkspaceEdit`. |
| [`src/Cera/Views/Controls/MarkdownEditor.axaml.cs`](https://github.com/Alpharius99/MarkItDown/blob/main/src/Cera/Views/Controls/MarkdownEditor.axaml.cs) | Webview editor shell | Reference for block activation, Tab navigation, active-block display updates, chord overlay timing, focus handling, and incremental refresh. Translate routed events into DOM events/messages. |
| [`src/Cera/Views/Controls/RenderedBlock.axaml.cs`](https://github.com/Alpharius99/MarkItDown/blob/main/src/Cera/Views/Controls/RenderedBlock.axaml.cs) | Rendered block component | Reference for raw/special-case fallback, link reference handling, autolink normalization, image fallback concerns, and diagram placeholders. Do not port Markdown.Avalonia-specific visual tree workarounds. |
| [`src/Cera/Views/Controls/SourceBlock.axaml.cs`](https://github.com/Alpharius99/MarkItDown/blob/main/src/Cera/Views/Controls/SourceBlock.axaml.cs) | CodeMirror active block editor | Reference for Escape/blur commit rules, slash menu guards, selection bubble debounce, app shortcut suppression, navigation shortcuts, merge triggers, and preserving selection after formatting. |
| [`src/Cera/Services/FormattingService.cs`](https://github.com/Alpharius99/MarkItDown/blob/main/src/Cera/Services/FormattingService.cs) | Shared TS formatting transforms | This is the canonical behavior for slash commands, selection bubble actions, and chord overlay formatting. Port with tests before wiring UI. |
| [`src/Cera/Models/SlashCommand.cs`](https://github.com/Alpharius99/MarkItDown/blob/main/src/Cera/Models/SlashCommand.cs) and [`src/Cera/Views/Controls/SlashCommandMenu.axaml.cs`](https://github.com/Alpharius99/MarkItDown/blob/main/src/Cera/Views/Controls/SlashCommandMenu.axaml.cs) | Slash command menu | Keep the command vocabulary and fuzzy matching behavior. Rebuild UI in DOM/CodeMirror. |
| [`src/Cera/Views/Controls/SelectionBubble.axaml.cs`](https://github.com/Alpharius99/MarkItDown/blob/main/src/Cera/Views/Controls/SelectionBubble.axaml.cs) | Selection bubble | Port action set, grouping, delay, selection preservation, and dismissal behavior. |
| [`src/Cera/Views/Controls/ChordOverlay.axaml.cs`](https://github.com/Alpharius99/MarkItDown/blob/main/src/Cera/Views/Controls/ChordOverlay.axaml.cs) | Chord overlay | Port the 500ms discoverability model, but resolve shortcut ownership against VS Code, browser/webview, and CodeMirror first. |
| [`src/Cera/Services/ImageFallbackHelper.cs`](https://github.com/Alpharius99/MarkItDown/blob/main/src/Cera/Services/ImageFallbackHelper.cs) and [`tests/Cera.Tests/UI/ImageRenderingTests.cs`](https://github.com/Alpharius99/MarkItDown/blob/main/tests/Cera.Tests/UI/ImageRenderingTests.cs) | Image CSP and remote-image policy | Use as behavioral inspiration only. The extension policy is CSP-driven and setting-driven; remote network probing should not be copied without a privacy review. |
| [`tests/Cera.Tests`](https://github.com/Alpharius99/MarkItDown/tree/main/tests/Cera.Tests) | Phase test plan | Mine tests for parity cases. Translate xUnit/Avalonia.Headless coverage into Vitest, DOM tests, `@vscode/test-electron`, and fidelity corpus checks. |

## Phase Reading Guide

- **Phase 1 - rendered Markdown view:** read `MarkdownParserService.cs`,
  `MarkdownBlock.cs`, `BlockType.cs`, `RenderedBlock.axaml.cs`, `sample.md`,
  `MarkdownParserServiceTests.cs`, `RenderPreprocessingTests.cs`,
  `LinkReferenceDefinitionVisibilityTests.cs`, `ImageRenderingTests.cs`, and
  `RenderingInventoryTests.cs`.
- **Phase 2 - reveal-on-focus editing:** read `BlockEditorState.cs`,
  `MarkdownEditor.axaml.cs`, `SourceBlock.axaml.cs`,
  `BlockActivationTests.cs`, `BlockReRenderingTests.cs`,
  `CommitOptimizationTests.cs`, and `KeyboardNavigationTests.cs`.
- **Phase 3 - navigation and affordances:** read `MarkdownEditor.axaml.cs`,
  `BlockNavigationControls.axaml.cs`, `SourceBlock.axaml.cs`, and
  `KeyboardNavigationTests.cs`.
- **Phases 4-6 - formatting layers:** read `FormattingService.cs`,
  `SlashCommandMenu.axaml.cs`, `SelectionBubble.axaml.cs`,
  `ChordOverlay.axaml.cs`, `FormattingServiceTests.cs`,
  `SlashCommandTests.cs`, `SlashCommandIntegrationTests.cs`,
  `SelectionBubbleTests.cs`, `ChordOverlayTests.cs`, and
  `FormattingIntegrationTests.cs`.
- **Phase 7 - visibility and fidelity:** read `MarkdownParserService.cs`,
  `RenderedBlock.axaml.cs`, `sample.md`,
  `LinkReferenceDefinitionVisibilityTests.cs`,
  `BlockquoteCodeBlockCrashTests.cs`, `InlineCodeRenderingTests.cs`, and
  `RenderingInventoryTests.cs`.
- **Phase 8 - polish/theming:** read `docs/UI_UX.md`,
  `AnimatedBlockWrapper.axaml.cs`, theme files under `src/Cera/Themes/`, and
  visual/headless tests under `tests/Cera.Tests/UI/`.
- **Phase 9 - integration hardening:** use the whole `tests/Cera.Tests` tree as
  the parity inventory, then decide which cases belong in unit, DOM, VS Code
  integration, or manual QA.
- **Phase 10 - packaging:** read source release assets and workflows only for
  release intent. VS Code packaging is separate (`vsce`, Marketplace, Open VSX).

## Behavior Details Worth Preserving

- **Link reference definitions:** MarkItDown keeps reference definitions visible
  as raw blocks and also injects them into per-block rendering so reference-style
  links resolve. The extension needs the same user-visible fidelity, implemented
  with markdown-it/DOM rendering.
- **Raw/special-case fallback:** raw HTML and link reference definitions should
  remain visible as source. Diagram fences are special-case placeholders unless
  the v1 diagram issue decides otherwise.
- **Structural edits:** desktop block editing keeps split blocks in source mode
  until explicit exit. The extension roadmap refines this into separate commit
  and collapse behavior.
- **Surgical splicing:** desktop code replaces only the active block's bytes and
  preserves separators/trailing newlines. The extension should keep this fidelity
  goal while using VS Code's edit and versioning APIs.
- **Formatting transforms:** source formatting behavior is already centralized in
  `FormattingService.cs`; port it to TypeScript with tests before connecting UI.
- **Shortcut conflicts:** desktop has Avalonia-specific shortcut forwarding and
  text-input suppression. The extension must re-solve this for VS Code webviews
  and CodeMirror rather than copying the handlers.

## Known Translation Differences

- MarkItDown's Markdig spans are character offsets. markdown-it block maps are
  line ranges and need Phase 1 validation before they are trusted for splicing.
- MarkItDown uses Markdown.Avalonia renderer workarounds. The extension uses
  sanitized HTML in a webview with a strict CSP; renderer workarounds should be
  re-evaluated, not ported.
- MarkItDown owns filesystem save prompts. The extension should not duplicate
  that machinery because VS Code owns save, dirty state, backups, and undo.
- MarkItDown can perform desktop image reachability checks. The extension must
  respect webview CSP and user privacy settings for remote images.

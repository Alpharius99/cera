# Listing readiness (Marketplace & Open VSX)

Tracks the public-facing assets for publishing Cera (#29). The release mechanics
(version tag → build → publish) live in [RELEASING.md](../RELEASING.md); this
file is about the *listing material*.

## Ready (in the repo)

- **Manifest metadata** — `displayName`, `description`, `publisher`, `license`,
  `repository`, `homepage`, `bugs`, `categories`, `keywords`, and `galleryBanner`
  are set in [`package.json`](../package.json).
- **README** — feature overview, formatting layers, settings, requirements, and
  how-it-works, rendered as the Marketplace detail page.
- **CHANGELOG** — [CHANGELOG.md](../CHANGELOG.md) follows Keep a Changelog.
- **Publish pipeline** — the release workflow publishes to both marketplaces when
  `VSCE_PAT` / `OVSX_PAT` secrets are set (see RELEASING.md).

## Needs a human (branding / accounts)

These can't be generated automatically — they need design or account decisions:

- [ ] **Extension icon** — a 128×128 PNG at `media/icon.png`, then add
      `"icon": "media/icon.png"` to `package.json`. (Left out for now so
      `vsce package` doesn't fail on a missing file.)
- [ ] **Screenshots / GIFs** — capture the reveal-on-focus flow, the selection
      bubble, the slash menu, and the chord overlay; add them under `media/` and
      reference them in the README. The Marketplace shows README images inline.
- [ ] **Publisher ID** — confirm whether to publish under `Alpharius99` or
      register a dedicated publisher (open question in [ROADMAP.md](../ROADMAP.md)).
- [ ] **Marketplace tokens** — add `VSCE_PAT` (VS Code Marketplace) and `OVSX_PAT`
      (Open VSX) as repository secrets so the release workflow can publish.

## Verify before first publish

```bash
npm run package          # builds cera.vsix; check the vsce warnings/summary
npx @vscode/vsce ls      # preview the files that will be shipped
```

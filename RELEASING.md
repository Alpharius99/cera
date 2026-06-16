# Releasing Cera

Releases are cut from a version tag. Pushing a `vX.Y.Z` tag runs
[`.github/workflows/release.yml`](.github/workflows/release.yml), which builds
the VSIX, creates a GitHub Release with the `.vsix` attached, and publishes to
the marketplaces when the relevant tokens are configured.

## Steps

1. **Update the changelog.** Move the `[Unreleased]` entries in
   [CHANGELOG.md](CHANGELOG.md) under a new `[X.Y.Z]` heading with the date.
2. **Bump the version** (updates `package.json` and creates a commit + tag):

   ```bash
   npm version <patch|minor|major>
   ```

3. **Push the commit and tag:**

   ```bash
   git push && git push --tags
   ```

4. The **Release** workflow runs automatically: build → `npm test` → `npm run
   package` → GitHub Release with `cera.vsix` attached → publish (if tokens set).

## Publishing tokens (optional)

Publishing steps run only when these repository secrets exist; otherwise they
are skipped and can be run manually.

- `VSCE_PAT` — VS Code Marketplace token. Manual: `npx @vscode/vsce publish --packagePath cera.vsix`
- `OVSX_PAT` — Open VSX token. Manual: `npx ovsx publish cera.vsix --pat <token>`

## Manual VSIX build (no release)

Run the **Package** workflow (`workflow_dispatch`) or build locally:

```bash
npm run package   # produces cera.vsix
```

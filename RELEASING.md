# Releasing Cera

Every push to `main` creates the next patch release. The
[`.github/workflows/release.yml`](.github/workflows/release.yml) workflow reads
the latest `vX.Y.Z` tag, increments the patch version, updates the package
metadata inside CI, builds the VSIX, creates and pushes the new tag, uploads the
VSIX as a workflow artifact, and creates a GitHub Release with the `.vsix`
attached. Upload the resulting VSIX to the VS Code Marketplace manually.

## Steps

1. Merge a change to `main`.
2. The **Release** workflow runs automatically: compute next patch version →
   update `package.json` and `package-lock.json` in CI → release metadata check
   → build → `npm test` → `npm run package` → upload `cera.vsix` as a workflow
   artifact → create and push the new `vX.Y.Z` tag → create a GitHub Release
   with `cera.vsix` attached.
3. Download `cera.vsix` from the GitHub Release or the Release workflow
   artifact.
4. Upload the VSIX in the Visual Studio Marketplace publisher management page.

## Marketplace upload

The GitHub Release is the source for the exact VSIX to upload. The package
version inside the VSIX is the automatically generated release version.

## Manual VSIX build (no release)

Run the **Package** workflow (`workflow_dispatch`) or build locally:

```bash
npm run package   # produces cera.vsix
```

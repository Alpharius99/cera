import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, test } from "vitest";

const root = join(__dirname, "..");

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(join(root, path), "utf8")) as T;
}

function readJsonFile<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function runReleaseCheck(env: NodeJS.ProcessEnv = {}) {
  return spawnSync(process.execPath, ["scripts/check-release.mjs"], {
    cwd: root,
    env: { ...process.env, ...env },
    encoding: "utf8",
  });
}

function runPrepareVersion(releaseRoot: string, version: string) {
  return spawnSync(process.execPath, [join(root, "scripts/prepare-release-version.mjs")], {
    cwd: root,
    env: { ...process.env, RELEASE_ROOT: releaseRoot, RELEASE_VERSION: version },
    encoding: "utf8",
  });
}

function runNextVersion(tags: string, tagsOnHead = "", outputFile?: string) {
  return spawnSync(process.execPath, ["scripts/next-release-version.mjs"], {
    cwd: root,
    env: {
      ...process.env,
      EXISTING_TAGS: tags,
      EXISTING_HEAD_TAGS: tagsOnHead,
      ...(outputFile ? { GITHUB_OUTPUT: outputFile } : {}),
    },
    encoding: "utf8",
  });
}

describe("automatic manual Marketplace release packaging", () => {
  test("computes the next patch version from the latest version tag", () => {
    const result = runNextVersion(["v0.0.4", "v0.0.5", "not-a-version"].join("\n"));

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("RELEASE_VERSION=0.0.6");
    expect(result.stdout).toContain("RELEASE_TAG=v0.0.6");
  });

  test("reuses an existing version tag on HEAD for workflow reruns", () => {
    const result = runNextVersion(
      ["v0.0.4", "v0.0.5", "v0.0.6"].join("\n"),
      "v0.0.6",
    );

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("RELEASE_VERSION=0.0.6");
    expect(result.stdout).toContain("RELEASE_TAG=v0.0.6");
  });

  test("writes lowercase GitHub step outputs for workflow action inputs", () => {
    const outputFile = join(mkdtempSync(join(tmpdir(), "cera-outputs-")), "out");
    const result = runNextVersion("v0.0.5", "", outputFile);
    const output = readFileSync(outputFile, "utf8");

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(output).toContain("release_version=0.0.6");
    expect(output).toContain("release_tag=v0.0.6");
  });

  test("starts at v0.0.1 when no version tags exist", () => {
    const result = runNextVersion("");

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("RELEASE_VERSION=0.0.1");
    expect(result.stdout).toContain("RELEASE_TAG=v0.0.1");
  });

  test("updates package metadata from the release version", () => {
    const releaseRoot = mkdtempSync(join(tmpdir(), "cera-release-"));
    writeFileSync(
      join(releaseRoot, "package.json"),
      JSON.stringify({ name: "cera", version: "0.0.0" }, null, 2),
    );
    writeFileSync(
      join(releaseRoot, "package-lock.json"),
      JSON.stringify(
        { name: "cera", version: "0.0.0", packages: { "": { version: "0.0.0" } } },
        null,
        2,
      ),
    );

    const result = runPrepareVersion(releaseRoot, "1.2.3");

    const packageJson = readJsonFile<{ version: string }>(
      join(releaseRoot, "package.json"),
    );
    const packageLock = readJsonFile<{ version: string; packages: Record<string, { version: string }> }>(
      join(releaseRoot, "package-lock.json"),
    );
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(packageJson.version).toBe("1.2.3");
    expect(packageLock.version).toBe("1.2.3");
    expect(packageLock.packages[""].version).toBe("1.2.3");
  });

  test("validates the release version and lockfile without a Marketplace token", () => {
    const packageJson = readJson<{ version: string }>("package.json");

    const result = runReleaseCheck({
      RELEASE_VERSION: packageJson.version,
      VSCE_PAT: "",
    });

    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    expect(result.stdout).toContain(`Release v${packageJson.version} is ready for manual Marketplace upload`);
  });

  test("fails when the pushed tag does not match package.json", () => {
    const result = runReleaseCheck({
      RELEASE_VERSION: "999.999.999",
      VSCE_PAT: "test-token",
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("does not match package.json");
  });

  test("fails when the release version is not semver", () => {
    const result = runReleaseCheck({
      RELEASE_VERSION: "not-a-version",
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("RELEASE_VERSION must be semver");
  });

  test("runs on every push to main instead of version tag pushes", () => {
    const workflow = readFileSync(
      join(root, ".github/workflows/release.yml"),
      "utf8",
    );

    expect(workflow).toContain("branches: [main]");
    expect(workflow).not.toContain("tags:");
  });

  test("computes and prepares the next version before validating and packaging", () => {
    const workflow = readFileSync(
      join(root, ".github/workflows/release.yml"),
      "utf8",
    );
    const nextIndex = workflow.indexOf("node scripts/next-release-version.mjs");
    const prepareIndex = workflow.indexOf("node scripts/prepare-release-version.mjs");
    const guardIndex = workflow.indexOf("node scripts/check-release.mjs");
    const packageIndex = workflow.indexOf("npm run package");

    expect(nextIndex).toBeGreaterThan(-1);
    expect(prepareIndex).toBeGreaterThan(-1);
    expect(guardIndex).toBeGreaterThan(-1);
    expect(packageIndex).toBeGreaterThan(-1);
    expect(nextIndex).toBeLessThan(prepareIndex);
    expect(prepareIndex).toBeLessThan(guardIndex);
    expect(guardIndex).toBeLessThan(packageIndex);
  });

  test("fetches remote tags before computing the next release version", () => {
    const workflow = readFileSync(
      join(root, ".github/workflows/release.yml"),
      "utf8",
    );
    const fetchIndex = workflow.indexOf("git fetch --force --tags origin");
    const nextIndex = workflow.indexOf("node scripts/next-release-version.mjs");

    expect(fetchIndex).toBeGreaterThan(-1);
    expect(nextIndex).toBeGreaterThan(-1);
    expect(fetchIndex).toBeLessThan(nextIndex);
  });

  test("uses computed step outputs for tag creation and GitHub Release inputs", () => {
    const workflow = readFileSync(
      join(root, ".github/workflows/release.yml"),
      "utf8",
    );

    expect(workflow).toContain("id: version");
    expect(workflow).toContain("RELEASE_TAG: ${{ steps.version.outputs.release_tag }}");
    expect(workflow).toContain("tag_name: ${{ steps.version.outputs.release_tag }}");
    expect(workflow).toContain("target_commitish: ${{ github.sha }}");
    expect(workflow).not.toContain("tag_name: ${{ env.RELEASE_TAG }}");
  });

  test("fetches tags and creates the computed tag before creating the GitHub Release", () => {
    const workflow = readFileSync(
      join(root, ".github/workflows/release.yml"),
      "utf8",
    );
    const fetchIndex = workflow.indexOf("fetch-depth: 0");
    const tagIndex = workflow.indexOf('git tag "$RELEASE_TAG"');
    const pushTagIndex = workflow.indexOf('git push origin "$RELEASE_TAG"');
    const releaseIndex = workflow.indexOf("Create GitHub Release with the VSIX");

    expect(fetchIndex).toBeGreaterThan(-1);
    expect(tagIndex).toBeGreaterThan(-1);
    expect(pushTagIndex).toBeGreaterThan(-1);
    expect(releaseIndex).toBeGreaterThan(-1);
    expect(tagIndex).toBeLessThan(releaseIndex);
    expect(pushTagIndex).toBeLessThan(releaseIndex);
  });

  test("does not publish to external marketplaces automatically", () => {
    const workflow = readFileSync(
      join(root, ".github/workflows/release.yml"),
      "utf8",
    );

    expect(workflow).not.toContain("vsce publish");
    expect(workflow).not.toContain("ovsx publish");
  });

  test("uploads the VSIX for manual Marketplace upload", () => {
    const workflow = readFileSync(
      join(root, ".github/workflows/release.yml"),
      "utf8",
    );

    expect(workflow).toContain("actions/upload-artifact");
    expect(workflow).toContain("path: cera.vsix");
  });

  test("excludes local automation and release-only files from the VSIX", () => {
    const vscodeIgnore = readFileSync(join(root, ".vscodeignore"), "utf8");

    expect(vscodeIgnore).toContain(".superpowers/**");
    expect(vscodeIgnore).toContain("scripts/**");
  });
});

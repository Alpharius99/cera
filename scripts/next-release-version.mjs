import { appendFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

function readTags(envName, args) {
  if (process.env[envName] !== undefined) {
    return process.env[envName].split(/\r?\n/);
  }

  const result = spawnSync("git", args, {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    process.exit(result.status ?? 1);
  }
  return result.stdout.split(/\r?\n/);
}

function parseVersionTag(tag) {
  const match = /^v(\d+)\.(\d+)\.(\d+)$/.exec(tag.trim());
  if (!match) {
    return undefined;
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

function compareVersions(a, b) {
  return a.major - b.major || a.minor - b.minor || a.patch - b.patch;
}

function highestVersion(tags) {
  return tags
    .map(parseVersionTag)
    .filter(Boolean)
    .sort(compareVersions)
    .at(-1);
}

const headVersion = highestVersion(
  readTags("EXISTING_HEAD_TAGS", ["tag", "--points-at", "HEAD", "--list", "v[0-9]*"]),
);
const latest = highestVersion(
  readTags("EXISTING_TAGS", ["tag", "--list", "v[0-9]*"]),
);

const next = headVersion
  ?? (latest
    ? { major: latest.major, minor: latest.minor, patch: latest.patch + 1 }
    : { major: 0, minor: 0, patch: 1 });

const releaseVersion = `${next.major}.${next.minor}.${next.patch}`;
const releaseTag = `v${releaseVersion}`;
const lines = [`RELEASE_VERSION=${releaseVersion}`, `RELEASE_TAG=${releaseTag}`];

if (process.env.GITHUB_ENV) {
  appendFileSync(process.env.GITHUB_ENV, `${lines.join("\n")}\n`);
}

console.log(lines.join("\n"));

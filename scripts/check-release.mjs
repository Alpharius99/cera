import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function readJson(path) {
  return JSON.parse(readFileSync(join(root, path), "utf8"));
}

const packageJson = readJson("package.json");
const packageLock = readJson("package-lock.json");
const refName = process.env.GITHUB_REF_NAME ?? "";
const releaseVersion = process.env.RELEASE_VERSION ?? (refName.startsWith("v") ? refName.slice(1) : "");
const errors = [];

if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(releaseVersion)) {
  errors.push("RELEASE_VERSION must be semver like 1.2.3.");
}

if (releaseVersion && releaseVersion !== packageJson.version) {
  errors.push(
    `Release version ${releaseVersion} does not match package.json version ${packageJson.version}.`,
  );
}

if (packageLock.version !== packageJson.version) {
  errors.push(
    `package-lock.json version ${packageLock.version} does not match package.json version ${packageJson.version}.`,
  );
}

const lockedRootVersion = packageLock.packages?.[""]?.version;
if (lockedRootVersion !== packageJson.version) {
  errors.push(
    `package-lock.json root package version ${lockedRootVersion} does not match package.json version ${packageJson.version}.`,
  );
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`Release v${releaseVersion} is ready for manual Marketplace upload.`);

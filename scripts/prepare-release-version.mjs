import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.env.RELEASE_ROOT ?? process.cwd();
const refName = process.env.GITHUB_REF_NAME ?? "";
const version = process.env.RELEASE_VERSION ?? (refName.startsWith("v") ? refName.slice(1) : "");

if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error("RELEASE_VERSION must be semver like 1.2.3.");
  process.exit(1);
}

function readJson(path) {
  return JSON.parse(readFileSync(join(root, path), "utf8"));
}

function writeJson(path, value) {
  writeFileSync(join(root, path), `${JSON.stringify(value, null, 2)}\n`);
}

const packageJson = readJson("package.json");
packageJson.version = version;
writeJson("package.json", packageJson);

const packageLock = readJson("package-lock.json");
packageLock.version = version;
if (packageLock.packages?.[""]) {
  packageLock.packages[""].version = version;
}
writeJson("package-lock.json", packageLock);

console.log(`Prepared package metadata for v${version}.`);

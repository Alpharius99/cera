// Webview bundler. Bundles the webview-side TypeScript into a single
// media/cera.bundle.js that the custom editor loads via a nonce under the
// strict CSP. Host extension code is compiled separately by `tsc` (see
// tsconfig.json / `npm run compile`); this script never touches it.
//
//   node esbuild.js            production build (minified)
//   node esbuild.js --watch    rebuild on change for the F5 dev loop

const esbuild = require("esbuild");
const fs = require("node:fs");
const path = require("node:path");

const watch = process.argv.includes("--watch");

// Copy the VS Code codicon font + stylesheet into media/codicons/ so the webview
// can load them under the CSP (localResourceRoots includes media/). Vendored at
// build time rather than committed, like the bundle itself (#35).
function copyCodicons() {
  const src = path.join("node_modules", "@vscode", "codicons", "dist");
  const dest = path.join("media", "codicons");
  fs.mkdirSync(dest, { recursive: true });
  for (const file of ["codicon.css", "codicon.ttf"]) {
    fs.copyFileSync(path.join(src, file), path.join(dest, file));
  }
  console.log("[esbuild] copied codicon assets to media/codicons/");
}

/** @type {import('esbuild').BuildOptions} */
const options = {
  entryPoints: ["src/webview/main.ts"],
  bundle: true,
  outfile: "media/cera.bundle.js",
  format: "iife",
  platform: "browser",
  target: "es2020",
  minify: !watch,
  sourcemap: watch,
  logLevel: "info",
};

async function main() {
  copyCodicons();
  if (watch) {
    const ctx = await esbuild.context(options);
    await ctx.watch();
    console.log("[esbuild] watching webview bundle…");
  } else {
    await esbuild.build(options);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

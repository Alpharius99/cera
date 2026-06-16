// Webview bundler. Bundles the webview-side TypeScript into a single
// media/cera.bundle.js that the custom editor loads via a nonce under the
// strict CSP. Host extension code is compiled separately by `tsc` (see
// tsconfig.json / `npm run compile`); this script never touches it.
//
//   node esbuild.js            production build (minified)
//   node esbuild.js --watch    rebuild on change for the F5 dev loop

const esbuild = require("esbuild");

const watch = process.argv.includes("--watch");

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

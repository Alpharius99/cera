import { defineConfig } from "vitest/config";

// Unit tests live in test/ and run under Node. Webview tests that need a DOM
// will opt into a browser-like environment per-file (e.g. a
// `// @vitest-environment jsdom` pragma) once block rendering lands.
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
  },
});

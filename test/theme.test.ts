import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// Theme guard (#24): the webview must be theme-native across VS Code's light,
// dark, and high-contrast themes. We enforce that statically — no hardcoded
// color literals, and every CSS variable is a `--vscode-*` token (which VS Code
// supplies for all three theme kinds). Live per-theme visual QA is manual /
// covered by the integration suite (see README "Theming").

const MEDIA_DIR = "media";
const cssFiles = readdirSync(MEDIA_DIR)
  .filter((name) => name.endsWith(".css"))
  .map((name) => join(MEDIA_DIR, name));

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

// Standalone color keywords that adapt to context and are not palette literals.
const SAFE_KEYWORDS = ["transparent", "currentcolor", "inherit", "initial", "unset", "none"];

const NAMED_COLORS = [
  "red", "green", "blue", "white", "black", "gray", "grey", "yellow", "orange",
  "purple", "pink", "cyan", "magenta", "silver", "gold", "navy", "teal", "maroon",
  "olive", "lime", "aqua", "fuchsia", "brown", "beige", "coral", "crimson", "indigo",
];

describe("theme guard: no hardcoded colors in media/ (#24)", () => {
  it("scans at least one stylesheet", () => {
    expect(cssFiles.length).toBeGreaterThan(0);
  });

  it.each(cssFiles)("%s has no hex or functional color literals", (file) => {
    const css = stripComments(readFileSync(file, "utf8"));
    expect(css).not.toMatch(/#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/);
    expect(css).not.toMatch(/\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\s*\(/i);
  });

  it.each(cssFiles)("%s has no named color literals", (file) => {
    const css = stripComments(readFileSync(file, "utf8")).toLowerCase();
    for (const name of NAMED_COLORS) {
      expect(css, `unexpected named color "${name}"`).not.toMatch(
        new RegExp(`(^|[\\s:,(])${name}([\\s;,)]|$)`),
      );
    }
  });
});

describe("theme nativeness: variables are VS Code theme tokens (#24)", () => {
  it.each(cssFiles)("%s only references --vscode-* variables", (file) => {
    const css = stripComments(readFileSync(file, "utf8"));
    const refs = css.match(/var\(\s*--[\w-]+/g) ?? [];
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) {
      expect(ref, `non-theme variable: "${ref}"`).toMatch(/var\(\s*--vscode-/);
    }
  });

  it.each(cssFiles)("%s declares color-scheme so native widgets follow the theme", (file) => {
    const css = stripComments(readFileSync(file, "utf8"));
    if (/\bbody\b/.test(css)) {
      expect(css).toMatch(/color-scheme\s*:/);
    }
  });
});

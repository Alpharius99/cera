import { describe, it, expect } from "vitest";
import { buildCsp } from "../src/csp";

describe("buildCsp image policy (#7)", () => {
  const csp = buildCsp("VSCODE_CSP_SOURCE", "nonce123");

  it("allows cspSource, data:, and https: images", () => {
    expect(csp).toContain("img-src VSCODE_CSP_SOURCE data: https:");
  });

  it("excludes http: images (no mixed/insecure content)", () => {
    // 'https:' does not contain the substring 'http:', so this is exact.
    expect(csp).not.toContain("http:");
  });

  it("keeps default-src none and nonce-scoped scripts", () => {
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("script-src 'nonce-nonce123'");
  });

  it("allows the bundled codicon font from cspSource (#35)", () => {
    expect(csp).toContain("font-src VSCODE_CSP_SOURCE");
  });

  it("allows the linked stylesheet and CodeMirror's nonced styles", () => {
    expect(csp).toContain("style-src VSCODE_CSP_SOURCE 'nonce-nonce123'");
    expect(csp).toContain("style-src-attr 'unsafe-inline'");
  });
});

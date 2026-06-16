import { describe, it } from "vitest";

// Markdown -> HTML rendering and CSP/image policy coverage lands with #5/#7.
describe("markdown renderer", () => {
  it.todo("renders supported block types to HTML preserving block order");
  it.todo("sanitizes rendered HTML before injection");
  it.todo("emits a strict CSP with img-src cspSource data: https: and excludes http:");
});

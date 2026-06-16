import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

// Block parser + source-map coverage lands with the read-only renderer (#5) and
// the source-map spike (#4). These todos scaffold that suite; the smoke test
// guards the acceptance fixture every later test reads from.
describe("block parser", () => {
  it("has a readable sample fixture to parse", () => {
    const md = readFileSync("fixtures/sample.md", "utf8");
    expect(md.length).toBeGreaterThan(0);
  });

  it.todo("parses each top-level block with a round-tripping source range");
  it.todo("treats raw HTML blocks as literal, editable source");
  it.todo("renders YAML front matter as literal source");
  it.todo("renders non-GFM inline extensions as literal text");
});

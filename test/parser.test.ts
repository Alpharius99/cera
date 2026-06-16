import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseBlocks } from "../src/webview/blocks";

const src = readFileSync("fixtures/sample.md", "utf8");
const blocks = parseBlocks(src);

describe("block parser", () => {
  it("produces an ordered block model with stable ascending indexes", () => {
    expect(blocks.length).toBeGreaterThan(0);
    blocks.forEach((b, i) => expect(b.index).toBe(i));
  });

  it("gives every block a non-overlapping source range that round-trips", () => {
    const lines = src.split("\n");
    let prevEnd = 0;
    for (const b of blocks) {
      expect(b.map[1]).toBeGreaterThan(b.map[0]);
      expect(b.map[0]).toBeGreaterThanOrEqual(prevEnd);
      expect(b.raw).toBe(lines.slice(b.map[0], b.map[1]).join("\n"));
      prevEnd = b.map[1];
    }
  });

  it("classifies the representative top-level block types", () => {
    const types = new Set(blocks.map((b) => b.type));
    for (const t of [
      "heading_open",
      "paragraph_open",
      "bullet_list_open",
      "ordered_list_open",
      "blockquote_open",
      "fence",
      "table_open",
      "hr",
    ]) {
      expect(types).toContain(t);
    }
  });
});

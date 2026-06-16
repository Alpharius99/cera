import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parseBlocks } from "../src/webview/blocks";

const src = readFileSync("fixtures/sample.md", "utf8");
const lines = src.split("\n");
const blocks = parseBlocks(src);

describe("block classification (#20)", () => {
  it("classifies front matter as a single raw block at the top", () => {
    const fm = blocks[0];
    expect(fm.type).toBe("front_matter");
    expect(fm.kind).toBe("raw");
    expect(fm.map).toEqual([0, 6]);
    expect(fm.raw).toBe(lines.slice(0, 6).join("\n"));
    expect(fm.html).toContain("raw-text-block");
  });

  it("classifies both raw HTML blocks as raw", () => {
    const html = blocks.filter((b) => b.type === "html_block");
    expect(html.length).toBe(2);
    expect(html.every((b) => b.kind === "raw")).toBe(true);
  });

  it("classifies link reference definitions as raw blocks", () => {
    const refs = blocks.filter((b) => b.type === "ref_definition");
    expect(refs.map((b) => b.raw)).toEqual([
      '[ref]: https://example.com "Example Reference"',
      '[img]: https://placehold.co/200x80 "Reference Image"',
    ]);
    expect(refs.every((b) => b.kind === "raw")).toBe(true);
  });

  it("classifies mermaid and plantuml fences as special-case placeholders", () => {
    const special = blocks.filter((b) => b.kind === "special");
    expect(special.length).toBe(2);
    const firstLines = special.map((b) => b.raw.split("\n")[0]);
    expect(firstLines).toContain("```mermaid");
    expect(firstLines).toContain("```plantuml");
    expect(special.every((b) => b.html.includes("cera-diagram"))).toBe(true);
  });

  it("hides no content: every non-blank source line lands in a block", () => {
    const covered = new Array(lines.length).fill(false);
    for (const b of blocks) {
      for (let i = b.map[0]; i < b.map[1]; i++) covered[i] = true;
    }
    const hidden = lines
      .map((line, i) => ({ line, lineNo: i + 1 }))
      .filter(({ line, lineNo }) => line.trim() !== "" && !covered[lineNo - 1])
      .map(({ lineNo }) => lineNo);
    expect(hidden).toEqual([]);
  });

  it("gives every block a kind and a stable, non-overlapping ordered range", () => {
    blocks.forEach((b, i) => {
      expect(b.index).toBe(i);
      expect(["rendered", "raw", "special"]).toContain(b.kind);
    });
    for (let i = 1; i < blocks.length; i++) {
      expect(blocks[i].map[0]).toBeGreaterThanOrEqual(blocks[i - 1].map[1]);
    }
  });
});

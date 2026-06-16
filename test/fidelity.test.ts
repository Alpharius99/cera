import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parseBlocks } from "../src/webview/blocks";

// Reconstruct the document from the parsed block model: place each block's raw
// source at its line offset, leaving uncovered positions blank. This fails if
// any non-blank line is dropped, misranged, or altered — so equality with the
// original is a byte-for-byte fidelity check of the block model (#21), the
// guarantee Phase 2's splice will depend on.
function reconstruct(src: string): string {
  const lineCount = src.split("\n").length;
  const out = new Array<string>(lineCount).fill("");
  for (const block of parseBlocks(src)) {
    const rawLines = block.raw.split("\n");
    for (let i = 0; i < rawLines.length; i++) {
      out[block.map[0] + i] = rawLines[i];
    }
  }
  return out.join("\n");
}

const CORPUS_DIR = "fixtures/corpus";
const corpus: string[] = [
  "fixtures/sample.md",
  ...readdirSync(CORPUS_DIR)
    .filter((name) => name.endsWith(".md"))
    .map((name) => join(CORPUS_DIR, name)),
];

describe("byte-for-byte fidelity corpus (#21)", () => {
  it.each(corpus)("round-trips %s byte-for-byte", (file) => {
    const src = readFileSync(file, "utf8");
    expect(reconstruct(src)).toBe(src);
  });

  // Whitespace-sensitive cases are inline so editor/git normalization of
  // fixture files can't mask them.
  it("preserves a missing trailing newline", () => {
    const src = "# Heading\n\nBody with no trailing newline.";
    expect(reconstruct(src)).toBe(src);
  });

  it("preserves trailing spaces (hard line breaks)", () => {
    const src = "Line with two trailing spaces:  \nnext line\n";
    expect(reconstruct(src)).toBe(src);
  });

  it("preserves runs of blank lines", () => {
    const src = "a\n\n\n\nb\n";
    expect(reconstruct(src)).toBe(src);
  });

  // KNOWN LIMITATION (#32): markdown-it normalizes CRLF, so a lone \r on an
  // otherwise blank line is not preserved by block-model reconstruction. Must be
  // resolved before Phase 2 relies on reconstruction for writes.
  it.todo("preserves CRLF line endings byte-for-byte (#32)");
});

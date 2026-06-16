import { describe, it, expect } from "vitest";
import MarkdownIt from "markdown-it";
import { readFileSync } from "node:fs";

// Spike (#4): empirically verify that markdown-it token `.map` line ranges are
// precise enough to drive Phase 2's block splice. Findings are written up in
// docs/SPIKE-source-map.md; these assertions guard them so the conclusion stays
// true as the fixture and markdown-it version evolve.

const src = readFileSync("fixtures/sample.md", "utf8");
const lines = src.split("\n");

// CommonMark + GFM (tables + strikethrough are on in the default preset).
// html:false matches the HTML-block policy: raw HTML is shown as source.
const md = new MarkdownIt({ html: false, linkify: true });
const tokens = md.parse(src, {});
const top = tokens.filter((t) => t.level === 0 && t.map);

const slice = (start: number, end: number): string => lines.slice(start, end).join("\n");

describe("markdown-it source-map spike (#4)", () => {
  it("assigns a .map range to every top-level block", () => {
    expect(top.length).toBeGreaterThan(0);
    for (const t of top) {
      expect(t.map![1]).toBeGreaterThan(t.map![0]);
    }
  });

  it("produces non-overlapping top-level ranges (splice-safe)", () => {
    const ranges = top.map((t) => t.map!).sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < ranges.length; i++) {
      expect(ranges[i][0]).toBeGreaterThanOrEqual(ranges[i - 1][1]);
    }
  });

  it("round-trips representative tricky blocks byte-for-byte", () => {
    // GFM table
    expect(slice(161, 165)).toBe(
      "| Name  | Value | Note  |\n|-------|------:|:-----:|\n| Alpha |     1 | Left  |\n| Beta  |     2 | Center|",
    );
    // nested blockquote (3 levels)
    expect(slice(112, 117)).toBe(
      "> Nested quote:\n>\n> > Inner quote.\n> >\n> > > Triple-nested quote.",
    );
    // fenced code with language info
    expect(slice(128, 132)).toBe(
      "```csharp\n// Fenced with language\npublic record MarkdownBlock(string Content);\n```",
    );
  });

  it("leaves only link reference definitions without a block token", () => {
    // Fallback: ref-definitions carry no token, so they are treated as atomic
    // raw-text blocks (re-derived by scanning), never partially spliced.
    const covered = new Array(lines.length).fill(false);
    for (const t of top) {
      for (let i = t.map![0]; i < t.map![1]; i++) covered[i] = true;
    }
    const uncovered = lines
      .map((line, i) => ({ line, lineNo: i + 1 }))
      .filter(({ line, lineNo }) => !covered[lineNo - 1] && line.trim() !== "")
      .map(({ lineNo }) => lineNo);
    expect(uncovered).toEqual([236, 238]);
  });

  it("misparses YAML front matter without preprocessing", () => {
    // Line 1 '---' becomes a thematic break; the closing '---' is consumed as a
    // setext underline, so the YAML body is misread as a heading. Front matter
    // must be stripped before markdown-it and emitted as a raw-text block.
    expect(top[0].type).toBe("hr");
    expect(top[0].map).toEqual([0, 1]);
    expect(top[1].type).toBe("heading_open");
    expect(top[1].map).toEqual([1, 6]);
  });
});

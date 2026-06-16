import { describe, it, expect } from "vitest";
import { parseBlocks } from "../src/webview/blocks";

const htmlOf = (src: string): string =>
  parseBlocks(src)
    .map((b) => b.html)
    .join("\n");

describe("markdown renderer", () => {
  it("renders headings, paragraphs, and inline emphasis", () => {
    const html = htmlOf("# Title\n\nWith **bold** and *italic*.\n");
    expect(html).toContain("<h1>Title</h1>");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<em>italic</em>");
  });

  it("renders GFM tables, strikethrough, autolinks, and fenced code", () => {
    const table = htmlOf("| A | B |\n|---|---|\n| 1 | 2 |\n");
    expect(table).toContain("<table>");
    expect(table).toContain("<th>A</th>");
    expect(htmlOf("~~gone~~\n")).toContain("<s>gone</s>");
    expect(htmlOf("Visit https://example.com today\n")).toContain('<a href="https://example.com">');
    const code = htmlOf("```js\nconst x = 1;\n```\n");
    expect(code).toContain("<pre><code");
    expect(code).toContain("const x = 1;");
  });

  it("renders GFM task lists as disabled checkboxes", () => {
    const html = htmlOf("- [x] done\n- [ ] todo\n");
    expect(html).toContain('type="checkbox"');
    expect(html).toContain("checked");
    expect(html).toContain("disabled");
  });

  it("escapes raw HTML to literal text instead of rendering it (html off)", () => {
    const html = htmlOf("<script>alert(1)</script>\n");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("preserves block order", () => {
    const blocks = parseBlocks("# One\n\nTwo\n\n## Three\n");
    expect(blocks.map((b) => b.type)).toEqual([
      "heading_open",
      "paragraph_open",
      "heading_open",
    ]);
  });
});

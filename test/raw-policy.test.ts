import { describe, it, expect } from "vitest";
import { parseBlocks } from "../src/webview/blocks";

describe("raw HTML block policy (#6)", () => {
  const src = "<details>\n<summary>S</summary>\n<p>Body</p>\n</details>\n";
  const block = parseBlocks(src)[0];

  it("classifies a raw HTML block as html_block", () => {
    expect(block.type).toBe("html_block");
  });

  it("renders it as escaped raw source, not live HTML", () => {
    expect(block.html).toContain('class="raw-text-block"');
    expect(block.html).toContain("&lt;details&gt;");
    expect(block.html).not.toContain("<details>");
    expect(block.html).not.toContain("<summary>");
  });

  it("round-trips the raw source byte-for-byte", () => {
    expect(block.raw).toBe("<details>\n<summary>S</summary>\n<p>Body</p>\n</details>");
  });

  it("does not misclassify autolink paragraphs as HTML blocks", () => {
    expect(parseBlocks("Autolink: <https://example.com>.\n")[0].type).toBe("paragraph_open");
    expect(parseBlocks("Email: <user@example.com>.\n")[0].type).toBe("paragraph_open");
  });
});

describe("non-GFM inline extensions render as literal text (#6)", () => {
  const html = parseBlocks("++inserted++ ==marked== H~2~O E=mc^2^ :thumbsup:\n")[0].html;

  it("keeps the unsupported markup literal", () => {
    expect(html).toContain("++inserted++");
    expect(html).toContain("==marked==");
    expect(html).toContain("H~2~O");
    expect(html).toContain("^2^");
    expect(html).toContain(":thumbsup:");
  });

  it("does not emit ins/mark/sub/sup elements for them", () => {
    expect(html).not.toContain("<ins>");
    expect(html).not.toContain("<mark>");
    expect(html).not.toContain("<sub>");
    expect(html).not.toContain("<sup>");
  });
});

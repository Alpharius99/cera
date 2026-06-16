import { describe, it, expect } from "vitest";
import { spliceBlock } from "../src/splice";

describe("spliceBlock (#9)", () => {
  it("replaces a single-line block", () => {
    expect(spliceBlock("# One\n\nTwo\n", 0, 1, "# Edited")).toBe("# Edited\n\nTwo\n");
  });

  it("replaces a multi-line block", () => {
    expect(spliceBlock("a\nb\nc\n\ntail\n", 0, 3, "X\nY")).toBe("X\nY\n\ntail\n");
  });

  it("splits one block into multiple lines", () => {
    expect(spliceBlock("para\n", 0, 1, "line1\n\nline2")).toBe("line1\n\nline2\n");
  });

  it("edits the last block with no trailing newline", () => {
    expect(spliceBlock("# H", 0, 1, "# J")).toBe("# J");
  });

  it("leaves surrounding content untouched", () => {
    const src = "# Title\n\nBody paragraph.\n\n## Next\n";
    expect(spliceBlock(src, 2, 3, "Edited body.")).toBe("# Title\n\nEdited body.\n\n## Next\n");
  });

  it("preserves CRLF line endings (#32)", () => {
    expect(spliceBlock("# H\r\n\r\nBody.\r\n", 0, 1, "# J")).toBe("# J\r\n\r\nBody.\r\n");
  });

  it("converts the new text's newlines to the source EOL (#32)", () => {
    // Editor text is LF; splicing into a CRLF document yields CRLF.
    expect(spliceBlock("a\r\nb\r\n", 0, 1, "x\ny")).toBe("x\r\ny\r\nb\r\n");
  });
});

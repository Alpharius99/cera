import { describe, it, expect } from "vitest";
import { spliceBlock, resolveBlockRange } from "../src/splice";

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

describe("resolveBlockRange (#10)", () => {
  it("is clean when the block is still at its original lines", () => {
    const res = resolveBlockRange("# Title\n\nBody.\n\n## Next\n\nMore\n", "# Title", 0, 1);
    expect(res).toEqual({ status: "clean", startLine: 0, endLine: 1 });
  });

  it("rebases when an edit above shifted the block down", () => {
    const after = "Prepended.\n\n# Title\n\nBody.\n";
    expect(resolveBlockRange(after, "Body.", 2, 3)).toEqual({ status: "clean", startLine: 4, endLine: 5 });
  });

  it("rebases a multi-line block by its full content", () => {
    const after = "x\n\n```\ncode\n```\n";
    expect(resolveBlockRange(after, "```\ncode\n```", 0, 3)).toEqual({
      status: "clean",
      startLine: 2,
      endLine: 5,
    });
  });

  it("conflicts when the block text changed underneath", () => {
    expect(resolveBlockRange("# Title\n\nBody EDITED.\n", "Body.", 2, 3)).toEqual({ status: "conflict" });
  });

  it("conflicts when the shifted block is ambiguous (appears more than once)", () => {
    // Opened on line 2, but it now holds other text and "Body." appears twice
    // elsewhere — too ambiguous to rebase safely.
    expect(resolveBlockRange("Body.\n\nX\n\nBody.\n", "Body.", 2, 3)).toEqual({ status: "conflict" });
  });

  it("rebased commit preserves unrelated content (no corruption)", () => {
    // Editor opened on "Body." [2,3]; externally a line was inserted at the top.
    const externallyEdited = "Inserted top.\n\n# Title\n\nBody.\n";
    const res = resolveBlockRange(externallyEdited, "Body.", 2, 3);
    expect(res.status).toBe("clean");
    if (res.status === "clean") {
      const committed = spliceBlock(externallyEdited, res.startLine, res.endLine, "Body EDITED.");
      expect(committed).toBe("Inserted top.\n\n# Title\n\nBody EDITED.\n");
    }
  });
});

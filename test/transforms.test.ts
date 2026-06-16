import { describe, it, expect } from "vitest";
import {
  bold,
  italic,
  strikethrough,
  inlineCode,
  link,
  codeBlock,
  bulletList,
  numberedList,
  checklist,
  TRANSFORMS,
  Transform,
} from "../src/webview/transforms";

// All transforms are pure (doc, selection) -> {text, selection}, so they are
// tested directly with no DOM (#17). Selections are written with «guillemets»
// (which never appear in Markdown content, unlike [], so link/checkbox text
// can't collide with the notation).

function parse(marked: string): { doc: string; from: number; to: number } {
  const from = marked.indexOf("«");
  const withoutOpen = marked.slice(0, from) + marked.slice(from + 1);
  const to = withoutOpen.indexOf("»");
  const doc = withoutOpen.slice(0, to) + withoutOpen.slice(to + 1);
  return { doc, from, to };
}

// Apply a transform to a «selection» string and render the result with the new
// selection wrapped in «».
function run(transform: Transform, marked: string): string {
  const { doc, from, to } = parse(marked);
  const result = transform(doc, { from, to });
  const s = result.selection;
  return result.text.slice(0, s.from) + "«" + result.text.slice(s.from, s.to) + "»" + result.text.slice(s.to);
}

describe("inline transforms (#17)", () => {
  it("bold wraps and keeps the text selected", () => {
    expect(run(bold, "«word»")).toBe("**«word»**");
  });

  it("bold toggles off when the selection is already bold", () => {
    expect(run(bold, "«**word**»")).toBe("«word»");
  });

  it("bold toggles off when the markers sit just outside the selection", () => {
    expect(run(bold, "**«word»**")).toBe("«word»");
  });

  it("italic, strikethrough, and inline code wrap with their markers", () => {
    expect(run(italic, "«word»")).toBe("*«word»*");
    expect(run(strikethrough, "«word»")).toBe("~~«word»~~");
    expect(run(inlineCode, "«word»")).toBe("`«word»`");
  });

  it("inline transforms apply within surrounding text", () => {
    expect(run(bold, "a «word» b")).toBe("a **«word»** b");
  });
});

describe("link transform (#17)", () => {
  it("wraps the selection and selects the url placeholder", () => {
    expect(run(link, "«text»")).toBe("[text](«url»)");
  });

  it("toggles an existing link back to its text", () => {
    expect(run(link, "«[text](https://x)»")).toBe("«text»");
  });
});

describe("line transforms (#17)", () => {
  it("bullet list prefixes a single line", () => {
    expect(run(bulletList, "«one»")).toBe("«- one»");
  });

  it("bullet list prefixes every line of a multi-line selection", () => {
    expect(run(bulletList, "«one\ntwo»")).toBe("«- one\n- two»");
  });

  it("bullet list toggles off when all lines are already bulleted", () => {
    expect(run(bulletList, "«- one\n- two»")).toBe("«one\ntwo»");
  });

  it("numbered list numbers each line incrementally", () => {
    expect(run(numberedList, "«one\ntwo\nthree»")).toBe("«1. one\n2. two\n3. three»");
  });

  it("checklist prefixes and toggles task items", () => {
    expect(run(checklist, "«a\nb»")).toBe("«- [ ] a\n- [ ] b»");
    expect(run(checklist, "«- [ ] a\n- [x] b»")).toBe("«a\nb»");
  });

  it("expands a partial selection to whole lines", () => {
    // selection covers only "ne/tw" but the prefix applies to full lines
    expect(run(bulletList, "o«ne\ntw»o")).toBe("«- one\n- two»");
  });
});

describe("code block transform (#17)", () => {
  it("fences the selected lines", () => {
    expect(run(codeBlock, "«a\nb»")).toBe("«```\na\nb\n```»");
  });

  it("toggles off an existing fenced block", () => {
    expect(run(codeBlock, "«```\na\nb\n```»")).toBe("«a\nb»");
  });
});

describe("transform registry (#17)", () => {
  it("exposes all nine formatting actions", () => {
    expect(Object.keys(TRANSFORMS).sort()).toEqual(
      [
        "bold",
        "bulletList",
        "checklist",
        "codeBlock",
        "inlineCode",
        "italic",
        "link",
        "numberedList",
        "strikethrough",
      ].sort(),
    );
  });

  it("every transform preserves a non-empty selection on apply", () => {
    for (const transform of Object.values(TRANSFORMS)) {
      const result = transform("word", { from: 0, to: 4 });
      expect(result.selection.to).toBeGreaterThan(result.selection.from);
    }
  });
});

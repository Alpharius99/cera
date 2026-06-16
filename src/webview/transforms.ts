// Shared Markdown formatting transforms (#17), used by the selection bubble
// (#16), slash commands (#15), and the chord overlay (#19). Each transform is a
// pure function over a document string and a selection range, returning the new
// document and the selection to restore afterwards — so callers (CodeMirror or
// tests) stay thin and selection context is never lost. Every transform applies
// on first use and toggles off when re-applied to already-formatted text.

/** A selection range over a document, end-exclusive. */
export interface Selection {
  from: number;
  to: number;
}

export interface TransformResult {
  text: string;
  selection: Selection;
}

export type Transform = (doc: string, selection: Selection) => TransformResult;

/** Wrap/unwrap an inline span with a symmetric marker (bold, italic, etc.). */
function inlineMarker(marker: string): Transform {
  const len = marker.length;
  return (doc, { from, to }) => {
    const selected = doc.slice(from, to);
    // Toggle off when the markers sit inside the selection (e.g. "**x**" picked).
    if (selected.length >= 2 * len && selected.startsWith(marker) && selected.endsWith(marker)) {
      const inner = selected.slice(len, selected.length - len);
      return {
        text: doc.slice(0, from) + inner + doc.slice(to),
        selection: { from, to: from + inner.length },
      };
    }
    // Toggle off when the markers sit just outside the selection ("x" inside **x**).
    if (doc.slice(from - len, from) === marker && doc.slice(to, to + len) === marker) {
      return {
        text: doc.slice(0, from - len) + selected + doc.slice(to + len),
        selection: { from: from - len, to: to - len },
      };
    }
    // Apply: wrap and keep the original text selected.
    return {
      text: doc.slice(0, from) + marker + selected + marker + doc.slice(to),
      selection: { from: from + len, to: to + len },
    };
  };
}

export const bold = inlineMarker("**");
export const italic = inlineMarker("*");
export const strikethrough = inlineMarker("~~");
export const inlineCode = inlineMarker("`");

/** Turn the selection into a link `[text](url)` (or unwrap an existing one). */
export const link: Transform = (doc, { from, to }) => {
  const selected = doc.slice(from, to);
  const existing = /^\[([^\]]*)\]\(([^)]*)\)$/.exec(selected);
  if (existing) {
    const inner = existing[1];
    return {
      text: doc.slice(0, from) + inner + doc.slice(to),
      selection: { from, to: from + inner.length },
    };
  }
  const placeholder = "url";
  const replacement = `[${selected}](${placeholder})`;
  // Select the placeholder so the caller/user can type the destination.
  const urlFrom = from + selected.length + 3; // past "[selected]("
  return {
    text: doc.slice(0, from) + replacement + doc.slice(to),
    selection: { from: urlFrom, to: urlFrom + placeholder.length },
  };
};

/** Expand a selection to cover the whole lines it touches. */
function lineSpan(doc: string, from: number, to: number): { start: number; end: number } {
  const start = doc.lastIndexOf("\n", from - 1) + 1;
  const nextNewline = doc.indexOf("\n", to);
  const end = nextNewline === -1 ? doc.length : nextNewline;
  return { start, end };
}

/** Add or remove a per-line prefix across every line in the selection. */
function linePrefix(matcher: RegExp, prefixFor: (index: number) => string): Transform {
  return (doc, { from, to }) => {
    const { start, end } = lineSpan(doc, from, to);
    const lines = doc.slice(start, end).split("\n");
    const allPrefixed = lines.every((line) => matcher.test(line));
    const next = allPrefixed
      ? lines.map((line) => line.replace(matcher, ""))
      : lines.map((line, index) => prefixFor(index) + line);
    const block = next.join("\n");
    return {
      text: doc.slice(0, start) + block + doc.slice(end),
      selection: { from: start, to: start + block.length },
    };
  };
}

export const bulletList = linePrefix(/^- /, () => "- ");
export const numberedList = linePrefix(/^\d+\. /, (index) => `${index + 1}. `);
export const checklist = linePrefix(/^- \[[ x]\] /, () => "- [ ] ");

/** Wrap the selected lines in a fenced code block (or unwrap an existing one). */
export const codeBlock: Transform = (doc, { from, to }) => {
  const { start, end } = lineSpan(doc, from, to);
  const lines = doc.slice(start, end).split("\n");
  if (lines.length >= 2 && lines[0] === "```" && lines[lines.length - 1] === "```") {
    const inner = lines.slice(1, -1).join("\n");
    return {
      text: doc.slice(0, start) + inner + doc.slice(end),
      selection: { from: start, to: start + inner.length },
    };
  }
  const block = "```\n" + lines.join("\n") + "\n```";
  return {
    text: doc.slice(0, start) + block + doc.slice(end),
    selection: { from: start, to: start + block.length },
  };
};

/** The nine shared formatting actions, keyed by name. */
export const TRANSFORMS = {
  bold,
  italic,
  strikethrough,
  inlineCode,
  link,
  codeBlock,
  bulletList,
  numberedList,
  checklist,
} satisfies Record<string, Transform>;

export type TransformName = keyof typeof TRANSFORMS;

import MarkdownIt from "markdown-it";
import taskLists from "markdown-it-task-lists";

// CommonMark + GFM. Tables and strikethrough are on in markdown-it's default
// preset; linkify covers GFM autolinks and the task-lists plugin covers GFM
// checkboxes. `html: false` is the HTML-block policy (#6): raw HTML is escaped
// to literal text rather than rendered as live markup.
const md = new MarkdownIt({ html: false, linkify: true }).use(taskLists);

// Classifier used ONLY to locate real HTML blocks via CommonMark's block rules
// (a paragraph that merely starts with `<`, e.g. an autolink, is not one). It
// never renders live HTML: matched blocks are re-emitted as escaped raw source
// below. The render instance stays `html: false` — that is the policy (#6).
const classifier = new MarkdownIt({ html: true, linkify: true });

function htmlBlockStartLines(src: string): Set<number> {
  const starts = new Set<number>();
  for (const token of classifier.parse(src, {})) {
    if (token.level === 0 && token.type === "html_block" && token.map) {
      starts.add(token.map[0]);
    }
  }
  return starts;
}

/** Raw HTML / special-case content shown as faithful, non-executable source. */
function rawTextBlock(raw: string): string {
  return `<pre class="raw-text-block">${md.utils.escapeHtml(raw)}</pre>`;
}

/** One top-level Markdown block: a rendered unit with a stable index + range. */
export interface Block {
  /** Position in document order, starting at 0. */
  index: number;
  /** markdown-it token type of the opening token (e.g. heading_open, fence). */
  type: string;
  /** Source line range [start, end) — 0-based, end-exclusive. */
  map: [number, number];
  /** Raw source text for the block (the exact lines in `map`). */
  raw: string;
  /** Rendered HTML for the block (unsanitized; sanitize before injecting). */
  html: string;
}

/**
 * Parse Markdown into an ordered list of top-level blocks, each carrying its
 * source range (verified round-trippable by the #4 spike) and rendered HTML.
 *
 * Tokens are grouped by nesting depth: a block runs from a depth-0 token until
 * the depth returns to 0, so containers (lists, blockquotes, tables) and their
 * children form a single block. Constructs that emit no token (link reference
 * definitions) are simply absent from the model; special-case raw classification
 * is handled separately (#20).
 */
export function parseBlocks(src: string): Block[] {
  const lines = src.split("\n");
  const tokens = md.parse(src, {});
  const htmlStarts = htmlBlockStartLines(src);
  const blocks: Block[] = [];

  let depth = 0;
  let start = -1;
  for (let i = 0; i < tokens.length; i++) {
    if (start === -1) {
      start = i;
    }
    depth += tokens[i].nesting;
    if (depth === 0) {
      const group = tokens.slice(start, i + 1);
      const head = group[0];
      if (head.map) {
        const [s, e] = head.map;
        const raw = lines.slice(s, e).join("\n");
        // Raw HTML blocks are shown as faithful, non-executable source rather
        // than rendered (#6). Everything else renders normally.
        const isRawHtml = htmlStarts.has(s);
        blocks.push({
          index: blocks.length,
          type: isRawHtml ? "html_block" : head.type,
          map: [s, e],
          raw,
          html: isRawHtml ? rawTextBlock(raw) : md.renderer.render(group, md.options, {}),
        });
      }
      start = -1;
    }
  }

  return blocks;
}

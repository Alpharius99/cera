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

// Diagram fences are special-case placeholders (#20); the v1 diagram handling
// policy itself is decided separately (#31).
const DIAGRAM_LANGS = new Set(["mermaid", "plantuml"]);

/** How a block is presented: normally rendered, shown as raw source, or a
 *  special-case placeholder. Every block receives exactly one classification. */
export type BlockKind = "rendered" | "raw" | "special";

/** One top-level Markdown block: a unit with a stable index, range, and kind. */
export interface Block {
  /** Position in document order, starting at 0. */
  index: number;
  /** Block type, e.g. heading_open, fence, html_block, front_matter, ref_definition. */
  type: string;
  /** Classification used for rendering and complete-visibility guarantees. */
  kind: BlockKind;
  /** Source line range [start, end) — 0-based, end-exclusive. */
  map: [number, number];
  /** Raw source text for the block (the exact lines in `map`). */
  raw: string;
  /** Rendered HTML for the block (unsanitized; sanitize before injecting). */
  html: string;
}

type PendingBlock = Omit<Block, "index">;

function htmlBlockStartLines(src: string): Set<number> {
  const starts = new Set<number>();
  for (const token of classifier.parse(src, {})) {
    if (token.level === 0 && token.type === "html_block" && token.map) {
      starts.add(token.map[0]);
    }
  }
  return starts;
}

/** Raw / special-case content shown as faithful, non-executable source. */
function rawTextBlock(raw: string): string {
  return `<pre class="raw-text-block">${md.utils.escapeHtml(raw)}</pre>`;
}

/** Special-case placeholder for a diagram fence: a label plus its source. */
function diagramPlaceholder(raw: string, lang: string): string {
  const safeLang = md.utils.escapeHtml(lang);
  return (
    `<div class="cera-diagram" data-diagram-lang="${safeLang}">` +
    `<div class="cera-diagram-label">Diagram: ${safeLang}</div>` +
    rawTextBlock(raw) +
    `</div>`
  );
}

/** Leading YAML front matter end line (exclusive), or 0 if there is none. */
function frontMatterEnd(lines: string[]): number {
  if (lines[0] !== "---") {
    return 0;
  }
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === "---" || lines[i] === "...") {
      return i + 1;
    }
  }
  return 0;
}

function isReferenceDefinition(line: string): boolean {
  return /^ {0,3}\[[^\]]+\]:/.test(line);
}

/**
 * Parse Markdown into an ordered list of top-level blocks. Every block carries a
 * stable index, its source range (round-trippable per the #4 spike), and a
 * classification (#20): `rendered` Markdown, `raw` source (front matter, raw
 * HTML, link reference definitions), or a `special` placeholder (diagram fences).
 *
 * Front matter is stripped before markdown-it so the closing `---` is not
 * misread as a setext underline, and any source line not claimed by a token
 * block (e.g. reference definitions) is emitted as a raw block — so no content
 * is hidden.
 */
export function parseBlocks(src: string): Block[] {
  // Normalize to LF lines so the block model is EOL-agnostic (#32). markdown-it
  // normalizes internally too; the original EOL is re-applied at the splice
  // boundary (src/splice.ts, the host's commit).
  const lines = src.split(/\r?\n/);
  const pending: PendingBlock[] = [];

  // Front matter -> a single raw block at the top.
  const fmEnd = frontMatterEnd(lines);
  if (fmEnd > 0) {
    const raw = lines.slice(0, fmEnd).join("\n");
    pending.push({ type: "front_matter", kind: "raw", map: [0, fmEnd], raw, html: rawTextBlock(raw) });
  }

  // Parse the body (after any front matter); offset token ranges back to source.
  const body = lines.slice(fmEnd).join("\n");
  const tokens = md.parse(body, {});
  const htmlStarts = htmlBlockStartLines(body);
  const covered = new Set<number>();

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
        const s = head.map[0] + fmEnd;
        const e = head.map[1] + fmEnd;
        for (let ln = s; ln < e; ln++) {
          covered.add(ln);
        }
        const raw = lines.slice(s, e).join("\n");
        const lang = head.type === "fence" ? head.info.trim().split(/\s+/)[0] : "";
        if (htmlStarts.has(head.map[0])) {
          pending.push({ type: "html_block", kind: "raw", map: [s, e], raw, html: rawTextBlock(raw) });
        } else if (DIAGRAM_LANGS.has(lang)) {
          pending.push({ type: "fence", kind: "special", map: [s, e], raw, html: diagramPlaceholder(raw, lang) });
        } else {
          pending.push({
            type: head.type,
            kind: "rendered",
            map: [s, e],
            raw,
            html: md.renderer.render(group, md.options, {}),
          });
        }
      }
      start = -1;
    }
  }

  // Any non-blank line not claimed by a token block (e.g. link reference
  // definitions) becomes a raw block so nothing is hidden. Consecutive
  // uncovered lines are grouped into one block.
  let runStart = -1;
  for (let ln = fmEnd; ln <= lines.length; ln++) {
    const uncovered = ln < lines.length && lines[ln].trim() !== "" && !covered.has(ln);
    if (uncovered) {
      if (runStart === -1) {
        runStart = ln;
      }
    } else if (runStart !== -1) {
      const raw = lines.slice(runStart, ln).join("\n");
      const type = isReferenceDefinition(lines[runStart]) ? "ref_definition" : "raw_text";
      pending.push({ type, kind: "raw", map: [runStart, ln], raw, html: rawTextBlock(raw) });
      runStart = -1;
    }
  }

  // Order by source position and assign stable indexes.
  pending.sort((a, b) => a.map[0] - b.map[0]);
  return pending.map((block, index) => ({ index, ...block }));
}

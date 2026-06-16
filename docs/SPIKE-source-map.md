# Spike: markdown-it block ranges for source mapping (#4)

**Question.** Are markdown-it token `.map` line ranges precise enough to drive
Phase 2's block-level source splice, or do we need an alternative ranging
approach?

**Verdict.** **Confirmed.** Token `.map` ranges are precise and non-overlapping
for every CommonMark + GFM block type in `fixtures/sample.md`, with two
constructs that carry no usable range and fall back to atomic raw-text handling
(below). Phase 2 splice can be designed against token ranges.

## Method

Parsed `fixtures/sample.md` with `markdown-it({ html: false, linkify: true })`
(CommonMark + GFM; tables and strikethrough are on in the default preset). For
each top-level token (`level === 0` with a `.map`), took the `[start, end)`
line range and checked: every block has a range, ranges don't overlap, the raw
line-slice round-trips, and which non-blank lines no block claims.

Reproducible as `test/source-map.spike.test.ts` (runs under `npm test`).

## Results

- **Every supported block type round-trips** from its `.map` range: ATX and
  setext headings, paragraphs, tight / loose / nested / ordered / non-1-start /
  task lists, multi-paragraph list items, blockquotes (incl. 3-level nesting and
  quote-with-fenced-code), fenced code (with/without info string, and
  mermaid/plantuml), indented code blocks, GFM tables, thematic breaks.
- **Zero overlapping ranges.** Blank lines between blocks are excluded from
  every range, so blocks are disjoint and the gaps are pure separators — exactly
  what a splice needs.
- **Raw HTML blocks** (`<details>`, `<div>`) parse as paragraph tokens because
  `html: false`, i.e. they are shown as literal source — consistent with the
  Phase 1 HTML-block policy — and their `.map` ranges are precise.

## Fallback behavior (coarse / missing ranges)

Two constructs do **not** yield a usable per-block range. Both are handled by the
general **atomic-block** rule: re-derive the block's range by re-tokenizing on
commit, edit the whole block as raw source, and never splice a partial range.

1. **YAML front matter — misparsed, not just missing.** Without preprocessing,
   the leading `---` becomes a thematic break and the trailing `---` is consumed
   as a setext-heading underline, so the YAML body is misread as a heading
   (`heading_open` over lines 2–6). **Mitigation:** detect and strip front matter
   before markdown-it sees it, and emit it as an atomic `raw-text-block` that
   round-trips byte-for-byte (Phase 7 fidelity requirement). Do **not** rely on
   `.map` for it. **Phase 1 classification:** front matter is a `raw` block —
   implemented in #20, and covered as tested behavior (source range, terminator
   variants, byte-for-byte round-trip) by the front-matter spike tests (#22).
2. **Link reference definitions** (`[ref]: url "title"`). markdown-it consumes
   these into its reference map and emits **no token**, so their lines are
   unclaimed. **Mitigation:** treat each definition line as an atomic raw-text
   block, re-derived by scanning; never partially spliced.

## Implication for Phase 2

The splice design proceeds on token `.map` ranges. Each top-level block keeps a
stable index and its `[start, end)` line range; commits replace exactly that
line span. Front matter and reference definitions are classified as atomic
raw-text blocks up front (see #5/#20), keeping the splice path uniform.

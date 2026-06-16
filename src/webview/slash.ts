import { CompletionContext, CompletionResult } from "@codemirror/autocomplete";

/** One slash command shown in the inline autocomplete menu (#14, #15). */
export interface SlashCommand {
  /** Menu label, including the leading slash so it reads as a command. */
  label: string;
  /** Short description shown beside the label. */
  detail: string;
  /** Extra terms the query is matched against, e.g. `tb` for the table. */
  aliases?: string[];
  /** Block-level Markdown inserted in place of the slash token. */
  insert: string;
}

// The Phase 4 slash command registry. Each `insert` is valid block-level
// Markdown; `matchSlashCommands` resolves a typed query (including short fuzzy
// forms like `/tb`) to these, and the completion source applies the insert.
export const SLASH_COMMANDS: SlashCommand[] = [
  { label: "/h1", detail: "Heading 1", insert: "# " },
  { label: "/h2", detail: "Heading 2", insert: "## " },
  { label: "/h3", detail: "Heading 3", insert: "### " },
  { label: "/h4", detail: "Heading 4", insert: "#### " },
  { label: "/h5", detail: "Heading 5", insert: "##### " },
  { label: "/h6", detail: "Heading 6", insert: "###### " },
  {
    label: "/table",
    detail: "Table",
    aliases: ["tb"],
    insert: "| Header | Header |\n| --- | --- |\n| Cell | Cell |\n",
  },
  { label: "/code", detail: "Code block", aliases: ["fence"], insert: "```\n\n```\n" },
  { label: "/quote", detail: "Blockquote", aliases: ["blockquote"], insert: "> " },
  { label: "/hr", detail: "Divider", aliases: ["rule", "divider"], insert: "---\n" },
  { label: "/list", detail: "Bulleted list", aliases: ["bullet", "ul"], insert: "- " },
  { label: "/checklist", detail: "Task list", aliases: ["todo", "check"], insert: "- [ ] " },
];

/**
 * Score `query` against a candidate `target` (both lower-case). A prefix match
 * scores best (by how much of the target is left), a non-contiguous subsequence
 * match scores worse (penalised by the gaps), and a non-match returns null. This
 * is what makes `tb` resolve to `table` while keeping exact prefixes on top.
 */
function fuzzyScore(query: string, target: string): number | null {
  if (query === "") {
    return 0;
  }
  if (target.startsWith(query)) {
    return target.length - query.length;
  }
  let qi = 0;
  let score = 0;
  let prev = -1;
  for (let ti = 0; ti < target.length && qi < query.length; ti++) {
    if (target[ti] === query[qi]) {
      score += ti - prev;
      prev = ti;
      qi++;
    }
  }
  return qi === query.length ? 1000 + score : null;
}

/**
 * Resolve a typed query (the text after the `/`) to matching commands, best
 * first. An empty query lists every command; otherwise each command is matched
 * against its name and aliases, fuzzily, so `tb` finds the table and `h` finds
 * all the headings (#15).
 */
export function matchSlashCommands(query: string): SlashCommand[] {
  const q = query.toLowerCase();
  if (q === "") {
    return SLASH_COMMANDS;
  }
  const scored: Array<{ command: SlashCommand; score: number }> = [];
  for (const command of SLASH_COMMANDS) {
    const terms = [command.label.slice(1), ...(command.aliases ?? [])];
    let best = Infinity;
    for (const term of terms) {
      const score = fuzzyScore(q, term.toLowerCase());
      if (score !== null) {
        best = Math.min(best, score);
      }
    }
    if (best !== Infinity) {
      scored.push({ command, score: best });
    }
  }
  scored.sort((a, b) => a.score - b.score);
  return scored.map((entry) => entry.command);
}

/**
 * CodeMirror completion source for the slash menu (#14). It fires only when a
 * `/` begins the current line — the slash token runs from the line start to the
 * caret — so a slash typed mid-line (e.g. a URL path) never pops the menu and
 * unrelated editor input is left alone. Matching/ranking is done here (#15), so
 * the result opts out of CodeMirror's own filtering.
 */
export function slashCompletions(context: CompletionContext): CompletionResult | null {
  const token = context.matchBefore(/\/\w*/);
  if (!token) {
    return null;
  }
  const line = context.state.doc.lineAt(context.pos);
  if (token.from !== line.from) {
    return null;
  }
  const matches = matchSlashCommands(token.text.slice(1));
  if (matches.length === 0) {
    return null;
  }
  return {
    from: token.from,
    filter: false,
    options: matches.map((command) => ({
      label: command.label,
      detail: command.detail,
      apply: command.insert,
      type: "keyword",
    })),
  };
}

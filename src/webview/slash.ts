import { CompletionContext, CompletionResult } from "@codemirror/autocomplete";

/** One slash command shown in the inline autocomplete menu (#14). */
export interface SlashCommand {
  /** Menu label, including the leading slash so typed text filters naturally. */
  label: string;
  /** Short description shown beside the label. */
  detail: string;
  /** Text the slash token is replaced with when the command is chosen. These
   *  are simple block prefixes for now; the richer, selection-aware insertion
   *  transforms are owned by #15. */
  replacement: string;
}

/** The slash command registry. The menu UI (#14) renders these; #15 turns the
 *  replacements into full insertion transforms. */
export const SLASH_COMMANDS: SlashCommand[] = [
  { label: "/h1", detail: "Heading 1", replacement: "# " },
  { label: "/h2", detail: "Heading 2", replacement: "## " },
  { label: "/h3", detail: "Heading 3", replacement: "### " },
  { label: "/bullet", detail: "Bulleted list", replacement: "- " },
  { label: "/numbered", detail: "Numbered list", replacement: "1. " },
  { label: "/task", detail: "Task list item", replacement: "- [ ] " },
  { label: "/quote", detail: "Blockquote", replacement: "> " },
  { label: "/code", detail: "Code block", replacement: "```\n\n```" },
  { label: "/divider", detail: "Divider", replacement: "---\n" },
];

/**
 * CodeMirror completion source for the slash menu (#14). It fires only when a
 * `/` begins the current line — the slash token runs from the line start to the
 * caret — so a slash typed mid-line (e.g. a URL path or inline math) never pops
 * the menu and unrelated editor input is left alone. Filtering of the returned
 * options by the typed text is handled by CodeMirror.
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
  return {
    from: token.from,
    options: SLASH_COMMANDS.map((command) => ({
      label: command.label,
      detail: command.detail,
      apply: command.replacement,
      type: "keyword",
    })),
  };
}

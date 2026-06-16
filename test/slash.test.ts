import { describe, it, expect } from "vitest";
import { EditorState } from "@codemirror/state";
import { CompletionContext } from "@codemirror/autocomplete";
import { slashCompletions, matchSlashCommands, SLASH_COMMANDS } from "../src/webview/slash";

// The completion source and matcher are pure functions of editor state + caret
// position, so they are tested directly against a real EditorState and
// CompletionContext — no DOM or CodeMirror view required (#14, #15).

// Build a context with the caret at the end of `doc` (or at `pos` if given).
function contextAt(doc: string, pos: number = doc.length): CompletionContext {
  return new CompletionContext(EditorState.create({ doc }), pos, false);
}

describe("slash command completion source (#14)", () => {
  it("offers all commands when a slash begins the line", () => {
    const result = slashCompletions(contextAt("/"));
    expect(result).not.toBeNull();
    expect(result!.from).toBe(0);
    expect(result!.options.map((o) => o.label)).toEqual(SLASH_COMMANDS.map((c) => c.label));
  });

  it("anchors the insertion at the slash so the token is replaced", () => {
    const result = slashCompletions(contextAt("/h1"));
    expect(result!.from).toBe(0); // start of the "/h1" token
    expect(result!.options[0]).toMatchObject({ label: "/h1", apply: "# " });
  });

  it("triggers at the start of any line, not just the first", () => {
    const doc = "First paragraph\n\n/";
    const result = slashCompletions(contextAt(doc));
    expect(result).not.toBeNull();
    expect(result!.from).toBe(doc.length - 1);
  });

  it("does not trigger for a slash that is not at the line start", () => {
    expect(slashCompletions(contextAt("see /usr/bin"))).toBeNull();
    expect(slashCompletions(contextAt("text /h"))).toBeNull();
  });

  it("does not trigger when there is no slash before the caret", () => {
    expect(slashCompletions(contextAt("plain text"))).toBeNull();
    expect(slashCompletions(contextAt(""))).toBeNull();
  });

  it("returns no result when the query matches nothing (menu closes)", () => {
    expect(slashCompletions(contextAt("/zzz"))).toBeNull();
  });
});

describe("slash command matching (#15)", () => {
  it("ranks an exact name first", () => {
    expect(matchSlashCommands("h1")[0].label).toBe("/h1");
    expect(matchSlashCommands("quote")[0].label).toBe("/quote");
  });

  it("fuzzily resolves a short form like /tb to the table", () => {
    expect(matchSlashCommands("tb")[0].label).toBe("/table");
  });

  it("resolves aliases", () => {
    expect(matchSlashCommands("todo")[0].label).toBe("/checklist");
    expect(matchSlashCommands("divider")[0].label).toBe("/hr");
  });

  it("returns every heading for the prefix 'h', headings first", () => {
    const headings = matchSlashCommands("h")
      .slice(0, 6)
      .map((c) => c.label);
    expect(headings).toEqual(["/h1", "/h2", "/h3", "/h4", "/h5", "/h6"]);
  });

  it("returns nothing for an unknown query", () => {
    expect(matchSlashCommands("zzz")).toEqual([]);
  });
});

describe("slash command insertion output (#15)", () => {
  it("every command has a slash label, a detail, and a non-empty insert", () => {
    for (const command of SLASH_COMMANDS) {
      expect(command.label.startsWith("/")).toBe(true);
      expect(command.detail.length).toBeGreaterThan(0);
      expect(command.insert.length).toBeGreaterThan(0);
    }
  });

  it("inserts valid block-level Markdown for each command", () => {
    const insertions = Object.fromEntries(SLASH_COMMANDS.map((c) => [c.label, c.insert]));
    expect(insertions).toMatchInlineSnapshot(`
      {
        "/checklist": "- [ ] ",
        "/code": "\`\`\`

      \`\`\`
      ",
        "/h1": "# ",
        "/h2": "## ",
        "/h3": "### ",
        "/h4": "#### ",
        "/h5": "##### ",
        "/h6": "###### ",
        "/hr": "---
      ",
        "/list": "- ",
        "/quote": "> ",
        "/table": "| Header | Header |
      | --- | --- |
      | Cell | Cell |
      ",
      }
    `);
  });
});

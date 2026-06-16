import { describe, it, expect } from "vitest";
import { EditorState } from "@codemirror/state";
import { CompletionContext } from "@codemirror/autocomplete";
import { slashCompletions, SLASH_COMMANDS } from "../src/webview/slash";

// The completion source is a pure function of editor state + caret position, so
// it is tested directly against a real EditorState and CompletionContext — no
// DOM or CodeMirror view required (#14).

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

  it("anchors the replacement at the slash so the token is replaced", () => {
    const result = slashCompletions(contextAt("/he"));
    expect(result!.from).toBe(0); // start of the "/he" token
    const h1 = result!.options.find((o) => o.label === "/h1");
    expect(h1?.apply).toBe("# ");
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

  it("every command carries a label, detail, and replacement", () => {
    for (const command of SLASH_COMMANDS) {
      expect(command.label.startsWith("/")).toBe(true);
      expect(command.detail.length).toBeGreaterThan(0);
      expect(command.replacement.length).toBeGreaterThan(0);
    }
  });
});

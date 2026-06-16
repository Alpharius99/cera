// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { createSelectionBubble, BUBBLE_GROUPS } from "../src/webview/bubble";

// The selection bubble is a plain DOM component, so its structure and click
// wiring are tested directly (#16). The CodeMirror glue (selection detection,
// positioning, transform dispatch) lives in editor.ts and is exercised in the
// running editor, not under jsdom.

describe("selection bubble component (#16)", () => {
  it("starts hidden and is a labelled toolbar", () => {
    const bubble = createSelectionBubble(() => {});
    expect(bubble.dom.hidden).toBe(true);
    expect(bubble.dom.getAttribute("role")).toBe("toolbar");
    expect(bubble.dom.getAttribute("aria-label")).toBe("Formatting");
  });

  it("renders nine buttons in three groups, in roadmap order", () => {
    const bubble = createSelectionBubble(() => {});
    const groups = bubble.dom.querySelectorAll(".cera-bubble-group");
    expect(groups.length).toBe(3);
    expect([...groups].map((g) => g.querySelectorAll("button").length)).toEqual([5, 1, 3]);

    const actions = [...bubble.dom.querySelectorAll<HTMLButtonElement>(".cera-bubble-button")].map(
      (b) => b.dataset.action,
    );
    expect(actions).toEqual([
      "bold",
      "italic",
      "link",
      "strikethrough",
      "inlineCode",
      "codeBlock",
      "bulletList",
      "numberedList",
      "checklist",
    ]);
  });

  it("names every button for screen readers and renders an aria-hidden codicon", () => {
    const bubble = createSelectionBubble(() => {});
    const buttons = [...bubble.dom.querySelectorAll<HTMLButtonElement>(".cera-bubble-button")];
    expect(buttons.every((b) => (b.getAttribute("aria-label") ?? "").length > 0)).toBe(true);
    const icons = bubble.dom.querySelectorAll(".cera-bubble-button .codicon");
    expect(icons.length).toBe(9);
    expect([...icons].every((i) => i.getAttribute("aria-hidden") === "true")).toBe(true);
  });

  it("applies the action on mousedown (so focus/selection is preserved)", () => {
    const applied: string[] = [];
    const bubble = createSelectionBubble((name) => applied.push(name));
    const boldButton = bubble.dom.querySelector<HTMLButtonElement>('[data-action="bold"]')!;
    const event = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
    boldButton.dispatchEvent(event);
    expect(applied).toEqual(["bold"]);
    expect(event.defaultPrevented, "default prevented to keep selection").toBe(true);
  });

  it("showAt reveals and positions the bubble; hide conceals it", () => {
    const bubble = createSelectionBubble(() => {});
    bubble.showAt(12, 34);
    expect(bubble.dom.hidden).toBe(false);
    expect(bubble.dom.style.left).toBe("12px");
    expect(bubble.dom.style.top).toBe("34px");
    bubble.hide();
    expect(bubble.dom.hidden).toBe(true);
  });

  it("exposes exactly the nine shared transform actions", () => {
    const names = BUBBLE_GROUPS.flat().map((b) => b.name);
    expect(new Set(names).size).toBe(9);
  });
});

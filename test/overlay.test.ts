// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { createChordOverlay } from "../src/webview/overlay";
import { CLAIMED_CHORDS } from "../src/webview/chords";

// DOM-level coverage of the chord overlay (#19). The hold-to-show / release-to-
// hide timing and dispatch live in the editor plugin; here we cover the
// component's structure and show/hide.

describe("chord overlay component (#19)", () => {
  it("starts hidden and is a labelled dialog", () => {
    const overlay = createChordOverlay();
    expect(overlay.dom.hidden).toBe(true);
    expect(overlay.dom.getAttribute("role")).toBe("dialog");
    expect(overlay.dom.getAttribute("aria-label")).toBe("Formatting shortcuts");
  });

  it("lists every claimed formatting chord with a key and a name", () => {
    const overlay = createChordOverlay();
    const items = overlay.dom.querySelectorAll(".cera-chord-list li");
    expect(items.length).toBe(CLAIMED_CHORDS.length);
    for (const item of items) {
      expect(item.querySelector(".cera-chord-key")?.textContent?.length).toBeGreaterThan(0);
      expect(item.querySelector(".cera-chord-name")?.textContent?.length).toBeGreaterThan(0);
    }
  });

  it("renders the modifier in each key label and names known actions", () => {
    const overlay = createChordOverlay();
    const names = [...overlay.dom.querySelectorAll(".cera-chord-name")].map((n) => n.textContent);
    expect(names).toContain("Bold");
    expect(names).toContain("Checklist");
    const firstKey = overlay.dom.querySelector(".cera-chord-key")?.textContent ?? "";
    expect(/⌘|Ctrl\+/.test(firstKey)).toBe(true);
  });

  it("show and hide toggle visibility", () => {
    const overlay = createChordOverlay();
    overlay.show();
    expect(overlay.dom.hidden).toBe(false);
    overlay.hide();
    expect(overlay.dom.hidden).toBe(true);
  });
});

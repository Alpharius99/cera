import { describe, it, expect, vi } from "vitest";
import { handleChordKeydown, ChordKeyEvent } from "../src/webview/chord-dispatch";
import { CHORD_MATRIX, ChordRow } from "../src/webview/chords";

// One test row per ownership-matrix entry (#19 gate): claimed chords apply
// exactly once and preventDefault; reserved chords are not intercepted. Tested
// against synthetic key events so no CodeMirror view is needed.

function eventFor(row: ChordRow, repeat = false): ChordKeyEvent & { preventDefault: ReturnType<typeof vi.fn> } {
  return {
    metaKey: true,
    ctrlKey: false,
    shiftKey: row.shift,
    key: row.key,
    repeat,
    preventDefault: vi.fn(),
  };
}

describe("chord dispatch per matrix row (#19)", () => {
  it.each(CHORD_MATRIX)("row %# ($label) dispatches per its owner", (row) => {
    const apply = vi.fn();
    const event = eventFor(row);
    const handled = handleChordKeydown(event, apply);

    if (row.owner === "webview") {
      expect(handled).toBe(true);
      expect(apply).toHaveBeenCalledTimes(1);
      expect(apply).toHaveBeenCalledWith(row.action);
      expect(event.preventDefault).toHaveBeenCalledTimes(1);
    } else {
      expect(handled).toBe(false);
      expect(apply).not.toHaveBeenCalled();
      expect(event.preventDefault).not.toHaveBeenCalled();
    }
  });
});

describe("chord dispatch behavior (#19)", () => {
  it("ignores auto-repeat so a claimed chord fires once per press", () => {
    const apply = vi.fn();
    const row = CHORD_MATRIX.find((r) => r.owner === "webview")!;
    const event = eventFor(row, true); // repeat = true
    expect(handleChordKeydown(event, apply)).toBe(false);
    expect(apply).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it("does not intercept a plain key without a modifier", () => {
    const apply = vi.fn();
    const event: ChordKeyEvent & { preventDefault: ReturnType<typeof vi.fn> } = {
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      key: "b",
      repeat: false,
      preventDefault: vi.fn(),
    };
    expect(handleChordKeydown(event, apply)).toBe(false);
    expect(apply).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it("works with Ctrl as the modifier too", () => {
    const apply = vi.fn();
    const event: ChordKeyEvent & { preventDefault: ReturnType<typeof vi.fn> } = {
      metaKey: false,
      ctrlKey: true,
      shiftKey: false,
      key: "b",
      repeat: false,
      preventDefault: vi.fn(),
    };
    expect(handleChordKeydown(event, apply)).toBe(true);
    expect(apply).toHaveBeenCalledWith("bold");
  });
});

import { describe, it, expect } from "vitest";
import { CHORD_MATRIX, CLAIMED_CHORDS, matchChord, ChordRow } from "../src/webview/chords";
import { TRANSFORMS } from "../src/webview/transforms";

// One test row per matrix entry (#18): the ownership matrix is the contract the
// chord overlay (#19) dispatches against, so every row is asserted directly.

// Synthesize the key event a chord row corresponds to (Mod held).
function eventFor(row: ChordRow, mod: "meta" | "ctrl" = "meta") {
  return {
    metaKey: mod === "meta",
    ctrlKey: mod === "ctrl",
    shiftKey: row.shift,
    key: row.key,
  };
}

describe("chord ownership matrix rows (#18)", () => {
  it.each(CHORD_MATRIX)("row %# ($label) is internally consistent", (row) => {
    if (row.owner === "webview") {
      expect(row.preventDefault, "claimed chords preventDefault").toBe(true);
      expect(row.action, "claimed chords carry an action").toBeDefined();
      expect(row.reservedFor).toBeUndefined();
    } else {
      expect(row.preventDefault, "reserved chords pass through").toBe(false);
      expect(row.action).toBeUndefined();
      expect(row.reservedFor, "reserved chords document their owner").toBeTruthy();
    }
  });

  it.each(CHORD_MATRIX)("row %# ($label) resolves back to itself via matchChord", (row) => {
    expect(matchChord(eventFor(row, "meta"))).toBe(row);
    expect(matchChord(eventFor(row, "ctrl"))).toBe(row);
  });
});

describe("chord matching (#18)", () => {
  it("requires a modifier", () => {
    expect(matchChord({ metaKey: false, ctrlKey: false, shiftKey: false, key: "b" })).toBeUndefined();
  });

  it("returns undefined for an unclaimed chord", () => {
    expect(matchChord({ metaKey: true, ctrlKey: false, shiftKey: false, key: "q" })).toBeUndefined();
  });

  it("distinguishes claimed Shift chords from reserved chords on the same letter", () => {
    const cut = matchChord({ metaKey: true, ctrlKey: false, shiftKey: false, key: "x" });
    const strike = matchChord({ metaKey: true, ctrlKey: false, shiftKey: true, key: "X" });
    expect(cut?.owner).toBe("vscode");
    expect(cut?.reservedFor).toBe("Cut (browser)");
    expect(strike?.owner).toBe("webview");
    expect(strike?.action).toBe("strikethrough");
  });

  it("normalizes the event key case", () => {
    expect(matchChord({ metaKey: true, ctrlKey: false, shiftKey: false, key: "B" })?.action).toBe("bold");
  });
});

describe("matrix integrity (#18)", () => {
  it("has no duplicate (key, shift) combinations", () => {
    const combos = CHORD_MATRIX.map((r) => `${r.key}:${r.shift}`);
    expect(new Set(combos).size).toBe(combos.length);
  });

  it("claims exactly the nine shared transforms, one chord each", () => {
    const actions = CLAIMED_CHORDS.map((r) => r.action);
    expect(new Set(actions).size).toBe(9);
    for (const action of actions) {
      expect(action && action in TRANSFORMS).toBe(true);
    }
    expect(new Set(actions)).toEqual(new Set(Object.keys(TRANSFORMS)));
  });
});

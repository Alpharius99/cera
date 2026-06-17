import { CLAIMED_CHORDS, ChordRow } from "./chords";
import { TransformName } from "./transforms";

// Human labels for the claimed formatting actions shown in the overlay (#19).
const ACTION_LABELS: Record<TransformName, string> = {
  bold: "Bold",
  italic: "Italic",
  link: "Link",
  strikethrough: "Strikethrough",
  inlineCode: "Inline code",
  codeBlock: "Code block",
  bulletList: "Bullet list",
  numberedList: "Numbered list",
  checklist: "Checklist",
};

// Modifier prefix for chord labels: ⌘ on macOS, "Ctrl+" elsewhere.
const MOD_PREFIX =
  typeof navigator !== "undefined" && /mac|iphone|ipad/i.test(navigator.platform) ? "⌘" : "Ctrl+";

function chordLabel(row: ChordRow): string {
  return MOD_PREFIX + row.label;
}

export interface ChordOverlay {
  dom: HTMLElement;
  show(): void;
  hide(): void;
  destroy(): void;
}

/**
 * Build the chord overlay (#19): a centered, informational card listing the
 * webview-claimed formatting shortcuts. It is reactive — shown after holding the
 * modifier and hidden on release — and never captures input itself.
 */
export function createChordOverlay(): ChordOverlay {
  const dom = document.createElement("div");
  dom.className = "cera-chord-overlay";
  dom.setAttribute("role", "dialog");
  dom.setAttribute("aria-label", "Formatting shortcuts");
  dom.hidden = true;

  const title = document.createElement("div");
  title.className = "cera-chord-title";
  title.textContent = "Formatting shortcuts";
  dom.appendChild(title);

  const list = document.createElement("ul");
  list.className = "cera-chord-list";
  for (const row of CLAIMED_CHORDS) {
    if (!row.action) {
      continue;
    }
    const item = document.createElement("li");
    const key = document.createElement("kbd");
    key.className = "cera-chord-key";
    key.textContent = chordLabel(row);
    const name = document.createElement("span");
    name.className = "cera-chord-name";
    name.textContent = ACTION_LABELS[row.action];
    item.append(key, name);
    list.appendChild(item);
  }
  dom.appendChild(list);

  return {
    dom,
    show() {
      dom.hidden = false;
    },
    hide() {
      dom.hidden = true;
    },
    destroy() {
      dom.remove();
    },
  };
}

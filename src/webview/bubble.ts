import { TransformName } from "./transforms";

/** One formatting button in the selection bubble. */
export interface BubbleButton {
  name: TransformName;
  label: string;
  /** VS Code codicon name (rendered as `codicon-<icon>`). */
  icon: string;
}

// The nine formatting buttons in three roadmap groups (#16): inline | block |
// lists. Order is preserved in the rendered toolbar.
export const BUBBLE_GROUPS: BubbleButton[][] = [
  [
    { name: "bold", label: "Bold", icon: "bold" },
    { name: "italic", label: "Italic", icon: "italic" },
    { name: "link", label: "Link", icon: "link" },
    { name: "strikethrough", label: "Strikethrough", icon: "strikethrough" },
    { name: "inlineCode", label: "Code", icon: "code" },
  ],
  [{ name: "codeBlock", label: "Code block", icon: "file-code" }],
  [
    { name: "bulletList", label: "Bullet list", icon: "list-unordered" },
    { name: "numberedList", label: "Numbered list", icon: "list-ordered" },
    { name: "checklist", label: "Checklist", icon: "checklist" },
  ],
];

export interface SelectionBubble {
  /** The toolbar element to mount over the editor. */
  dom: HTMLElement;
  /** Reveal the bubble at a position (px, relative to the offset parent). */
  showAt(left: number, top: number): void;
  hide(): void;
  destroy(): void;
}

/**
 * Build the selection-bubble toolbar (#16). It is a plain DOM component so it
 * can be tested without CodeMirror; the editor glue (selection detection,
 * positioning, applying transforms) lives in editor.ts. Buttons act on
 * `mousedown` with the default prevented, so pressing one never moves focus or
 * collapses the editor's selection — the click applies and keeps the selection.
 */
export function createSelectionBubble(onApply: (name: TransformName) => void): SelectionBubble {
  const dom = document.createElement("div");
  dom.className = "cera-bubble";
  dom.setAttribute("role", "toolbar");
  dom.setAttribute("aria-label", "Formatting");
  dom.hidden = true;

  for (const group of BUBBLE_GROUPS) {
    const groupEl = document.createElement("div");
    groupEl.className = "cera-bubble-group";
    for (const button of group) {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "cera-bubble-button";
      el.title = button.label;
      el.setAttribute("aria-label", button.label);
      el.dataset.action = button.name;
      const glyph = document.createElement("i");
      glyph.className = `codicon codicon-${button.icon}`;
      glyph.setAttribute("aria-hidden", "true");
      el.appendChild(glyph);
      el.addEventListener("mousedown", (event) => {
        event.preventDefault();
        event.stopPropagation();
        onApply(button.name);
      });
      groupEl.appendChild(el);
    }
    dom.appendChild(groupEl);
  }

  return {
    dom,
    showAt(left, top) {
      dom.style.left = `${left}px`;
      dom.style.top = `${top}px`;
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

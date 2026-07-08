// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createHeadingOutline } from "../src/webview/headingOutline";

let root: HTMLElement;

beforeEach(() => {
  document.body.innerHTML = '<main id="root"></main>';
  root = document.getElementById("root") as HTMLElement;
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

function block(index: number, heading: "h1" | "h2" | "h3" | "p", text: string): HTMLElement {
  const el = document.createElement("div");
  el.className = "cera-block";
  el.dataset.blockIndex = String(index);
  el.dataset.blockType = heading === "p" ? "paragraph_open" : "heading_open";
  if (heading === "p") {
    el.innerHTML = `<p>${text}</p>`;
  } else {
    el.innerHTML = `<${heading}>${text}</${heading}>`;
  }
  root.appendChild(el);
  return el;
}

describe("heading outline overlay (#54)", () => {
  it("renders compact H1-H3 heading bars with labels and level-specific classes", () => {
    block(0, "h1", "Plan");
    block(1, "p", "Intro");
    block(2, "h2", "Phase one");
    block(3, "h3", "Details");

    const outline = createHeadingOutline();
    outline.update(root);

    const items = outline.dom.querySelectorAll<HTMLButtonElement>(".cera-heading-outline-entry");
    expect(items.length).toBe(3);
    expect(items[0].classList.contains("cera-heading-outline-entry--h1")).toBe(true);
    expect(items[1].classList.contains("cera-heading-outline-entry--h2")).toBe(true);
    expect(items[2].classList.contains("cera-heading-outline-entry--h3")).toBe(true);
    expect([...outline.dom.querySelectorAll(".cera-heading-outline-label")].map((el) => el.textContent)).toEqual([
      "Plan",
      "Phase one",
      "Details",
    ]);
    expect(outline.dom.classList.contains("cera-heading-outline--empty")).toBe(false);
  });

  it("falls back to H1-H2 when H1-H3 would be too dense", () => {
    block(0, "h1", "Top");
    block(1, "h2", "Section");
    for (let i = 0; i < 8; i++) {
      block(i + 2, "h3", `Detail ${i + 1}`);
    }

    const outline = createHeadingOutline({ maxDetailedHeadings: 5 });
    outline.update(root);

    const labels = [...outline.dom.querySelectorAll(".cera-heading-outline-label")].map((el) => el.textContent);
    expect(labels).toEqual(["Top", "Section"]);
    expect(outline.dom.querySelector(".cera-heading-outline-entry--h3")).toBeNull();
  });

  it("shows a disabled empty indicator when there are no H1-H3 headings", () => {
    block(0, "p", "Only paragraph text");

    const outline = createHeadingOutline();
    outline.update(root);

    expect(outline.dom.classList.contains("cera-heading-outline--empty")).toBe(true);
    expect(outline.dom.getAttribute("aria-disabled")).toBe("true");
    expect(outline.dom.querySelector(".cera-heading-outline-empty")).not.toBeNull();
    expect(outline.dom.querySelector(".cera-heading-outline-entry")).toBeNull();
  });

  it("scrolls the clicked heading block to the top of the viewport", () => {
    const h1 = block(0, "h1", "Top");
    const h2 = block(1, "h2", "Target");
    h1.scrollIntoView = vi.fn();
    h2.scrollIntoView = vi.fn();

    const outline = createHeadingOutline();
    outline.update(root);
    outline.dom.querySelectorAll<HTMLButtonElement>(".cera-heading-outline-entry")[1].click();

    expect(h2.scrollIntoView).toHaveBeenCalledWith({ block: "start", inline: "nearest" });
    expect(h1.scrollIntoView).not.toHaveBeenCalled();
  });

  it("highlights the current heading while scrolling", () => {
    const h1 = block(0, "h1", "Top");
    const h2 = block(1, "h2", "Middle");
    h1.getBoundingClientRect = () => ({ top: -80, bottom: -40, left: 0, right: 0, width: 0, height: 40, x: 0, y: -80, toJSON: () => {} });
    h2.getBoundingClientRect = () => ({ top: 12, bottom: 52, left: 0, right: 0, width: 0, height: 40, x: 0, y: 12, toJSON: () => {} });

    const outline = createHeadingOutline();
    outline.update(root);
    window.dispatchEvent(new Event("scroll"));

    const active = outline.dom.querySelector(".cera-heading-outline-entry--active");
    expect(active?.textContent).toContain("Middle");
  });

  it("disables heading navigation while a block editor is open", () => {
    const h1 = block(0, "h1", "Top");
    h1.scrollIntoView = vi.fn();

    const outline = createHeadingOutline();
    outline.update(root);
    outline.setEditing(true);
    outline.dom.querySelector<HTMLButtonElement>(".cera-heading-outline-entry")!.click();

    expect(outline.dom.classList.contains("cera-heading-outline--disabled")).toBe(true);
    expect(outline.dom.getAttribute("aria-disabled")).toBe("true");
    expect(h1.scrollIntoView).not.toHaveBeenCalled();
  });
});

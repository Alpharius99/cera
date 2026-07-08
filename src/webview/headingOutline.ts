export interface HeadingOutline {
  dom: HTMLElement;
  update(root: HTMLElement): void;
  setEditing(editing: boolean): void;
  refreshActive(): void;
  destroy(): void;
}

export interface HeadingOutlineOptions {
  maxDetailedHeadings?: number;
}

interface HeadingEntry {
  level: 1 | 2 | 3;
  label: string;
  block: HTMLElement;
}

const DEFAULT_MAX_DETAILED_HEADINGS = 24;

function headingLevel(el: Element | null): 1 | 2 | 3 | null {
  const tag = el?.tagName.toLowerCase();
  if (tag === "h1") {
    return 1;
  }
  if (tag === "h2") {
    return 2;
  }
  if (tag === "h3") {
    return 3;
  }
  return null;
}

function collectHeadings(root: HTMLElement): HeadingEntry[] {
  const headings: HeadingEntry[] = [];
  for (const block of root.querySelectorAll<HTMLElement>(".cera-block")) {
    if (block.dataset.blockType !== "heading_open") {
      continue;
    }
    const heading = block.querySelector("h1, h2, h3");
    const level = headingLevel(heading);
    const label = heading?.textContent?.trim() ?? "";
    if (!level || label.length === 0) {
      continue;
    }
    headings.push({ level, label, block });
  }
  return headings;
}

function chooseVisibleHeadings(headings: HeadingEntry[], maxDetailedHeadings: number): HeadingEntry[] {
  if (headings.length <= maxDetailedHeadings) {
    return headings;
  }
  const primary = headings.filter((heading) => heading.level <= 2);
  return primary.length > 0 ? primary : headings;
}

export function createHeadingOutline(options: HeadingOutlineOptions = {}): HeadingOutline {
  const maxDetailedHeadings = options.maxDetailedHeadings ?? DEFAULT_MAX_DETAILED_HEADINGS;
  const dom = document.createElement("nav");
  dom.className = "cera-heading-outline";
  dom.setAttribute("aria-label", "Document headings");

  const list = document.createElement("div");
  list.className = "cera-heading-outline-list";
  dom.appendChild(list);

  let entries: HeadingEntry[] = [];
  let editing = false;

  function setEmpty(): void {
    entries = [];
    list.replaceChildren();
    const empty = document.createElement("div");
    empty.className = "cera-heading-outline-empty";
    empty.setAttribute("aria-hidden", "true");
    list.appendChild(empty);
    dom.classList.add("cera-heading-outline--empty");
    dom.setAttribute("aria-disabled", "true");
  }

  function setActive(activeEntry: HeadingEntry | null): void {
    for (const button of list.querySelectorAll<HTMLButtonElement>(".cera-heading-outline-entry")) {
      const active = activeEntry !== null && button.dataset.blockIndex === activeEntry.block.dataset.blockIndex;
      button.classList.toggle("cera-heading-outline-entry--active", active);
      if (active) {
        button.setAttribute("aria-current", "true");
      } else {
        button.removeAttribute("aria-current");
      }
    }
  }

  function refreshActive(): void {
    if (entries.length === 0) {
      return;
    }
    const visible = entries.filter((entry) => {
      const box = entry.block.getBoundingClientRect();
      return box.bottom > 0 && box.top < window.innerHeight;
    });
    const topOwner = visible.filter((entry) => entry.block.getBoundingClientRect().top <= 0).at(-1);
    if (topOwner) {
      setActive(topOwner);
      return;
    }
    if (visible[0]) {
      setActive(visible[0]);
      return;
    }
    const previous = entries.filter((entry) => entry.block.getBoundingClientRect().top <= 0).at(-1);
    setActive(previous ?? entries[0]);
  }

  function makeEntry(entry: HeadingEntry): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `cera-heading-outline-entry cera-heading-outline-entry--h${entry.level}`;
    button.dataset.blockIndex = entry.block.dataset.blockIndex ?? "";
    button.title = entry.label;
    button.setAttribute("aria-label", entry.label);

    const bar = document.createElement("span");
    bar.className = "cera-heading-outline-bar";
    bar.setAttribute("aria-hidden", "true");
    const label = document.createElement("span");
    label.className = "cera-heading-outline-label";
    label.textContent = entry.label;
    button.append(bar, label);

    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (editing) {
        return;
      }
      entry.block.scrollIntoView({ block: "start", inline: "nearest" });
      setActive(entry);
    });
    return button;
  }

  function update(root: HTMLElement): void {
    entries = chooseVisibleHeadings(collectHeadings(root), maxDetailedHeadings);
    if (entries.length === 0) {
      setEmpty();
      return;
    }
    dom.classList.remove("cera-heading-outline--empty");
    dom.setAttribute("aria-disabled", editing ? "true" : "false");
    list.replaceChildren(...entries.map(makeEntry));
    refreshActive();
  }

  function setEditing(nextEditing: boolean): void {
    editing = nextEditing;
    dom.classList.toggle("cera-heading-outline--disabled", editing);
    dom.setAttribute("aria-disabled", editing || entries.length === 0 ? "true" : "false");
    for (const button of list.querySelectorAll<HTMLButtonElement>(".cera-heading-outline-entry")) {
      button.disabled = editing;
    }
  }

  const onScroll = (): void => refreshActive();
  window.addEventListener("scroll", onScroll, { passive: true });
  setEmpty();

  return {
    dom,
    update,
    setEditing,
    refreshActive,
    destroy() {
      window.removeEventListener("scroll", onScroll);
      dom.remove();
    },
  };
}

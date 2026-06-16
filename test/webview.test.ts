// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mountWebview, WebviewHost } from "../src/webview/app";

// DOM-level coverage of the Phase 1 read-only webview (#26). Block activation,
// navigation, slash menu, selection bubble, and chord overlay are tested with
// their features (Phase 2/3: #12, #14–16, #18–19). Each test mounts and disposes
// so the window message listener never leaks between tests.

let root: HTMLElement;
let posted: Array<{ type: string }>;
let host: WebviewHost;
let dispose: () => void;

beforeEach(() => {
  document.body.innerHTML = '<div id="cera-document"></div>';
  root = document.getElementById("cera-document") as HTMLElement;
  posted = [];
  host = { postMessage: (m) => posted.push(m as { type: string }) };
  dispose = mountWebview(root, host);
});

afterEach(() => {
  dispose();
  document.body.innerHTML = "";
});

function update(text: string, extra: Record<string, unknown> = {}): void {
  window.dispatchEvent(new MessageEvent("message", { data: { type: "update", text, ...extra } }));
}

describe("webview rendering (#26)", () => {
  it("posts a ready message to the host on load", () => {
    expect(posted).toContainEqual({ type: "ready" });
  });

  it("renders the document into block elements with stable index/type/kind", () => {
    update("# One\n\nTwo\n");
    const blocks = root.querySelectorAll(".cera-block");
    expect(blocks.length).toBe(2);
    expect(blocks[0].getAttribute("data-block-index")).toBe("0");
    expect(blocks[0].getAttribute("data-block-type")).toBe("heading_open");
    expect(blocks[0].getAttribute("data-block-kind")).toBe("rendered");
    expect(blocks[0].querySelector("h1")?.textContent).toBe("One");
    expect(blocks[1].getAttribute("data-block-index")).toBe("1");
  });

  it("shows the empty-document placeholder for empty input", () => {
    update("");
    expect(root.querySelector(".cera-empty")).not.toBeNull();
    expect(root.querySelectorAll(".cera-block").length).toBe(0);
  });

  it("re-renders on each update (live update)", () => {
    update("# First\n");
    expect(root.querySelector("h1")?.textContent).toBe("First");
    update("## Second\n");
    expect(root.querySelector("h1")).toBeNull();
    expect(root.querySelector("h2")?.textContent).toBe("Second");
    expect(root.querySelectorAll(".cera-block").length).toBe(1);
  });

  it("renders raw HTML as escaped source, never live markup", () => {
    update("<script>alert(1)</script>\n");
    expect(root.querySelector("script")).toBeNull();
    expect(root.querySelector(".raw-text-block")).not.toBeNull();
    expect(root.textContent).toContain("<script>alert(1)</script>");
  });

  it("applies the remote-image placeholder policy from the update message", () => {
    update("![pic](https://example.com/x.png)\n", {
      remoteMode: "placeholder",
      baseUri: "https://base/",
    });
    expect(root.querySelector("img")).toBeNull();
    expect(root.querySelector("button.cera-remote-image")).not.toBeNull();
  });
});

describe("reveal-on-focus block editing (#8)", () => {
  // Inject a fake editor so the click wiring is tested without running
  // CodeMirror under jsdom.
  const seeded: string[] = [];
  function fakeEditor(doc: string) {
    const dom = document.createElement("div");
    dom.className = "fake-editor";
    dom.textContent = doc;
    return { dom, getText: () => doc, focus: () => {}, destroy: () => dom.remove() };
  }

  function remountWithFakeEditor(): void {
    dispose();
    seeded.length = 0;
    dispose = mountWebview(root, host, {
      createEditor: (doc) => {
        seeded.push(doc);
        return fakeEditor(doc);
      },
    });
  }

  it("opens a source editor seeded with the block's raw text on click", () => {
    remountWithFakeEditor();
    update("# One\n\nTwo\n");
    const block0 = root.querySelector<HTMLElement>('.cera-block[data-block-index="0"]')!;
    block0.click();

    expect(block0.classList.contains("cera-block--editing")).toBe(true);
    expect(block0.querySelector(".fake-editor")).not.toBeNull();
    expect(seeded).toEqual(["# One"]);
  });

  it("opens only one editor at a time", () => {
    remountWithFakeEditor();
    update("# One\n\nTwo\n");
    root.querySelector<HTMLElement>('.cera-block[data-block-index="0"]')!.click();
    root.querySelector<HTMLElement>('.cera-block[data-block-index="1"]')!.click();

    expect(root.querySelectorAll(".fake-editor").length).toBe(1);
    expect(seeded).toEqual(["# One", "Two"]);
  });

  it("ignores clicks inside the already-open editor", () => {
    remountWithFakeEditor();
    update("# One\n");
    const block0 = root.querySelector<HTMLElement>('.cera-block[data-block-index="0"]')!;
    block0.click();
    (block0.querySelector(".fake-editor") as HTMLElement).click();
    expect(seeded).toEqual(["# One"]);
  });

  it("collapses back to the rendered view when clicking outside a block", () => {
    remountWithFakeEditor();
    update("# One\n\nTwo\n");
    const block0 = root.querySelector<HTMLElement>('.cera-block[data-block-index="0"]')!;
    block0.click();
    expect(block0.querySelector(".fake-editor")).not.toBeNull();

    root.click(); // outside any block
    expect(block0.querySelector(".fake-editor")).toBeNull();
    expect(block0.classList.contains("cera-block--editing")).toBe(false);
    expect(block0.querySelector("h1")?.textContent).toBe("One");
  });
});

describe("block commit (#9)", () => {
  // Fake editor whose reported text is controllable, to simulate user edits.
  let edited: string;
  function mountWithEditedText(): void {
    dispose();
    dispose = mountWebview(root, host, {
      createEditor: () => {
        const dom = document.createElement("div");
        dom.className = "fake-editor";
        return { dom, getText: () => edited, focus: () => {}, destroy: () => dom.remove() };
      },
    });
  }

  it("commits edited text with the block's range on Escape", () => {
    mountWithEditedText();
    update("# One\n\nTwo\n");
    const block0 = root.querySelector<HTMLElement>('.cera-block[data-block-index="0"]')!;
    edited = "# One";
    block0.click();
    edited = "# Edited";
    block0
      .querySelector(".fake-editor")!
      .dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

    expect(posted.find((m) => m.type === "commit")).toMatchObject({
      type: "commit",
      startLine: 0,
      endLine: 1,
      text: "# Edited",
    });
  });

  it("commits the open block when another block is clicked", () => {
    mountWithEditedText();
    update("# One\n\nTwo\n");
    edited = "Two";
    root.querySelector<HTMLElement>('.cera-block[data-block-index="1"]')!.click();
    edited = "Two edited";
    root.querySelector<HTMLElement>('.cera-block[data-block-index="0"]')!.click();

    expect(posted.find((m) => m.type === "commit")).toMatchObject({
      startLine: 2,
      endLine: 3,
      text: "Two edited",
    });
  });

  it("does not commit when the text is unchanged", () => {
    mountWithEditedText();
    update("# One\n");
    edited = "# One";
    root.querySelector<HTMLElement>('.cera-block[data-block-index="0"]')!.click();
    root.click();

    expect(posted.some((m) => m.type === "commit")).toBe(false);
  });
});

describe("concurrent-edit safety (#10)", () => {
  let edited: string;
  function mountControllable(): void {
    dispose();
    edited = "";
    dispose = mountWebview(root, host, {
      createEditor: () => {
        const dom = document.createElement("div");
        dom.className = "fake-editor";
        return { dom, getText: () => edited, focus: () => {}, destroy: () => dom.remove() };
      },
    });
  }
  const escape = (el: Element): void => {
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  };

  it("keeps the editor open when an external update arrives while editing", () => {
    mountControllable();
    update("# One\n\nTwo\n", { version: 1 });
    const block0 = root.querySelector<HTMLElement>('.cera-block[data-block-index="0"]')!;
    edited = "# One";
    block0.click();
    expect(block0.querySelector(".fake-editor")).not.toBeNull();

    update("# One\n\nTwo\n\nThree\n", { version: 2 }); // external edit while editing
    expect(block0.querySelector(".fake-editor")).not.toBeNull(); // not destroyed
    expect(root.querySelectorAll(".cera-block").length).toBe(2); // render deferred
  });

  it("tags the commit with baseVersion and originalText", () => {
    mountControllable();
    update("# One\n\nTwo\n", { version: 5 });
    const block0 = root.querySelector<HTMLElement>('.cera-block[data-block-index="0"]')!;
    edited = "# One";
    block0.click();
    edited = "# Changed";
    escape(block0.querySelector(".fake-editor")!);

    expect(posted.find((m) => m.type === "commit")).toMatchObject({
      startLine: 0,
      endLine: 1,
      text: "# Changed",
      baseVersion: 5,
      originalText: "# One",
    });
  });

  it("catches up to deferred external edits after closing an unchanged editor", () => {
    mountControllable();
    update("# One\n", { version: 1 });
    const block0 = root.querySelector<HTMLElement>('.cera-block[data-block-index="0"]')!;
    edited = "# One"; // unchanged
    block0.click();
    update("# One\n\nAdded\n", { version: 2 }); // deferred while editing
    escape(root.querySelector(".fake-editor")!);

    expect(posted.some((m) => m.type === "commit")).toBe(false);
    expect(root.querySelectorAll(".cera-block").length).toBe(2); // re-rendered to latest
  });
});

describe("block-splitting commit behavior (#11)", () => {
  let edited: string;
  function mountControllable(): void {
    dispose();
    edited = "";
    dispose = mountWebview(root, host, {
      createEditor: () => {
        const dom = document.createElement("div");
        dom.className = "fake-editor";
        return { dom, getText: () => edited, focus: () => {}, destroy: () => dom.remove() };
      },
    });
  }
  const escape = (el: Element): void => {
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  };
  const openBlock0 = (): HTMLElement => {
    update("# One\n\nTwo\n", { version: 1 });
    const block0 = root.querySelector<HTMLElement>('.cera-block[data-block-index="0"]')!;
    edited = "# One";
    block0.click();
    return block0;
  };

  it("Escape on a split edit commits but stays in source mode", () => {
    mountControllable();
    const block0 = openBlock0();
    edited = "# One\n\nNew paragraph"; // now two blocks
    escape(block0.querySelector(".fake-editor")!);

    expect(posted.find((m) => m.type === "commit")).toMatchObject({ text: "# One\n\nNew paragraph" });
    expect(block0.querySelector(".fake-editor"), "editor stays open after split").not.toBeNull();
    expect(block0.classList.contains("cera-block--editing")).toBe(true);
  });

  it("Escape on a single-block edit commits and collapses", () => {
    mountControllable();
    const block0 = openBlock0();
    edited = "# Changed"; // still one block
    escape(block0.querySelector(".fake-editor")!);

    expect(posted.find((m) => m.type === "commit")).toMatchObject({ text: "# Changed" });
    expect(block0.querySelector(".fake-editor"), "editor collapses when not split").toBeNull();
  });

  it("the × button is an explicit exit that collapses even when split", () => {
    mountControllable();
    const block0 = openBlock0();
    edited = "# One\n\nNew paragraph"; // split
    (block0.querySelector(".cera-block-close") as HTMLButtonElement).click();

    expect(posted.find((m) => m.type === "commit")).toMatchObject({ text: "# One\n\nNew paragraph" });
    expect(block0.querySelector(".fake-editor"), "explicit exit collapses a split").toBeNull();
  });

  it("a blur in split mode commits but does not open the clicked block", () => {
    mountControllable();
    const block0 = openBlock0();
    edited = "# One\n\nNew paragraph"; // split
    root.querySelector<HTMLElement>('.cera-block[data-block-index="1"]')!.click();

    expect(posted.find((m) => m.type === "commit")).toMatchObject({ text: "# One\n\nNew paragraph" });
    expect(block0.querySelector(".fake-editor"), "split editor stays open on blur").not.toBeNull();
    expect(
      root.querySelector('.cera-block[data-block-index="1"] .fake-editor'),
      "the other block is not opened in split mode",
    ).toBeNull();
  });
});

describe("block navigation (#12)", () => {
  // Editor reports the block's own raw text, so navigation is a clean
  // (no-change) explicit exit.
  function mountWithRawEditor(): void {
    dispose();
    dispose = mountWebview(root, host, {
      createEditor: (doc) => {
        const dom = document.createElement("div");
        dom.className = "fake-editor";
        return { dom, getText: () => doc, focus: () => {}, destroy: () => dom.remove() };
      },
    });
  }
  const press = (el: Element, key: string, opts: KeyboardEventInit = {}): void => {
    el.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, ...opts }));
  };
  const editorAt = (i: number): Element | null =>
    root.querySelector(`.cera-block[data-block-index="${i}"] .fake-editor`);
  const openAt = (i: number): Element => {
    root.querySelector<HTMLElement>(`.cera-block[data-block-index="${i}"]`)!.click();
    return editorAt(i)!;
  };

  beforeEach(() => {
    mountWithRawEditor();
    update("# One\n\nTwo\n\nThree\n", { version: 1 }); // three blocks
  });

  it("Tab commits and moves to the next block", () => {
    const e0 = openAt(0);
    press(e0, "Tab");
    expect(editorAt(0)).toBeNull();
    expect(editorAt(1)).not.toBeNull();
  });

  it("Shift+Tab moves to the previous block", () => {
    const e1 = openAt(1);
    press(e1, "Tab", { shiftKey: true });
    expect(editorAt(1)).toBeNull();
    expect(editorAt(0)).not.toBeNull();
  });

  it("Ctrl/Cmd+ArrowDown and ArrowUp navigate between blocks", () => {
    press(openAt(0), "ArrowDown", { metaKey: true });
    expect(editorAt(1)).not.toBeNull();
    press(editorAt(1)!, "ArrowUp", { ctrlKey: true });
    expect(editorAt(0)).not.toBeNull();
    expect(editorAt(1)).toBeNull();
  });

  it("Tab on the last block commits and exits (no wraparound)", () => {
    press(openAt(2), "Tab");
    expect(root.querySelector(".fake-editor")).toBeNull();
  });

  it("Shift+Tab on the first block commits and exits", () => {
    press(openAt(0), "Tab", { shiftKey: true });
    expect(root.querySelector(".fake-editor")).toBeNull();
  });

  it("a plain arrow key stays within the block", () => {
    const e0 = openAt(0);
    press(e0, "ArrowDown");
    expect(editorAt(0)).not.toBeNull(); // still editing block 0
  });
});

describe("active-block affordances and controls (#13)", () => {
  function mountWithRawEditor(): void {
    dispose();
    dispose = mountWebview(root, host, {
      createEditor: (doc) => {
        const dom = document.createElement("div");
        dom.className = "fake-editor";
        return { dom, getText: () => doc, focus: () => {}, destroy: () => dom.remove() };
      },
    });
  }
  const editorAt = (i: number): Element | null =>
    root.querySelector(`.cera-block[data-block-index="${i}"] .fake-editor`);
  const openAt = (i: number): HTMLElement => {
    root.querySelector<HTMLElement>(`.cera-block[data-block-index="${i}"]`)!.click();
    return root.querySelector<HTMLElement>(`.cera-block[data-block-index="${i}"]`)!;
  };

  beforeEach(() => {
    mountWithRawEditor();
    update("# One\n\nTwo\n\nThree\n", { version: 1 });
  });

  it("flags the active block so the focus-border accent applies", () => {
    const block1 = openAt(1);
    expect(block1.classList.contains("cera-block--editing")).toBe(true);
  });

  it("shows right-aligned prev, next, and close controls, each screen-reader named", () => {
    const block1 = openAt(1);
    const labels = [...block1.querySelectorAll<HTMLButtonElement>(".cera-block-control")].map((b) =>
      b.getAttribute("aria-label"),
    );
    expect(labels).toEqual(["Previous block", "Next block", "Done editing"]);
    expect(block1.querySelector(".cera-block-close")).not.toBeNull();
  });

  it("renders the controls as native VS Code codicons, hidden from a11y tree (#35)", () => {
    const block1 = openAt(1);
    const icons = [...block1.querySelectorAll<HTMLElement>(".cera-block-control .codicon")];
    expect(icons.map((i) => i.className)).toEqual([
      "codicon codicon-arrow-up",
      "codicon codicon-arrow-down",
      "codicon codicon-close",
    ]);
    expect(icons.every((i) => i.getAttribute("aria-hidden") === "true")).toBe(true);
  });

  it("the next control moves to the next block (mirrors Tab)", () => {
    const block1 = openAt(1);
    (block1.querySelectorAll<HTMLButtonElement>(".cera-block-control")[1]).click();
    expect(editorAt(1)).toBeNull();
    expect(editorAt(2)).not.toBeNull();
  });

  it("the prev control moves to the previous block (mirrors Shift+Tab)", () => {
    const block1 = openAt(1);
    (block1.querySelectorAll<HTMLButtonElement>(".cera-block-control")[0]).click();
    expect(editorAt(1)).toBeNull();
    expect(editorAt(0)).not.toBeNull();
  });

  it("the next control on the last block commits and collapses (no wraparound)", () => {
    const block2 = openAt(2);
    (block2.querySelectorAll<HTMLButtonElement>(".cera-block-control")[1]).click();
    expect(root.querySelector(".fake-editor")).toBeNull();
  });
});

describe("undo/redo keystroke forwarding (#9)", () => {
  const press = (key: string, opts: KeyboardEventInit = {}): void => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, ...opts }));
  };

  it("forwards Cmd/Ctrl+Z as an undo request from the rendered view", () => {
    press("z", { metaKey: true });
    expect(posted.some((m) => m.type === "undo")).toBe(true);
  });

  it("forwards Cmd+Shift+Z and Ctrl+Y as redo requests", () => {
    press("z", { metaKey: true, shiftKey: true });
    press("y", { ctrlKey: true });
    expect(posted.filter((m) => m.type === "redo").length).toBe(2);
  });

  it("does not forward undo while a block editor is open (CodeMirror owns it)", () => {
    dispose();
    dispose = mountWebview(root, host, {
      createEditor: () => {
        const dom = document.createElement("div");
        dom.className = "fake-editor";
        return { dom, getText: () => "# One", focus: () => {}, destroy: () => dom.remove() };
      },
    });
    update("# One\n");
    root.querySelector<HTMLElement>('.cera-block[data-block-index="0"]')!.click();
    posted.length = 0;
    press("z", { metaKey: true });
    expect(posted.some((m) => m.type === "undo")).toBe(false);
  });
});

describe("webview isolation (#26)", () => {
  it("stops handling messages after dispose (no global leakage)", () => {
    dispose();
    update("# Should be ignored\n");
    expect(root.querySelectorAll(".cera-block").length).toBe(0);
    // Re-mount so afterEach's dispose() has a live listener to remove.
    dispose = mountWebview(root, host);
  });
});

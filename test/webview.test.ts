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

describe("webview isolation (#26)", () => {
  it("stops handling messages after dispose (no global leakage)", () => {
    dispose();
    update("# Should be ignored\n");
    expect(root.querySelectorAll(".cera-block").length).toBe(0);
    // Re-mount so afterEach's dispose() has a live listener to remove.
    dispose = mountWebview(root, host);
  });
});

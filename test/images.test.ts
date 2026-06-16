// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { applyImagePolicy, resolveRelativeImageSrc, ImagePolicy } from "../src/webview/images";

const BASE = "https://file.vscode-resource/Users/me/notes/";

function container(html: string): HTMLElement {
  const el = document.createElement("div");
  el.innerHTML = html;
  return el;
}

const policy = (over: Partial<ImagePolicy>): ImagePolicy => ({
  remoteMode: "render",
  baseUri: BASE,
  ...over,
});

describe("resolveRelativeImageSrc", () => {
  it("resolves a workspace-relative path against the base URI", () => {
    expect(resolveRelativeImageSrc("images/x.png", BASE)).toBe(`${BASE}images/x.png`);
  });

  it("passes data: and absolute URLs through unchanged", () => {
    expect(resolveRelativeImageSrc("data:image/png;base64,AAA", BASE)).toBe("data:image/png;base64,AAA");
    expect(resolveRelativeImageSrc("https://example.com/x.png", BASE)).toBe("https://example.com/x.png");
  });
});

describe("applyImagePolicy (#7)", () => {
  it("rewrites local images to the webview base URI", () => {
    const el = container('<img src="images/x.png">');
    applyImagePolicy(el, policy({}));
    expect(el.querySelector("img")!.getAttribute("src")).toBe(`${BASE}images/x.png`);
  });

  it("leaves data: images untouched even in placeholder mode", () => {
    const el = container('<img src="data:image/png;base64,AAA">');
    applyImagePolicy(el, policy({ remoteMode: "placeholder" }));
    expect(el.querySelector("img")!.getAttribute("src")).toBe("data:image/png;base64,AAA");
  });

  it("renders https images in render mode", () => {
    const el = container('<img src="https://example.com/x.png">');
    applyImagePolicy(el, policy({ remoteMode: "render" }));
    expect(el.querySelector("img")!.getAttribute("src")).toBe("https://example.com/x.png");
  });

  it("replaces remote images with a click-to-load chip in placeholder mode", () => {
    const el = container('<img src="https://example.com/x.png" alt="Pic">');
    applyImagePolicy(el, policy({ remoteMode: "placeholder" }));
    expect(el.querySelector("img")).toBeNull();
    const chip = el.querySelector("button.cera-remote-image") as HTMLButtonElement;
    expect(chip).not.toBeNull();
    expect(chip.dataset.src).toBe("https://example.com/x.png");

    chip.click();
    const loaded = el.querySelector("img");
    expect(loaded).not.toBeNull();
    expect(loaded!.getAttribute("src")).toBe("https://example.com/x.png");
    expect(loaded!.getAttribute("alt")).toBe("Pic");
  });

  it("treats http images as remote: left for CSP to block, chipped in placeholder mode", () => {
    const rendered = container('<img src="http://example.com/x.png">');
    applyImagePolicy(rendered, policy({ remoteMode: "render" }));
    expect(rendered.querySelector("img")!.getAttribute("src")).toBe("http://example.com/x.png");

    const placeheld = container('<img src="http://example.com/x.png">');
    applyImagePolicy(placeheld, policy({ remoteMode: "placeholder" }));
    expect(placeheld.querySelector("button.cera-remote-image")).not.toBeNull();
  });
});

// Image rendering policy applied in the webview after sanitization (#7).
//
// - Workspace-relative paths are resolved against the document's webview base
//   URI (the host computes it via webview.asWebviewUri).
// - data: images are left as-is (allowed by CSP).
// - Remote (http/https) images are a privacy/tracking vector. In "render" mode
//   https images load (http is blocked by CSP); in "placeholder" mode every
//   remote image is replaced by a click-to-load chip.

export interface ImagePolicy {
  remoteMode: "render" | "placeholder";
  /** Webview URI of the document's directory; relative srcs resolve against it. */
  baseUri: string;
}

function hasScheme(src: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(src);
}

export function isRemoteImage(src: string): boolean {
  return /^https?:/i.test(src);
}

/** Resolve a workspace-relative image src to a webview URI; pass others through. */
export function resolveRelativeImageSrc(src: string, baseUri: string): string {
  if (src === "" || hasScheme(src) || src.startsWith("#") || src.startsWith("//")) {
    return src;
  }
  const base = baseUri.endsWith("/") ? baseUri : `${baseUri}/`;
  try {
    return new URL(src, base).toString();
  } catch {
    return src;
  }
}

export function applyImagePolicy(container: HTMLElement, policy: ImagePolicy): void {
  for (const img of Array.from(container.querySelectorAll("img"))) {
    const src = img.getAttribute("src") ?? "";
    if (isRemoteImage(src)) {
      if (policy.remoteMode === "placeholder") {
        replaceWithChip(img, src);
      }
      // render mode: https loads under CSP; http is blocked by CSP.
    } else if (src.startsWith("data:")) {
      // inline image — allowed, leave as-is.
    } else {
      img.setAttribute("src", resolveRelativeImageSrc(src, policy.baseUri));
    }
  }
}

function replaceWithChip(img: Element, src: string): void {
  const alt = img.getAttribute("alt") ?? "";
  const chip = document.createElement("button");
  chip.type = "button";
  chip.className = "cera-remote-image";
  chip.dataset.src = src;
  chip.textContent = alt ? `Load remote image: ${alt}` : "Load remote image";
  chip.addEventListener("click", () => {
    const real = document.createElement("img");
    real.setAttribute("src", src);
    if (alt) {
      real.setAttribute("alt", alt);
    }
    chip.replaceWith(real);
  });
  img.replaceWith(chip);
}

import DOMPurify from "dompurify";

// Defense in depth. markdown-it runs with `html: false`, but link/image
// attributes are still author-controlled, so rendered block HTML is sanitized
// before it is injected into the webview DOM.
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html);
}

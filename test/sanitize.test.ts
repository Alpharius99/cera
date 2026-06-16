// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { sanitizeHtml } from "../src/webview/sanitize";

describe("sanitizeHtml", () => {
  it("strips scripts and event-handler attributes", () => {
    expect(sanitizeHtml("<img src=x onerror=alert(1)>")).not.toContain("onerror");
    expect(sanitizeHtml("<script>alert(1)</script>")).not.toContain("<script>");
  });

  it("preserves safe rendered markup", () => {
    expect(sanitizeHtml("<h1>Title</h1>")).toBe("<h1>Title</h1>");
    expect(sanitizeHtml("<table><thead><tr><th>A</th></tr></thead></table>")).toContain("<table>");
  });
});

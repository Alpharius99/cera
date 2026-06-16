import { describe, it } from "vitest";

// Webview unit tests run under a DOM environment once block rendering lands;
// these todos scaffold the intended coverage of src/webview/main.ts.
describe("webview", () => {
  it.todo("renders the document text into the cera-document root");
  it.todo("posts a ready message to the host on load");
});

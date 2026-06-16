// Webview entry point. esbuild bundles this into media/cera.bundle.js, which the
// custom editor loads via a nonce under the strict CSP — no CDN, no inline script.
//
// The rendering logic lives in app.ts (mountWebview) so it can be unit-tested
// under jsdom; this entry just wires it to the real VS Code webview API.

import { mountWebview } from "./app";

interface VsCodeApi {
  postMessage(message: unknown): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

mountWebview(document.getElementById("cera-document") as HTMLElement, acquireVsCodeApi());

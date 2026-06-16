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

// The bundle is loaded via <script nonce="..."> under the strict CSP; reuse that
// nonce so CodeMirror can inject its theme styles (#8).
const nonce = (document.currentScript as HTMLScriptElement | null)?.nonce ?? "";

mountWebview(document.getElementById("cera-document") as HTMLElement, acquireVsCodeApi(), { nonce });

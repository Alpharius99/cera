// Webview Content-Security-Policy. Kept in its own module (no vscode imports) so
// the policy can be unit-tested directly.
//
// Image policy (#7): images must be explicitly allowed or they silently fail.
//   - `${cspSource}` — local/workspace images resolved via asWebviewUri
//   - `data:`        — inline images
//   - `https:`       — remote images (subject to the cera.images.remote setting)
// `http:` is intentionally excluded (no mixed/insecure content).
// `style-src` allows the linked stylesheet (cspSource) and the nonced `<style>`
// CodeMirror injects for its themes (#8). `style-src-attr 'unsafe-inline'` is the
// narrow allowance CodeMirror needs for its inline cursor/selection styles — it
// only affects style attributes, leaving `script-src` strictly nonce-only.
export function buildCsp(cspSource: string, nonce: string): string {
  return (
    [
      "default-src 'none'",
      `img-src ${cspSource} data: https:`,
      `style-src ${cspSource} 'nonce-${nonce}'`,
      "style-src-attr 'unsafe-inline'",
      `script-src 'nonce-${nonce}'`,
    ].join("; ") + ";"
  );
}

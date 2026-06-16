// Pure block-splice math, shared as the reference for the host's WorkspaceEdit
// (#9). Replaces the source lines [startLine, endLine) with `newText`, preserving
// everything before and after. `newText` may contain fewer or more lines than the
// original block (a split), which simply inserts the new lines in place.
//
// EOL is preserved (#32): the source's line endings (LF or CRLF) are detected and
// re-applied, and `newText` (which the block model produces as LF) is converted to
// match — so splicing into a CRLF document stays byte-for-byte CRLF.
export function spliceBlock(src: string, startLine: number, endLine: number, newText: string): string {
  const eol = src.includes("\r\n") ? "\r\n" : "\n";
  const lines = src.split(/\r?\n/);
  const before = lines.slice(0, startLine);
  const after = lines.slice(endLine);
  return [...before, ...newText.split(/\r?\n/), ...after].join(eol);
}

export type BlockResolution =
  | { status: "clean"; startLine: number; endLine: number }
  | { status: "conflict" };

/**
 * Re-resolve a block's line range against the current document before commit
 * (#10). Used when the document changed since the editor opened, so the original
 * `[startLine, endLine)` may be stale.
 *
 * - The block's original text still sits at its original lines → commit there.
 * - It moved (an edit above shifted it) but still appears exactly once → rebase
 *   to the new range.
 * - It is gone (edited underneath) or appears multiple times (ambiguous) →
 *   `conflict`: the caller must abort rather than risk overwriting other changes.
 *
 * Comparison is EOL-agnostic; the returned range is in document line numbers.
 */
export function resolveBlockRange(
  src: string,
  originalText: string,
  startLine: number,
  endLine: number,
): BlockResolution {
  const docLines = src.replace(/\r\n/g, "\n").split("\n");
  const origLines = originalText.replace(/\r\n/g, "\n").split("\n");
  const height = origLines.length;

  const matchesAt = (i: number): boolean =>
    i >= 0 && i + height <= docLines.length && origLines.every((line, k) => docLines[i + k] === line);

  // Fast path: still exactly where it was (e.g. the edit was below this block).
  if (matchesAt(startLine) && endLine - startLine === height) {
    return { status: "clean", startLine, endLine: startLine + height };
  }

  const matches: number[] = [];
  for (let i = 0; i + height <= docLines.length; i++) {
    if (matchesAt(i)) {
      matches.push(i);
    }
  }
  if (matches.length === 1) {
    return { status: "clean", startLine: matches[0], endLine: matches[0] + height };
  }
  return { status: "conflict" };
}

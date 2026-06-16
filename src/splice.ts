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

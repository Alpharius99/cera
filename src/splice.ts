// Pure block-splice math, shared as the reference for the host's WorkspaceEdit
// (#9). Replaces the source lines [startLine, endLine) with `newText`, preserving
// everything before and after. `newText` may contain fewer or more lines than the
// original block (a split), which simply inserts the new lines in place.
export function spliceBlock(src: string, startLine: number, endLine: number, newText: string): string {
  const lines = src.split("\n");
  const before = lines.slice(0, startLine);
  const after = lines.slice(endLine);
  return [...before, ...newText.split("\n"), ...after].join("\n");
}

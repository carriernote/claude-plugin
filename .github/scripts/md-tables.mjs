/**
 * Markdown table un-padding — the pure functions, so they can be tested.
 * CLI wrapper: ../unpad-md-tables.mjs
 *
 * Prettier pads every table cell out to the width of the widest cell in its
 * column. In prose-heavy tables one long cell blows every row out to the same
 * width, so the file becomes mostly spaces (`data-model.md` was 61% spaces,
 * ~56 KB of padding in one table) — bytes that get re-read into context on
 * every session that opens the file.
 */

/**
 * CommonMark: a line indented 4+ spaces is an indented code block, not a
 * table — its leading whitespace is content. Reformatting it would turn a
 * code sample into a rendered table.
 */
const INDENTED_CODE = /^(?: {4,}|\t)/;

export const isTableRow = (line) =>
  !INDENTED_CODE.test(line) &&
  /^\s*\|/.test(line) &&
  line.trimEnd().endsWith("|");

export const isSeparatorRow = (line) =>
  !INDENTED_CODE.test(line) &&
  /^\s*\|[\s:|-]+\|\s*$/.test(line) &&
  line.includes("-");

/**
 * Every table in a Markdown document, as its own run of rows — fenced blocks
 * removed first, so a sample table inside a fence is not mistaken for content.
 *
 * A table is a contiguous run of `|`-lines, which is what lets a caller find
 * one without knowing which heading it sits under. The `scripts/` guards that
 * read a document's tables want two different things from them — "every row in
 * the file" (`emailGlossary.test.ts`'s two required inventories) and "the rows
 * of the ONE table that has this column" (its optional third) — and both are
 * this grouping plus a filter. It lives here rather than in either guard for
 * `source-files.mjs`'s reason: the second caller is where a rule either gets
 * shared or gets a second, slightly different copy.
 *
 * @param {string} markdown
 * @returns {string[][]} One array of raw row lines per table, in document order.
 */
export function tableBlocks(markdown) {
  /** @type {string[][]} */
  const blocks = [];
  /** @type {string[]} */
  let current = [];
  for (const line of markdown.replace(/^```[\s\S]*?^```/gm, "").split("\n")) {
    if (isTableRow(line)) current.push(line);
    else if (current.length) {
      blocks.push(current);
      current = [];
    }
  }
  if (current.length) blocks.push(current);
  return blocks;
}

/**
 * A table's data rows: the run with its header and separator dropped.
 *
 * @param {string[]} rows One block from `tableBlocks`.
 * @returns {string[]}
 */
export const dataRows = (rows) =>
  rows.filter((line) => !isSeparatorRow(line)).slice(1);

/**
 * One row's cells, outer pipes dropped and each trimmed.
 *
 * A `\\|` inside a cell is content rather than a column boundary — several
 * subject cells in `docs/email/glossary.md` state alternatives that way — so
 * the split stays honest when it is aimed at one of those.
 *
 * @param {string} row
 * @returns {string[]}
 */
export const cells = (row) =>
  row
    .split(/(?<!\\)\|/)
    .slice(1, -1)
    .map((cell) => cell.trim());

/**
 * Collapse padding around cell delimiters. Never touches inter-word spacing,
 * and never touches the line's own indentation — a table nested in a list item
 * has to keep its indent or it breaks out of the list.
 */
export function unpadRow(line) {
  const indent = line.match(/^[ \t]*/)[0];
  const body = line.trimEnd().slice(indent.length);

  if (isSeparatorRow(line)) {
    // `| -------- | :------ |` -> `| --- | :--- |`
    const cells = body
      .split("|")
      .slice(1, -1)
      .map((cell) => {
        const t = cell.trim();
        if (t === "") return "";
        const left = t.startsWith(":") ? ":" : "";
        const right = t.endsWith(":") ? ":" : "";
        return ` ${left}---${right} `;
      });
    return `${indent}|${cells.join("|")}|`;
  }

  const collapsed = body.replace(/[ \t]+\|/g, " |").replace(/\|[ \t]+/g, "| ");
  return indent + collapsed.replace(/^\|\s+/, "| ").replace(/\s+\|$/, " |");
}

/** Rewrite every table in a Markdown document, leaving fenced blocks alone. */
export function transform(source) {
  let inFence = false;
  return source
    .split("\n")
    .map((line) => {
      if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
      if (inFence) return line;
      if (!isTableRow(line)) return line.replace(/[ \t]+$/, "");
      return unpadRow(line);
    })
    .join("\n");
}

/**
 * Canonical form used to prove a rewrite is information-preserving. Compares
 * content AND per-line indentation (so a de-indent can't slip through), with
 * separator rows reduced to their cell count + alignment markers — the only
 * place we legitimately drop `-` characters.
 */
export function normalise(source) {
  return source
    .split("\n")
    .map((line) => {
      if (line.trim() === "") return "";
      const indent = line.match(/^[ \t]*/)[0].replace(/\t/g, "    ").length;
      if (isSeparatorRow(line)) {
        const cells = line
          .trim()
          .slice(1, -1)
          .split("|")
          .map((c) => {
            const t = c.trim();
            return `${t.startsWith(":") ? ":" : ""}-${t.endsWith(":") ? ":" : ""}`;
          });
        return `${indent}:SEP(${cells.join(",")})`;
      }
      return `${indent}:${line.replace(/\s+/g, " ").trim()}`;
    })
    .join("\n")
    .replace(/\n+/g, "\n")
    .trim();
}

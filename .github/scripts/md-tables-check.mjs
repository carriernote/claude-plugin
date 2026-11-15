// Markdown gate: no padded tables, exactly as `yarn md:check` in
// waste-management-console (scripts/unpad-md-tables.mjs). Prettier pads every
// table cell to its column's widest, so Markdown is in .prettierignore and this
// is the check in its place. `md-tables.mjs` is a verbatim copy of that repo's
// scripts/lib/md-tables.mjs.
//
//   node .github/scripts/md-tables-check.mjs          # check (CI)
//   node .github/scripts/md-tables-check.mjs --write  # strip the padding
//
// Covers the whole repo from wherever it is run: tracked files plus untracked
// ones git does not ignore (so a new file is checked before `git add`), with
// paths taken from the repo root; a file deleted but not yet staged is skipped.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { normalise, transform } from "./md-tables.mjs";

const write = process.argv.includes("--write");
const root = execFileSync("git", ["rev-parse", "--show-toplevel"], {
  encoding: "utf8",
}).trim();
const files = [
  ...new Set(
    execFileSync(
      "git",
      [
        "ls-files",
        "-z",
        "--cached",
        "--others",
        "--exclude-standard",
        "--",
        ":(top,glob)**/*.md",
      ],
      { encoding: "utf8", cwd: root },
    )
      .split("\0")
      .filter(Boolean),
  ),
]
  .filter((file) => existsSync(join(root, file)))
  .sort();
// Repo-relative paths from here on, so CI annotations land on the file.
process.chdir(root);

const changed = [];
for (const file of files) {
  const before = readFileSync(file, "utf8");
  const after = transform(before);
  if (after === before) continue;
  if (normalise(before) !== normalise(after)) {
    console.error(
      `::error file=${file}::refused: unpadding would change content or indentation`,
    );
    process.exitCode = 2;
    continue;
  }
  changed.push(file);
  if (write) writeFileSync(file, after);
}

for (const file of changed) {
  console.log(
    write
      ? `unpadded ${file}`
      : `::error file=${file}::padded Markdown table — run node .github/scripts/md-tables-check.mjs --write`,
  );
}
if (!write && changed.length > 0) process.exitCode = 1;
console.log(
  `${files.length} Markdown file(s) checked, ${changed.length} padded.`,
);

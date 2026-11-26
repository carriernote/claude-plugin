# CLAUDE.md — carriernote/claude-plugin

CarrierNote's Claude plugin marketplace (`carriernote`): the `carriernote` plugin,
which connects Claude to CarrierNote's MCP server (`https://mcp.carriernote.co.uk/mcp`)
and carries the `capture-wtn` skill. This is the production plugin, and the only
plugin in this repository; it becomes public at launch.

## The content is generated — never edit it here

Everything except `.github/`, `.prettierignore`, `CLAUDE.md` and `README.md` is
written by CarrierNote's release tooling (`yarn mcp:plugin` in the private
waste-management-console repository) from the shared MCP prompt source. Change it
there, add a release with a new version (installed plugins only update when the
version changes), then open a sync PR here. The sync writes and overwrites its own
files and removes nothing else.

## Git — hard rules

- **Never push or commit to `main`.** Every change is a branch and a pull request;
  a maintainer (Steve or Oli) merges.
- **Open every PR as a draft**, and ask Steve or Oli before marking it ready. The PR
  title check runs only on ready PRs.
- **Conventional Commits PR titles**: `<type>(optional scope): <subject>`, type one of
  feat, fix, chore, docs, refactor, test, build, ci, perf, revert, style. Merges are
  squash merges whose commit message is the PR title. A release sync is
  `feat(plugin): release <version>` (or `fix(plugin): …` for a fix-only release).
- Branch names: `claude/<slug>` for a session, `release/<version>` for a sync.
- Never force-push, never `git rebase -i`, never `--no-verify`.
- A release PR's body names the waste-management-console commit or PR it was
  generated from, and the new version.

## CI

`.github/workflows/validate.yml` (`CI`) runs on every PR and on `main`:

- **Format and Markdown:** Prettier on everything but Markdown, and
  `.github/scripts/md-tables-check.mjs` on Markdown (no padded tables).
- **Validate marketplace and plugins:** `claude plugin validate --strict` on the
  marketplace and `--strict --profile directory` on the plugin, then
  `.github/scripts/check-manifests.mjs`: exactly one plugin, `carriernote`; names and
  versions agree; its `.mcp.json` is one HTTP server at exactly
  `https://mcp.carriernote.co.uk/mcp`; and no file names any other plugin variant or
  CarrierNote host. Before the first release there is no marketplace, and only the
  last check runs.

`.github/workflows/pr-title.yml` (`PR title`) checks the Conventional Commits title on
ready PRs. Dependabot bumps the Actions monthly (`ci:` titles). Versions (Claude Code,
Prettier, Node) are pinned in the workflows; bump them in a PR.

## Repository settings (maintainer, in GitHub)

Squash merging only, default commit message "Pull request title", "Automatically
delete head branches" and auto-merge on. Once public, `main` has a ruleset: PR
required with one approval from a code owner (`.github/CODEOWNERS`), stale
approvals dismissed, conversations resolved, status checks `Format and Markdown`,
`Validate marketplace and plugins` and `Validate PR title` required and up to
date, linear history, no force-push, no deletion. Repository admins bypass it
for pull requests only: release PRs are opened under the owner's account, which
GitHub won't let approve its own PR, so a maintainer merges them by that bypass,
never by a direct push. Actions run read-only, need approval for outside
contributors, and may not approve PRs; secret scanning, push protection and
private vulnerability reporting are on (`.github/SECURITY.md`). Third-party
actions are pinned to a commit.

## Never

- Never commit a secret, token, client secret or test-account credential.
- Never point the plugin at any server but `https://mcp.carriernote.co.uk/mcp`.
- Never add another plugin, or mention any non-production plugin or environment.

<!-- Ruleset check: this PR is closed, never merged. -->

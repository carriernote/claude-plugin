// Checks this repository holds exactly what customers should install, beyond
// what `claude plugin validate` checks on each file alone:
// - the marketplace lists exactly one plugin, `carriernote`, at ./plugins/carriernote;
// - no other folder sits under plugins/;
// - the marketplace entry's name and version equal its plugin.json's (an
//   installed plugin only updates when its version changes, so a mismatch
//   strands users);
// - the plugin's .mcp.json declares exactly one HTTP server, and its URL is
//   exactly https://mcp.carriernote.co.uk/mcp;
// - no tracked file names any other carriernote.co.uk MCP host.
// Before the first release there is no marketplace; then only the last check runs.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, normalize } from "node:path";

const PLUGIN = "carriernote";
const SERVER_URL = "https://mcp.carriernote.co.uk/mcp";
const errors = [];

const readJson = (path) => {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    errors.push(`${path}: ${error.message}`);
    return null;
  }
};

// Any MCP host on carriernote.co.uk other than the production one.
const OTHER_HOST =
  /\b(?!mcp\.carriernote\.co\.uk\b)[a-z0-9-]*mcp\.carriernote\.co\.uk\b/i;
// This repository is the production plugin only: no other plugin variant or
// non-production CarrierNote host may appear in it.
const NON_PRODUCTION = new RegExp(
  ["carriernote-", "d", "ev|", "\\b", "d", "ev-(mcp|app|api)\\."].join(""),
  "i",
);
const tracked = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean)
  .filter((file) => !file.startsWith(".github/scripts/check-manifests"));
for (const file of tracked) {
  if (!existsSync(file) || statSync(file).isDirectory()) continue;
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    if (OTHER_HOST.test(line)) {
      errors.push(
        `${file}:${i + 1}: names an MCP host other than ${SERVER_URL}`,
      );
    }
    if (NON_PRODUCTION.test(line)) {
      errors.push(`${file}:${i + 1}: names a non-production plugin or host`);
    }
  });
}

const hasMarketplace = existsSync(".claude-plugin/marketplace.json");
if (hasMarketplace) {
  const marketplace = readJson(".claude-plugin/marketplace.json");
  const entries = marketplace?.plugins ?? [];
  if (entries.length !== 1 || entries[0]?.name !== PLUGIN) {
    errors.push(
      `marketplace must list exactly one plugin, "${PLUGIN}"; found ${
        entries.map((e) => e?.name).join(", ") || "none"
      }`,
    );
  }
  const folders = existsSync("plugins")
    ? readdirSync("plugins").filter((name) =>
        statSync(join("plugins", name)).isDirectory(),
      )
    : [];
  for (const folder of folders) {
    if (folder !== PLUGIN) errors.push(`plugins/${folder} should not be here`);
  }

  const entry = entries.find((e) => e?.name === PLUGIN);
  if (entry) {
    const source = normalize(String(entry.source ?? ""));
    if (source.replace(/\/$/, "") !== `plugins/${PLUGIN}`) {
      errors.push(
        `${PLUGIN}: source "${entry.source}" is not ./plugins/${PLUGIN}`,
      );
    } else {
      const manifest = readJson(join(source, ".claude-plugin/plugin.json"));
      if (manifest) {
        if (manifest.name !== entry.name) {
          errors.push(
            `${source}: plugin.json name "${manifest.name}" ≠ marketplace "${entry.name}"`,
          );
        }
        if (manifest.version !== entry.version) {
          errors.push(
            `${source}: plugin.json version ${manifest.version} ≠ marketplace ${entry.version}`,
          );
        }
      }
      const mcp = readJson(join(source, ".mcp.json"));
      const servers = Object.entries(mcp?.mcpServers ?? {});
      if (servers.length !== 1) {
        errors.push(
          `${source}/.mcp.json: expected exactly one server, found ${servers.length}`,
        );
      }
      for (const [name, server] of servers) {
        if (server.type !== "http") {
          errors.push(
            `${source}/.mcp.json: ${name} type is "${server.type}", expected "http"`,
          );
        }
        if (server.url !== SERVER_URL) {
          errors.push(
            `${source}/.mcp.json: ${name} url ${server.url} is not ${SERVER_URL}`,
          );
        }
      }
    }
  }
}

if (errors.length > 0) {
  for (const error of errors) console.error(`::error::${error}`);
  process.exit(1);
}
console.log(
  hasMarketplace
    ? `manifests agree: ${PLUGIN} on ${SERVER_URL}`
    : `no marketplace yet; ${tracked.length} tracked file(s) name no other MCP host`,
);

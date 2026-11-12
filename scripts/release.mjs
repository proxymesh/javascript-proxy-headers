#!/usr/bin/env node
/**
 * Changelog and release check.
 *   node scripts/release.mjs plan|changelog|notes|check
 */
import { execFileSync } from "node:child_process";
import { readFileSync, realpathSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

function parseSemver(value) {
  const match = SEMVER.exec(String(value).trim());
  if (!match) throw new Error(`Version must be X.Y.Z, patch, minor, or major (got ${JSON.stringify(value)}).`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function resolveVersion(current, input) {
  const spec = String(input ?? "").trim();
  const [major, minor, patch] = parseSemver(current);
  if (spec === "major") return `${major + 1}.0.0`;
  if (spec === "minor") return `${major}.${minor + 1}.0`;
  if (spec === "patch") return `${major}.${minor}.${patch + 1}`;
  const [nextMajor, nextMinor, nextPatch] = parseSemver(spec);
  const greater = nextMajor > major
    || (nextMajor === major && nextMinor > minor)
    || (nextMajor === major && nextMinor === minor && nextPatch > patch);
  if (!greater) throw new Error(`New version must be greater than ${current} (got ${spec}).`);
  return spec;
}

function validDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function heading(version) {
  parseSemver(version);
  return new RegExp(`^## ${version.replaceAll(".", "\\.")} - (\\d{4}-\\d{2}-\\d{2})\\s*$`);
}

function unreleasedAt(lines) {
  return lines.findIndex((line) => /^## Unreleased\s*$/.test(line));
}

function nextHeading(lines, start) {
  for (let i = start + 1; i < lines.length; i += 1) {
    if (lines[i].startsWith("## ")) return i;
  }
  return lines.length;
}

export function moveUnreleased(markdown, version, date) {
  if (!validDate(date)) throw new Error(`Invalid release date ${date}.`);
  const lines = markdown.replace(/\r\n/g, "\n").replace(/^\uFEFF/, "").split("\n");
  if (lines.some((line) => heading(version).test(line))) throw new Error(`CHANGELOG.md already has a ${version} section.`);
  const start = unreleasedAt(lines);
  if (start < 0) throw new Error("CHANGELOG.md is missing a ## Unreleased section.");
  const end = nextHeading(lines, start);
  const header = lines.slice(0, start).join("\n").trim();
  const body = lines.slice(start + 1, end).join("\n").trim();
  const rest = lines.slice(end).join("\n").trim();
  const out = [];
  if (header) out.push(header, "");
  out.push("## Unreleased", "", `## ${version} - ${date}`);
  if (body) out.push("", body);
  if (rest) out.push("", rest);
  return `${out.join("\n")}\n`;
}

export function extractSection(markdown, version) {
  const pattern = heading(version);
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const start = lines.findIndex((line) => pattern.test(line));
  if (start < 0) throw new Error(`CHANGELOG.md is missing a dated ${version} section.`);
  const found = lines[start].match(pattern);
  if (!validDate(found[1])) throw new Error(`CHANGELOG date for ${version} is invalid: ${found[1]}.`);
  return `${lines.slice(start, nextHeading(lines, start)).join("\n").trim()}\n`;
}

function manifestVersion() {
  const pkg = JSON.parse(readFileSync("package.json", "utf8")).version;
  const jsr = JSON.parse(readFileSync("jsr.json", "utf8")).version;
  const lock = JSON.parse(readFileSync("package-lock.json", "utf8"));
  const lockPackage = lock.packages[""].version;
  if (pkg !== jsr || pkg !== lock.version || pkg !== lockPackage) {
    throw new Error(`Version mismatch: package.json=${pkg}, jsr.json=${jsr}, package-lock.json=${lock.version}, packages[""]=${lockPackage}`);
  }
  parseSemver(pkg);
  return pkg;
}

function check() {
  const version = manifestVersion();
  const text = readFileSync("CHANGELOG.md", "utf8");
  if (unreleasedAt(text.replace(/\r\n/g, "\n").split("\n")) < 0) {
    throw new Error("CHANGELOG.md is missing a ## Unreleased section.");
  }
  const branch = (process.env.RELEASE_HEAD_REF ?? execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" })).trim();
  if (!branch.startsWith("release/")) {
    console.log(`Version manifests match at ${version}.`);
    return;
  }
  const name = branch.slice("release/".length);
  if (!SEMVER.test(name)) throw new Error(`Release branch must be release/X.Y.Z (got ${branch}).`);
  if (name !== version) throw new Error(`Version ${version} does not match ${name}.`);
  extractSection(text, version);
  console.log(`Release check passed for ${version}.`);
}

function main() {
  const command = process.argv[2];
  if (command === "plan") {
    const input = process.argv[3] ?? process.env.RELEASE_VERSION;
    process.stdout.write(`${resolveVersion(manifestVersion(), input)}\n`);
    return;
  }
  if (command === "changelog") {
    const path = "CHANGELOG.md";
    writeFileSync(path, moveUnreleased(readFileSync(path, "utf8"), manifestVersion(), new Date().toISOString().slice(0, 10)));
    return;
  }
  if (command === "notes") {
    process.stdout.write(extractSection(readFileSync("CHANGELOG.md", "utf8"), manifestVersion()));
    return;
  }
  if (command === "check") {
    check();
    return;
  }
  throw new Error(`Unknown command ${JSON.stringify(command)}.`);
}

const entry = process.argv[1];
if (entry !== undefined && realpathSync(entry) === realpathSync(fileURLToPath(import.meta.url))) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

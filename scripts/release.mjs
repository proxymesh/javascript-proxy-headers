#!/usr/bin/env node
/** Changelog and release check: plan, bump, changelog, notes, check. */
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
  const greater = nextMajor > major || (nextMajor === major && nextMinor > minor) || (nextMajor === major && nextMinor === minor && nextPatch > patch);
  if (!greater) throw new Error(`New version must be greater than ${current} (got ${spec}).`);
  return spec;
}
function heading(version) {
  return new RegExp(`^## ${version.replaceAll(".", "\\.")} - \\d{4}-\\d{2}-\\d{2}\\s*$`);
}
function nextHeading(lines, start) {
  const index = lines.findIndex((line, i) => i > start && line.startsWith("## "));
  return index < 0 ? lines.length : index;
}
export function moveUnreleased(markdown, version, date) {
  const lines = markdown.split("\n");
  if (lines.some((line) => heading(version).test(line))) throw new Error(`CHANGELOG.md already has a ${version} section.`);
  const start = lines.findIndex((line) => /^## Unreleased\s*$/.test(line));
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
  const lines = markdown.split("\n");
  const start = lines.findIndex((line) => heading(version).test(line));
  if (start < 0) throw new Error(`CHANGELOG.md is missing a dated ${version} section.`);
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
function bump() {
  const version = JSON.parse(readFileSync("package.json", "utf8")).version;
  const text = readFileSync("jsr.json", "utf8");
  const next = text.replace(/"version": "[^"]+"/, `"version": "${version}"`);
  if (next === text) throw new Error("jsr.json has no version field.");
  writeFileSync("jsr.json", next);
}
function check() {
  const version = manifestVersion();
  const text = readFileSync("CHANGELOG.md", "utf8");
  if (!text.split("\n").some((line) => /^## Unreleased\s*$/.test(line))) {
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
  if (command === "bump") return bump();
  if (command === "changelog") {
    const path = "CHANGELOG.md";
    const date = new Date().toISOString().slice(0, 10);
    writeFileSync(path, moveUnreleased(readFileSync(path, "utf8"), manifestVersion(), date));
    return;
  }
  if (command === "notes") {
    process.stdout.write(extractSection(readFileSync("CHANGELOG.md", "utf8"), manifestVersion()));
    return;
  }
  if (command === "check") return check();
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

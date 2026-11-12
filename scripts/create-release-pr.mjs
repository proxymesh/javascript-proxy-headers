#!/usr/bin/env node
/**
 * Release helper.
 *   node scripts/create-release-pr.mjs [X.Y.Z|patch|minor|major]
 *   node scripts/create-release-pr.mjs --check
 *   node scripts/create-release-pr.mjs --detect
 *   node scripts/create-release-pr.mjs --publish
 *
 * Omit the version to bump the patch number. The pull request is left for a person to merge.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { appendFileSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

function git(args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

function gh(args) {
  return execFileSync("gh", args, { cwd: root, encoding: "utf8" }).trim();
}

function parseSemver(value) {
  const match = SEMVER.exec(String(value).trim());
  if (!match) throw new Error(`Version must be X.Y.Z (got ${JSON.stringify(value)}).`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

export function resolveVersion(current, input) {
  const raw = (input ?? "").trim();
  const spec = raw === "" ? "patch" : raw;
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
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function headingPattern(version) {
  parseSemver(version);
  return new RegExp(`^## ${version.replaceAll(".", "\\.")} - (\\d{4}-\\d{2}-\\d{2})\\s*$`);
}

function trimBlankLines(lines) {
  let start = 0;
  let end = lines.length;
  while (start < end && lines[start].trim() === "") start += 1;
  while (end > start && lines[end - 1].trim() === "") end -= 1;
  return lines.slice(start, end);
}

export function moveUnreleased(markdown, version, date) {
  if (!validDate(date)) throw new Error(`Invalid release date ${date}.`);
  const pattern = headingPattern(version);
  const lines = markdown.replace(/\r\n/g, "\n").replace(/^\uFEFF/, "").split("\n");
  if (lines.some((line) => pattern.test(line))) {
    throw new Error(`CHANGELOG.md already has a ${version} section.`);
  }
  const start = lines.findIndex((line) => /^## Unreleased\s*$/.test(line));
  if (start < 0) throw new Error("CHANGELOG.md is missing a ## Unreleased section.");
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (lines[i].startsWith("## ")) {
      end = i;
      break;
    }
  }
  const header = trimBlankLines(lines.slice(0, start));
  const body = trimBlankLines(lines.slice(start + 1, end));
  let restStart = end;
  while (restStart < lines.length && lines[restStart].trim() === "") restStart += 1;
  const rest = lines.slice(restStart);
  const out = [];
  if (header.length) out.push(...header, "");
  out.push("## Unreleased", "", `## ${version} - ${date}`);
  if (body.length) out.push("", ...body);
  if (rest.length) out.push("", ...rest);
  return `${out.join("\n").replace(/\n+$/, "")}\n`;
}

export function extractSection(markdown, version) {
  const pattern = headingPattern(version);
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const start = lines.findIndex((line) => pattern.test(line));
  if (start < 0) throw new Error(`CHANGELOG.md is missing a dated ${version} section.`);
  const found = lines[start].match(pattern);
  if (!validDate(found[1])) throw new Error(`CHANGELOG date for ${version} is invalid: ${found[1]}.`);
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (lines[i].startsWith("## ")) {
      end = i;
      break;
    }
  }
  return `${lines.slice(start, end).join("\n").trim()}\n`;
}

export function readVersions(dir) {
  const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  const jsr = JSON.parse(readFileSync(join(dir, "jsr.json"), "utf8"));
  const lock = JSON.parse(readFileSync(join(dir, "package-lock.json"), "utf8"));
  return {
    package: pkg.version,
    jsr: jsr.version,
    lock: lock.version,
    lockPackage: lock.packages[""].version,
    packageName: pkg.name,
    jsrName: jsr.name,
  };
}

export function requireVersion(versions, expected) {
  const pkg = versions.package;
  if (pkg !== versions.jsr || pkg !== versions.lock || pkg !== versions.lockPackage) {
    throw new Error(
      `Version mismatch: package.json=${pkg}, jsr.json=${versions.jsr}, package-lock.json=${versions.lock}, packages[""]=${versions.lockPackage}`,
    );
  }
  parseSemver(pkg);
  if (expected !== undefined && pkg !== expected) {
    throw new Error(`Version ${pkg} does not match ${expected}.`);
  }
}

function replaceVersionFields(path, from, to, count, exact) {
  const needle = `"version": "${from}"`;
  const next = `"version": "${to}"`;
  let text = readFileSync(path, "utf8");
  const total = text.split(needle).length - 1;
  if (exact && total !== count) {
    throw new Error(`${path} has ${total} ${needle} fields, expected ${count}.`);
  }
  if (!exact && total < count) {
    throw new Error(`${path} has ${total} ${needle} fields, expected at least ${count}.`);
  }
  let start = 0;
  for (let i = 0; i < count; i += 1) {
    const index = text.indexOf(needle, start);
    text = `${text.slice(0, index)}${next}${text.slice(index + needle.length)}`;
    start = index + next.length;
  }
  writeFileSync(path, text);
}

// The first two package-lock version fields are this package. Later copies are dependencies.
export function writeVersions(dir, from, to) {
  replaceVersionFields(join(dir, "package.json"), from, to, 1, true);
  replaceVersionFields(join(dir, "jsr.json"), from, to, 1, true);
  replaceVersionFields(join(dir, "package-lock.json"), from, to, 2, false);
  requireVersion(readVersions(dir), to);
}

function changelogText() {
  return readFileSync(join(root, "CHANGELOG.md"), "utf8");
}

function check() {
  const changelog = changelogText();
  if (!changelog.split("\n").some((line) => /^## Unreleased\s*$/.test(line))) {
    throw new Error("CHANGELOG.md is missing a ## Unreleased section.");
  }
  const versions = readVersions(root);
  const branch = (process.env.RELEASE_HEAD_REF || git(["branch", "--show-current"])).trim();
  if (branch.startsWith("release/")) {
    const version = branch.slice("release/".length);
    if (!SEMVER.test(version)) throw new Error(`Release branch must be release/X.Y.Z (got ${branch}).`);
    requireVersion(versions, version);
    extractSection(changelog, version);
    console.log(`Release check passed for ${version}.`);
    return;
  }
  requireVersion(versions);
  console.log(`Version manifests match at ${versions.package}.`);
}

function mergedReleasePull() {
  const sha = process.env.GITHUB_SHA;
  const repository = process.env.GITHUB_REPOSITORY;
  if (!sha || !repository) throw new Error("GITHUB_SHA and GITHUB_REPOSITORY are required.");
  const head = git(["rev-parse", "HEAD"]);
  if (head !== sha) throw new Error(`Checkout is ${head}, expected ${sha}.`);
  const pulls = JSON.parse(gh([
    "api",
    `repos/${repository}/commits/${sha}/pulls`,
    "-H",
    "Accept: application/vnd.github+json",
  ]));
  const releases = pulls.filter((pr) => {
    const ref = pr.head.ref;
    return pr.merged_at
      && pr.base.ref === "main"
      && ref.startsWith("release/")
      && SEMVER.test(ref.slice("release/".length));
  });
  const ours = releases.filter((pr) => pr.head.repo && pr.head.repo.full_name === repository);
  if (releases.length > 0 && ours.length === 0) {
    const other = releases[0].head.repo ? releases[0].head.repo.full_name : "another repository";
    throw new Error(`Release pull requests must come from ${repository} (got ${other}).`);
  }
  if (ours.length > 1) throw new Error(`Commit ${sha} matches multiple release pull requests.`);
  return ours[0] || null;
}

function npmGitHead(name, version) {
  const spec = `${name}@${version}`;
  const result = spawnSync("npm", ["view", spec, "gitHead", "--json"], { cwd: root, encoding: "utf8" });
  const output = `${result.stdout || ""}\n${result.stderr || ""}`;
  if (result.status !== 0) {
    if (output.includes("E404")) return { exists: false, gitHead: null };
    throw new Error(`npm view ${spec} failed: ${output.trim()}`);
  }
  const text = (result.stdout || "").trim();
  if (!text) return { exists: true, gitHead: null };
  const parsed = JSON.parse(text);
  return { exists: true, gitHead: typeof parsed === "string" ? parsed : null };
}

async function jsrHasVersion(name, version) {
  const response = await fetch(`https://jsr.io/${name}/meta.json`);
  if (response.status === 404) return false;
  if (!response.ok) throw new Error(`JSR meta for ${name} returned ${response.status}.`);
  const body = await response.json();
  return Object.hasOwn(body.versions, version);
}

function tagExists(repository, tag) {
  const result = spawnSync("gh", ["api", `repos/${repository}/git/ref/tags/${tag}`], {
    cwd: root,
    encoding: "utf8",
  });
  if (result.status === 0) return true;
  const output = `${result.stdout || ""}\n${result.stderr || ""}`;
  if (output.includes("404")) return false;
  throw new Error(`Could not read tag ${tag}: ${output.trim()}`);
}

function createGitHubRelease(repository, tag, version, sha, notes) {
  const notesPath = join(tmpdir(), `release-notes-${version}.md`);
  writeFileSync(notesPath, notes.endsWith("\n") ? notes : `${notes}\n`);
  if (!tagExists(repository, tag)) {
    execFileSync("gh", [
      "release", "create", tag,
      "--repo", repository,
      "--target", sha,
      "--title", version,
      "--notes-file", notesPath,
    ], { cwd: root, stdio: "inherit" });
    return;
  }
  const existing = spawnSync("gh", ["release", "view", tag, "--repo", repository], {
    cwd: root,
    encoding: "utf8",
  });
  if (existing.status === 0) {
    console.log(`GitHub Release ${tag} already exists.`);
    return;
  }
  const payload = join(tmpdir(), `release-${version}.json`);
  writeFileSync(payload, JSON.stringify({
    tag_name: tag,
    target_commitish: sha,
    name: version,
    body: notes,
  }));
  execFileSync("gh", [
    "api", "--method", "POST", `repos/${repository}/releases`, "--input", payload,
  ], { cwd: root, stdio: "inherit" });
}

function detect() {
  const pr = mergedReleasePull();
  const file = process.env.GITHUB_OUTPUT;
  if (!pr) {
    if (file) appendFileSync(file, "publish=false\n");
    console.log("Not a merged release pull request.");
    return;
  }
  const version = pr.head.ref.slice("release/".length);
  requireVersion(readVersions(root), version);
  extractSection(changelogText(), version);
  if (file) appendFileSync(file, `publish=true\nversion=${version}\n`);
  console.log(`Will publish ${version} from pull request #${pr.number}.`);
}

async function publish() {
  const pr = mergedReleasePull();
  if (!pr) throw new Error("Publish expected a merged release pull request.");
  const version = pr.head.ref.slice("release/".length);
  const versions = readVersions(root);
  requireVersion(versions, version);
  const notes = extractSection(changelogText(), version);
  const sha = process.env.GITHUB_SHA;
  const repository = process.env.GITHUB_REPOSITORY;
  const tag = `v${version}`;
  const npmInfo = npmGitHead(versions.packageName, version);
  const jsrHas = await jsrHasVersion(versions.jsrName, version);
  if (npmInfo.exists && npmInfo.gitHead !== sha) {
    throw new Error(
      `${versions.packageName}@${version} is already on npm (gitHead ${npmInfo.gitHead || "missing"}, this commit ${sha}). Refusing to publish.`,
    );
  }
  if (jsrHas && !(npmInfo.exists && npmInfo.gitHead === sha)) {
    throw new Error(`${versions.jsrName}@${version} is already on JSR. Refusing to publish.`);
  }
  const publishNpm = !npmInfo.exists;
  const publishJsr = !jsrHas;
  if (tagExists(repository, tag) && (publishNpm || publishJsr)) {
    throw new Error(`Tag ${tag} already exists and ${version} is not fully published from ${sha}. Refusing to publish.`);
  }
  if (publishNpm || publishJsr) {
    if (!process.env.ACTIONS_ID_TOKEN_REQUEST_URL || !process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN) {
      throw new Error("GitHub OIDC is unavailable. The publish job needs id-token: write.");
    }
  }
  // A NODE_AUTH_TOKEN or NPM_TOKEN, even an empty one, makes npm skip OIDC.
  const env = { ...process.env };
  delete env.NODE_AUTH_TOKEN;
  delete env.NPM_TOKEN;
  delete env.JSR_TOKEN;
  if (publishNpm) {
    const npmVersion = execFileSync("npm", ["--version"], { cwd: root, encoding: "utf8" }).trim();
    const [major, minor, patch] = npmVersion.split(".").map(Number);
    const npmOk = major > 11 || (major === 11 && (minor > 5 || (minor === 5 && patch >= 1)));
    if (!npmOk) throw new Error(`npm ${npmVersion} is older than 11.5.1, which trusted publishing requires.`);
    console.log(`Publishing ${versions.packageName}@${version} to npm.`);
    execFileSync("npm", ["publish", "--access", "public", "--provenance"], { cwd: root, stdio: "inherit", env });
  } else {
    console.log(`npm already has ${versions.packageName}@${version} from this commit.`);
  }
  if (publishJsr) {
    console.log(`Publishing ${versions.jsrName}@${version} to JSR.`);
    execFileSync("npx", ["--yes", "jsr", "publish"], { cwd: root, stdio: "inherit", env });
  } else {
    console.log(`JSR already has ${versions.jsrName}@${version}.`);
  }
  createGitHubRelease(repository, tag, version, sha, notes);
}

function prepare(input) {
  if (process.env.PREPARE_FROM_CHECKOUT === "1") {
    const currentBranch = git(["branch", "--show-current"]);
    if (currentBranch !== "main") throw new Error(`Expected checkout on main, found ${currentBranch || "detached HEAD"}.`);
    execFileSync("git", ["config", "user.name", "github-actions[bot]"], { cwd: root });
    execFileSync("git", ["config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com"], { cwd: root });
  } else {
    const status = git(["status", "--porcelain"]);
    if (status) throw new Error("Working tree is not clean. Commit or stash changes before running this script.");
    execFileSync("git", ["fetch", "origin", "main"], { cwd: root, stdio: "inherit" });
    execFileSync("git", ["checkout", "main"], { cwd: root, stdio: "inherit" });
    execFileSync("git", ["pull", "--ff-only", "origin", "main"], { cwd: root, stdio: "inherit" });
  }

  const current = readVersions(root);
  requireVersion(current);
  const version = resolveVersion(current.package, input);
  const branch = `release/${version}`;
  const local = spawnSync("git", ["show-ref", "--verify", "--quiet", `refs/heads/${branch}`], { cwd: root });
  if (local.status === 0) throw new Error(`Local branch ${branch} already exists.`);
  if (git(["ls-remote", "--heads", "origin", branch])) {
    throw new Error(`Remote branch origin/${branch} already exists.`);
  }

  let created = false;
  let pushed = false;
  try {
    execFileSync("git", ["checkout", "-b", branch], { cwd: root, stdio: "inherit" });
    created = true;
    writeVersions(root, current.package, version);
    const changelogPath = join(root, "CHANGELOG.md");
    const updated = moveUnreleased(
      readFileSync(changelogPath, "utf8"),
      version,
      new Date().toISOString().slice(0, 10),
    );
    writeFileSync(changelogPath, updated);
    const section = extractSection(updated, version);
    execFileSync("git", ["add", "package.json", "jsr.json", "package-lock.json", "CHANGELOG.md"], { cwd: root });
    execFileSync("git", ["commit", "-m", `chore(release): bump version to ${version}`], {
      cwd: root,
      stdio: "inherit",
    });
    execFileSync("git", ["push", "--set-upstream", "origin", branch], { cwd: root, stdio: "inherit" });
    pushed = true;
    const body = join(tmpdir(), `release-pr-${version}.md`);
    writeFileSync(body, section);
    const url = gh([
      "pr", "create",
      "--base", "main",
      "--head", branch,
      "--title", `Release ${version}`,
      "--body-file", body,
    ]);
    console.log(url);
    console.log("Merge the pull request after Release check passes.");
  } catch (error) {
    if (created && !pushed) {
      spawnSync("git", ["checkout", "-f", "main"], { cwd: root });
      spawnSync("git", ["branch", "-D", branch], { cwd: root });
    }
    if (pushed) console.error(`Pushed ${branch}. The pull request was not created.`);
    throw error;
  }
}

async function main() {
  const command = process.argv[2];
  if (command === "--check") {
    check();
    return;
  }
  if (command === "--detect") {
    detect();
    return;
  }
  if (command === "--publish") {
    await publish();
    return;
  }
  if (command && command.startsWith("--")) throw new Error(`Unknown command ${command}.`);
  prepare(command ?? process.env.RELEASE_VERSION);
}

const invoked = process.argv[1]
  && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (invoked) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    if (process.env.GITHUB_ACTIONS) console.error(`::error::${message}`);
    else console.error(message);
    process.exit(1);
  });
}

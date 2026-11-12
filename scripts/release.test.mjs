import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  extractSection,
  moveUnreleased,
  readVersions,
  requireVersion,
  resolveVersion,
  writeVersions,
} from "./create-release-pr.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("resolveVersion bumps and rejects older versions", () => {
  assert.equal(resolveVersion("1.2.3", ""), "1.2.4");
  assert.equal(resolveVersion("1.2.3", "patch"), "1.2.4");
  assert.equal(resolveVersion("1.2.3", "minor"), "1.3.0");
  assert.equal(resolveVersion("1.2.3", "major"), "2.0.0");
  assert.equal(resolveVersion("1.2.3", "1.2.4"), "1.2.4");
  assert.throws(() => resolveVersion("1.2.3", "1.2.3"), /greater than/);
  assert.throws(() => resolveVersion("1.2.3", "v1.2.4"), /X\.Y\.Z/);
});

test("moveUnreleased keeps older sections and the empty heading", () => {
  const source = [
    "# Changelog",
    "",
    "## Unreleased",
    "",
    "- Ship the release flow.",
    "",
    "## 0.4.0 - 2026-11-02",
    "",
    "- Older.",
    "",
  ].join("\n");
  const moved = moveUnreleased(source, "0.4.1", "2026-11-12");
  assert.equal(moved, [
    "# Changelog",
    "",
    "## Unreleased",
    "",
    "## 0.4.1 - 2026-11-12",
    "",
    "- Ship the release flow.",
    "",
    "## 0.4.0 - 2026-11-02",
    "",
    "- Older.",
    "",
  ].join("\n"));
  assert.equal(extractSection(moved, "0.4.1"), [
    "## 0.4.1 - 2026-11-12",
    "",
    "- Ship the release flow.",
    "",
  ].join("\n"));
  assert.throws(() => moveUnreleased(moved, "0.4.1", "2026-11-12"), /already has/);
  assert.throws(() => moveUnreleased(source, "0.4.1", "2026-02-31"), /Invalid release date/);
});

test("moveUnreleased accepts an empty Unreleased section", () => {
  const source = "# Changelog\r\n\r\n## Unreleased\r\n\r\n## 0.4.0 - 2026-11-02\r\n\r\n- Older.\r\n";
  const moved = moveUnreleased(source, "0.5.0", "2026-12-01");
  assert.equal(moved.includes("\r"), false);
  assert.match(moved, /^# Changelog\n\n## Unreleased\n\n## 0\.5\.0 - 2026-12-01\n\n## 0\.4\.0 - 2026-11-02\n\n- Older\.\n$/);
});

test("writeVersions updates only this package in the lockfile", () => {
  const dir = mkdtempSync(join(tmpdir(), "release-versions-"));
  try {
    for (const name of ["package.json", "jsr.json", "package-lock.json"]) {
      cpSync(join(root, name), join(dir, name));
    }
    const from = readVersions(dir).package;
    const to = resolveVersion(from, "patch");
    const packageBefore = readFileSync(join(dir, "package.json"), "utf8");
    const jsrBefore = readFileSync(join(dir, "jsr.json"), "utf8");
    const lockBefore = readFileSync(join(dir, "package-lock.json"), "utf8");
    const needle = `"version": "${from}"`;
    const beforeCount = lockBefore.split(needle).length - 1;
    writeVersions(dir, from, to);
    assert.equal(
      readFileSync(join(dir, "package.json"), "utf8"),
      packageBefore.replace(needle, `"version": "${to}"`),
    );
    assert.equal(
      readFileSync(join(dir, "jsr.json"), "utf8"),
      jsrBefore.replace(needle, `"version": "${to}"`),
    );
    let expectedLock = lockBefore;
    for (let i = 0; i < 2; i += 1) expectedLock = expectedLock.replace(needle, `"version": "${to}"`);
    const lockAfter = readFileSync(join(dir, "package-lock.json"), "utf8");
    assert.equal(lockAfter, expectedLock);
    assert.equal(lockAfter.split(needle).length - 1, beforeCount - 2);
    requireVersion(readVersions(dir), to);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("check accepts the working tree and rejects a mismatched release branch", () => {
  const version = readVersions(root).package;
  const ok = spawnSync("node", ["scripts/create-release-pr.mjs", "--check"], {
    cwd: root,
    encoding: "utf8",
  });
  assert.equal(ok.status, 0, ok.stderr);
  const release = spawnSync("node", ["scripts/create-release-pr.mjs", "--check"], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, RELEASE_HEAD_REF: `release/${version}` },
  });
  assert.equal(release.status, 0, release.stderr);
  const mismatch = spawnSync("node", ["scripts/create-release-pr.mjs", "--check"], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, RELEASE_HEAD_REF: "release/9.9.9" },
  });
  assert.equal(mismatch.status, 1);
  assert.match(mismatch.stderr, /does not match 9\.9\.9/);
  const named = spawnSync("node", ["scripts/create-release-pr.mjs", "--check"], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, RELEASE_HEAD_REF: "release/not-a-version" },
  });
  assert.equal(named.status, 1);
  assert.match(named.stderr, /release\/X\.Y\.Z/);
});

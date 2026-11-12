import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { extractSection, moveUnreleased, resolveVersion } from "./release.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("resolveVersion bumps and rejects an older version", () => {
  assert.equal(resolveVersion("1.2.3", "patch"), "1.2.4");
  assert.equal(resolveVersion("1.2.3", "minor"), "1.3.0");
  assert.equal(resolveVersion("1.2.3", "major"), "2.0.0");
  assert.equal(resolveVersion("1.2.3", "1.4.0"), "1.4.0");
  assert.throws(() => resolveVersion("1.2.3", "1.2.3"), /greater than/);
  assert.throws(() => resolveVersion("1.2.3", "v1.2.4"), /X\.Y\.Z/);
});

test("moveUnreleased keeps the notes and the empty heading", () => {
  const source = "# Changelog\n\n## Unreleased\n\n- Ship it.\n\n## 0.4.0 - 2026-11-02\n\n- Older.\n";
  const moved = moveUnreleased(source, "0.4.1", "2026-11-12");
  assert.equal(moved, "# Changelog\n\n## Unreleased\n\n## 0.4.1 - 2026-11-12\n\n- Ship it.\n\n## 0.4.0 - 2026-11-02\n\n- Older.\n");
  assert.equal(extractSection(moved, "0.4.1"), "## 0.4.1 - 2026-11-12\n\n- Ship it.\n");
  assert.throws(() => moveUnreleased(moved, "0.4.1", "2026-11-12"), /already has/);
});

test("check accepts this tree and rejects a mismatched release branch", () => {
  const version = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;
  const ok = spawnSync(process.execPath, ["scripts/release.mjs", "check"], { cwd: root, encoding: "utf8" });
  assert.equal(ok.status, 0, ok.stderr);
  const release = spawnSync(process.execPath, ["scripts/release.mjs", "check"], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, RELEASE_HEAD_REF: `release/${version}` },
  });
  assert.equal(release.status, 0, release.stderr);
  const mismatch = spawnSync(process.execPath, ["scripts/release.mjs", "check"], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, RELEASE_HEAD_REF: "release/9.9.9" },
  });
  assert.equal(mismatch.status, 1);
  assert.match(mismatch.stderr, /does not match 9\.9\.9/);
});

---
name: release
description: >-
  Opens a release/X.Y.Z pull request that bumps package.json, jsr.json, and
  package-lock.json and moves the CHANGELOG Unreleased section. Merge is
  manual. After merge, CI publishes to npm and JSR and tags vX.Y.Z. Use when
  the user invokes /release or /release VERSION, asks for a release PR, or
  wants to ship a new semver version.
---

# Release (`/release` [VERSION])

In chat, users may type **`/release`** (patch bump), **`/release minor`**, **`/release major`**, or **`/release 1.2.3`**. See `RELEASING.md` for what CI runs and the owner setup. Do not publish, tag, or merge unless the user asks.

## Goal

Cut a **release PR** from `release/<VERSION>` → `main`. Optional **VERSION** defaults to a **patch** bump of `package.json`.

## Preconditions

- Clean git working tree.
- `git` and `gh` installed and authenticated.
- Default branch is `main`.
- Remote branch `release/<VERSION>` does not already exist.
- `CHANGELOG.md` has a `## Unreleased` section. Put the release notes there first.

## Steps

1. Resolve VERSION: explicit `X.Y.Z`, or `patch` / `minor` / `major`. Omitted means patch.
2. From the repo root:

   ```bash
   npm run release:pr -- [VERSION]
   ```

   Or: `node scripts/create-release-pr.mjs [VERSION]`.

3. The script bumps `package.json`, `jsr.json`, and the root `package-lock.json` versions, moves `## Unreleased` to `## VERSION - YYYY-MM-DD`, pushes `release/VERSION`, and opens a PR titled `Release VERSION`.
4. Tell the user to merge the PR after **Release check** passes.

Actions → **Prepare release** opens the same pull request. Approve workflow runs on that PR if GitHub asks.

## After merge

Merging into `main` runs `.github/workflows/publish.yml`. It publishes to npm and JSR with OIDC, then creates tag `vVERSION` (for example `0.4.1` → `v0.4.1`) and a GitHub Release from the changelog section.

Tags through `v-0.4.0` keep the `v-` prefix. Leave those tags in place.

## Do not

- Commit unrelated files on the release branch.
- Bump one version manifest and leave the others behind. `package.json`, `jsr.json`, and `package-lock.json` must match.
- Enable auto-merge on the release pull request.

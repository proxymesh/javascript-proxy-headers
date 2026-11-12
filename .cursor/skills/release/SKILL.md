---
name: release
description: >-
  Opens a release/X.Y.Z pull request with Prepare release. Merge is manual.
  After merge, CI publishes to npm and JSR and tags vX.Y.Z. Use when the user
  invokes /release or /release VERSION, asks for a release PR, or wants to ship
  a new semver version.
---

# Release (`/release` [VERSION])

In chat, users may type **`/release`** (patch bump), **`/release minor`**, **`/release major`**, or **`/release 1.2.3`**. See `RELEASING.md`. Do not publish, tag, or merge unless the user asks.

## Preconditions

- Notes are under `## Unreleased` in `CHANGELOG.md`.
- `gh` is authenticated.
- The workflow runs from `main`.

## Steps

1. Resolve VERSION: explicit `X.Y.Z`, or `patch` / `minor` / `major`. Omitted means patch.
2. From the repo root:

   ```bash
   gh workflow run "Prepare release" --ref main -f version=VERSION
   ```

3. Tell the user to merge the pull request after they have looked at the diff. Prepare release runs the version, changelog, and `npm pack` checks before it pushes, because a pull request it opens does not start `pull_request` workflows. To run pull request checks on it, close and reopen the pull request.

## After merge

`.github/workflows/publish.yml` publishes to npm and JSR with OIDC, then creates tag `vVERSION` (for example `0.4.1` → `v0.4.1`) and a GitHub Release from the changelog section.

Tags through `v-0.4.0` keep the `v-` prefix. Leave those tags in place.

## Do not

- Enable auto-merge on the release pull request.
- Publish or tag from a workstation.

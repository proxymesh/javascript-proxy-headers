# Releasing

## Cut a release

1. Add notes under `## Unreleased` in `CHANGELOG.md`.
2. Run Actions → **Prepare release** on `main`. Set `version` to `X.Y.Z`, or to `patch`, `minor`, or `major`.

   ```bash
   gh workflow run "Prepare release" --ref main -f version=X.Y.Z
   ```

3. The workflow bumps the version, moves the changelog, runs the release checks, then pushes `release/X.Y.Z` and opens a pull request titled `Release X.Y.Z`. The body is the new changelog section. Merge the pull request yourself.
4. A pull request opened with the Actions token does not start `pull_request` workflows. Prepare release runs the checks before it pushes. To run pull request checks on it, close and reopen the pull request.

## What runs

### Prepare release

Creates `release/X.Y.Z` from `main`. `npm version` sets `package.json` and `package-lock.json`. `scripts/release.mjs bump` sets `jsr.json`, then the script moves `## Unreleased` to `## X.Y.Z - YYYY-MM-DD`. The job then runs the release check and `npm pack` before the push.

### Release check

On pull requests into `main`, the job **Release check** runs the same version and changelog check, `node --test scripts/release.test.mjs`, and `npm pack`. For a `release/X.Y.Z` head, the branch name, `package.json`, `jsr.json`, `package-lock.json`, and a dated changelog section must match. Other pull requests check that those manifests match and that `## Unreleased` exists.

### Publish

On a push to `main`, a short step reads the merged pull request. The `publish` job runs only for a `release/X.Y.Z` pull request from this repository. It uses the `release` environment and publishes with `npm publish --provenance --access public` and `npx --yes jsr@0.14.3 publish` (GitHub OIDC). A version already on npm or JSR fails that command. The `github-release` job then runs `gh release view` or `gh release create` for tag `vX.Y.Z`, with the changelog section as the notes.

## One-time owner setup

Do this before the next release. This change does not create a tag or publish a package.

1. Create a GitHub Environment named `release` (Settings → Environments). Publish runs on a push to `main`, so a deployment-branch rule can limit it to `main`. Required reviewers are optional.
2. npm already uses trusted publishing. Add a publisher for the environment. A saved publisher cannot be edited, so add a second one:
   - Package `javascript-proxy-headers` on npmjs.com → Settings → Trusted Publisher → Add
   - Organization `proxymesh`, repository `javascript-proxy-headers`, workflow filename `publish.yml`
   - Environment name `release`
   - Allow direct `npm publish`. Keep the current publisher until a publish with environment `release` succeeds, then delete the old one.
3. Confirm `@proxymesh/javascript-proxy-headers` on JSR is linked to `proxymesh/javascript-proxy-headers`. That link is JSR trusted publishing. JSR has no environment field and no token in this workflow.
4. Under Settings → Actions → General, allow GitHub Actions to create and approve pull requests. Prepare release needs that to open the pull request.
5. After the publisher with environment `release` has published once, delete repository secrets `NPM_TOKEN`, `NODE_AUTH_TOKEN`, and `JSR_TOKEN` if they are present. The npm publish step unsets `NODE_AUTH_TOKEN` and `NPM_TOKEN` so a leftover token cannot take precedence over OIDC.
6. If branch protection still requires Release on merge, drop it. Don't make Release check a required check: release PRs are opened with GITHUB_TOKEN, so it doesn't run on them unless you close and reopen the PR.

## Tags

New tags are `vX.Y.Z` (for example `v0.4.1`).

Tags through `0.4.0` used a hyphen: `v-0.2.0` through `v-0.4.0`. Those tags stay as they are.

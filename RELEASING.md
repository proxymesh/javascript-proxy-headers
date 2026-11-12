# Releasing

## Cut a release

1. Add notes under `## Unreleased` in `CHANGELOG.md`.
2. Run Actions → **Prepare release**. Set `version` to `X.Y.Z`, or to `patch`, `minor`, or `major`.
3. The workflow pushes `release/X.Y.Z` and opens a pull request titled `Release X.Y.Z`. The body is the new changelog section. Merge it after **Release check** passes.
4. If the pull request shows **Approve workflows to run**, approve it. A pull request opened with the Actions token waits for that approval before checks start.

From a clone:

```bash
npm run release:pr -- X.Y.Z
```

`patch`, `minor`, and `major` work too. Omit the argument for a patch bump. Push the branch to this repository.

## What runs

**Prepare release** creates `release/X.Y.Z` from `main`, sets the version in `package.json`, `jsr.json`, and the root `package-lock.json` fields, and moves `## Unreleased` to `## X.Y.Z - YYYY-MM-DD`.

**Release check** runs on pull requests. On `release/X.Y.Z` the branch name, version manifests, and a dated changelog section must match, and `npm pack` must succeed. Other pull requests check that the manifests match and that `## Unreleased` exists.

**Publish** runs when a push to `main` is the merge of a `release/X.Y.Z` pull request from this repository. It publishes to npm (`npm publish --access public --provenance`, GitHub OIDC) and JSR (`npx jsr publish`, GitHub OIDC), then creates tag `vX.Y.Z` and a GitHub Release whose notes are that changelog section. The job uses the `release` environment. Other pushes to `main` stop at the gate.

Re-run **Publish** on that commit if it fails after the registry has accepted the version. A re-run skips a registry that already has this commit and skips an existing tag. If the version is on npm or JSR from another commit, the job fails and leaves the tag uncreated.

### Tags

New tags are `vX.Y.Z` (for example `v0.4.1`).

Tags through `0.4.0` used a hyphen: `v-0.2.0` through `v-0.4.0`. Those tags stay as they are.

## One-time owner setup

Do this before the next release. This change does not create a tag or publish a package.

1. Create a GitHub Environment named `release` (Settings → Environments). Publish runs on a push to `main`, so a deployment-branch rule can limit it to `main`. Required reviewers are optional.
2. npm already uses trusted publishing. Add a publisher for the environment. A saved publisher cannot be edited, so add a second one:
   - Package `javascript-proxy-headers` on npmjs.com → Settings → Trusted Publisher → Add
   - Organization `proxymesh`, repository `javascript-proxy-headers`, workflow filename `publish.yml`
   - Environment name `release`
   - Allow direct `npm publish`. Publishers created after 3 Sep 2026 default to staged publish, and this workflow runs `npm publish`.
   - The new publisher must complete a publish within 2 days or it expires. Keep the current publisher until that publish succeeds, then delete the old one.
3. Confirm `@proxymesh/javascript-proxy-headers` on JSR is linked to `proxymesh/javascript-proxy-headers`. That link is JSR trusted publishing. JSR has no environment field and no token in this workflow.
4. Under Settings → Actions → General, allow GitHub Actions to create and approve pull requests. Prepare release needs that to open the pull request.
5. After the publisher with environment `release` has published once, delete repository secrets `NPM_TOKEN`, `NODE_AUTH_TOKEN`, and `JSR_TOKEN` if they are present. The publish job unsets them so a leftover token cannot take precedence over OIDC.
6. If branch protection still requires **Release on merge**, drop that check. Require **Release check** so a release pull request with a mismatched version or changelog cannot merge.

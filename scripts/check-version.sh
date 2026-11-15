#!/usr/bin/env bash
# Check that package.json, package-lock.json and jsr.json carry the same
# version, and that a release/X.Y.Z branch carries version X.Y.Z.
# scripts/lint.sh runs this; on pull requests the branch comes from
# GITHUB_HEAD_REF.

set -euo pipefail

err() {
  echo "$*" >&2
}

# Print the "version" field of a JSON file.
version_of() {
  node -p "require('./$1').version"
}

main() {
  cd "$(git rev-parse --show-toplevel)"
  local version file other branch
  version="$(version_of package.json)"
  for file in package-lock.json jsr.json; do
    other="$(version_of "${file}")"
    if [[ "${other}" != "${version}" ]]; then
      err "${file} version ${other} != package.json version ${version}"
      exit 1
    fi
  done
  branch="${GITHUB_HEAD_REF:-$(git rev-parse --abbrev-ref HEAD)}"
  if [[ "${branch}" == release/* && "${branch#release/}" != "${version}" ]]; then
    err "branch ${branch} != package.json version ${version}"
    exit 1
  fi
}

main "$@"

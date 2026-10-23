def main []: nothing -> nothing {
    bun install --frozen-lockfile
    bun run format CHANGELOG.md

    if (git diff --name-only -- CHANGELOG.md | is-not-empty) {
        {
            message: "chore: format release changelog"
            branch: $env.RELEASE_BRANCH
            sha: (git rev-parse HEAD:CHANGELOG.md | str trim)
            content: (open --raw CHANGELOG.md | encode base64)
        }
        | to json --raw
        | gh api --method PUT $"repos/($env.GITHUB_REPOSITORY)/contents/CHANGELOG.md" --input - --silent
    }
}

def main []: nothing -> nothing {
    bun install --frozen-lockfile
    let files = [CHANGELOG.md .github/release/manifest.json package.json]
    bun run format ...$files

    for file in $files {
        if (git diff --name-only -- $file | is-not-empty) {
            {
                message: "chore: format release files"
                branch: $env.RELEASE_BRANCH
                sha: (git rev-parse $"HEAD:($file)" | str trim)
                content: (open --raw $file | encode base64)
            }
            | to json --raw
            | gh api --method PUT $"repos/($env.GITHUB_REPOSITORY)/contents/($file)" --input - --silent
        }
    }
}

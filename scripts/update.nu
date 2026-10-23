def main [
    requested?: string # Instar release version without the v prefix; defaults to the latest stable release.
]: nothing -> nothing {
    let version = if $requested == null {
        http get https://api.github.com/repos/instar-luau/instar/releases/latest
        | get tag_name
        | str replace --regex ^v ''
    } else {
        $requested
    }

    if $version !~ '^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$' {
        error make {
            msg: "Expected a release version without the v prefix."
            labels: [
                {
                    text: "invalid version"
                    span: (metadata $version).span
                }
            ]
        }
    }

    let current = open scripts/server.json

    let checksums = http get --raw $"https://github.com/instar-luau/instar/releases/download/v($version)/sha256.sum"
    | lines
    | parse --regex '^(?<checksum>[0-9a-f]{64}) [ *](?<archive>.+)$'

    let releases = $current.releases | items {|target, release|
        let matches = $checksums | where archive == $release.archive

        if ($matches | length) != 1 {
            error make {
                msg: $"Expected one valid checksum for ($release.archive)."
                labels: [
                    {
                        text: "release version", 
                        span: (metadata $version).span
                    }
                ]
            }
        }

        [$target ($release | update checksum ($matches | first | get checksum))]
    } | into record

    let formatted = $current
    | update version $version
    | update releases $releases
    | to json
    | bun run format --stdin-filepath scripts/server.json
    | into binary

    $formatted | save --raw --force scripts/server.json
}

import { chmod, mkdir, mkdtemp, rename, rm } from "node:fs/promises";
import { join, posix, resolve } from "node:path";

import SevenZip from "7z-wasm";
import type { FileSystem } from "7z-wasm";

import configuration from "./server.json";

const releases: Readonly<Record<string, { archive: string; checksum: string }>> =
    configuration.releases;

async function download(archive: string): Promise<Uint8Array> {
    const response = await fetch(
        `https://github.com/instar-luau/instar/releases/download/v${configuration.version}/${archive}`,
    );

    if (!response.ok) {
        throw new Error(
            `Could not download Instar ${configuration.version}: HTTP ${response.status}.`,
        );
    }

    return response.bytes();
}

function listFiles(
    filesystem: Readonly<Pick<FileSystem, "readdir" | "lstat" | "isDir" | "isFile">>,
): string[] {
    const directories = ["/output"];
    const files: string[] = [];

    for (const directory of directories) {
        for (const name of filesystem.readdir(directory)) {
            if (name === "." || name === "..") {
                continue;
            }

            const path = posix.join(directory, name);
            const { mode } = filesystem.lstat(path);

            if (filesystem.isDir(mode)) {
                directories.push(path);
            } else if (filesystem.isFile(mode)) {
                files.push(path);
            }
        }
    }

    return files;
}

async function extract(
    contents: Readonly<ArrayLike<number>>,
    archiveName: string,
    filename: string,
): Promise<{ executable: Uint8Array; license: Uint8Array }> {
    const archive = await SevenZip();
    const input = `/${archiveName}`;
    archive.FS.writeFile(input, new Uint8Array(contents));
    const sources = [input];

    if (archiveName.endsWith(".tar.xz")) {
        sources.push(`/output/${archiveName.slice(0, -3)}`);
    }

    for (const source of sources) {
        archive.callMain(["x", source, "-o/output", "-y"]);

        if (process.exitCode !== 0) {
            throw new Error(`Could not extract ${source}.`);
        }
    }

    const files = listFiles(archive.FS);
    const executables = files.filter((path) => posix.basename(path) === filename);
    const [file] = executables;

    if (executables.length !== 1 || file === undefined) {
        throw new Error(`Expected one ${filename} in the Instar archive.`);
    }

    const license = posix.join(posix.dirname(file), "LICENSE");

    if (!files.includes(license)) {
        throw new Error("The Instar archive is missing its license.");
    }

    return { executable: archive.FS.readFile(file), license: archive.FS.readFile(license) };
}

export async function bundle(target: string): Promise<void> {
    const release = Object.hasOwn(releases, target) ? releases[target] : undefined;

    if (release === undefined) {
        throw new Error(
            `Unsupported Instar target: ${target}. Choose ${Object.keys(releases).join(", ")}.`,
        );
    }

    const contents = await download(release.archive);
    const checksum = new Bun.CryptoHasher("sha256").update(contents).digest("hex");

    if (checksum !== release.checksum) {
        throw new Error(`Instar archive checksum mismatch for ${target}.`);
    }

    const filename = target === "win32-x64" ? "instar.exe" : "instar";
    const extracted = await extract(contents, release.archive, filename);

    const destination = resolve(import.meta.dir, "../server");
    await mkdir(destination, { recursive: true });
    const temporary = await mkdtemp(join(destination, ".download-"));

    try {
        const executable = join(temporary, filename);
        const license = join(temporary, "LICENSE");
        await Bun.write(executable, extracted.executable);
        await Bun.write(license, extracted.license);

        await chmod(executable, 0o755);
        await rename(license, join(destination, "LICENSE"));
        await rename(executable, join(destination, filename));

        await rm(join(destination, filename === "instar" ? "instar.exe" : "instar"), {
            force: true,
        });
    } finally {
        await rm(temporary, { recursive: true, force: true });
    }
}

if (import.meta.main) {
    await bundle(process.argv[2] ?? `${process.platform}-${process.arch}`);
}

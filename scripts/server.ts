import { chmod, mkdir, mkdtemp, rename, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import { $ } from "bun";

const version = "0.1.3";

const releases: Readonly<Record<string, { archive: string; checksum: string }>> = {
    "win32-x64": {
        archive: "instar-cli-x86_64-pc-windows-msvc.zip",
        checksum: "b073a3a7e8043b4f10a9d227bc9196091152ec5d15364280480638e8fcac3492",
    },

    "linux-x64": {
        archive: "instar-cli-x86_64-unknown-linux-gnu.tar.xz",
        checksum: "eaf3c92b288f7ec43e8c60711dba0f4e664e79ef0c1bda0b0daca4aa619a2bc9",
    },

    "darwin-x64": {
        archive: "instar-cli-x86_64-apple-darwin.tar.xz",
        checksum: "b7f1be594e43c51953f74be610d0dbac9ecb943cecba8af6f62c6ea0f564fa0b",
    },

    "darwin-arm64": {
        archive: "instar-cli-aarch64-apple-darwin.tar.xz",
        checksum: "2529d525da685a61b76da386402f8ee51f5dcb687c68fd331a003e820d6adea5",
    },
};

async function download(archive: string): Promise<Uint8Array> {
    const response = await fetch(
        `https://github.com/instar-luau/instar/releases/download/v${version}/${archive}`,
    );

    if (!response.ok) {
        throw new Error(`Could not download Instar ${version}: HTTP ${response.status}.`);
    }

    return response.bytes();
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

    const destination = resolve(import.meta.dir, "../server");
    await mkdir(destination, { recursive: true });
    const temporary = await mkdtemp(join(destination, ".download-"));

    try {
        const archive = join(temporary, release.archive);
        await Bun.write(archive, contents);
        await $`tar -xf ${archive} -C ${temporary}`;
        const filename = target === "win32-x64" ? "instar.exe" : "instar";
        const files = [...new Bun.Glob(`**/${filename}`).scanSync(temporary)];
        const [file] = files;

        if (files.length !== 1 || file === undefined) {
            throw new Error(`Expected one ${filename} in the Instar archive.`);
        }

        const executable = join(temporary, file);
        const license = join(dirname(executable), "LICENSE");

        if (!(await Bun.file(license).exists())) {
            throw new Error("The Instar archive is missing its license.");
        }

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

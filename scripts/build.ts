import { readdirSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const grammarDirectory = resolve(root, "node_modules/textmate-luau");

const result = await Bun.build({
    entrypoints: [join(root, "src/extension.ts")],
    target: "node",
    format: "cjs",
    external: ["vscode"],
    outdir: join(root, "dist"),
    naming: "extension.cjs",
    sourcemap: "linked",
    metafile: true,
});

if (result.metafile === undefined) {
    throw new Error("The extension build did not produce dependency information.");
}

await Bun.write(join(root, "dist/grammar.json"), Bun.file(join(grammarDirectory, "grammar.json")));

const dependencies = new Set<string>();

for (const filename of Object.keys(result.metafile.inputs)) {
    const directory = /^(?<directory>.*[\\/]node_modules[\\/](?:@[^\\/]+[\\/])?[^\\/]+)[\\/]/u.exec(
        resolve(filename),
    )?.groups?.["directory"];

    if (directory !== undefined) {
        dependencies.add(directory);
    }
}

const notices: string[] = [
    `textmate-luau\n\n${readFileSync(join(grammarDirectory, "LICENSE"), "utf8")}`,
];

for (const directory of [...dependencies].toSorted()) {
    const files = readdirSync(directory);
    const licenses = files.filter((file) => /^licen[cs]e(?:\.(?:txt|md))?$/iu.test(file));

    if (licenses.length === 0) {
        throw new Error(`Missing license for bundled dependency ${basename(directory)}.`);
    }

    for (const license of licenses) {
        notices.push(`${basename(directory)}\n\n${readFileSync(join(directory, license), "utf8")}`);
    }
}

await Bun.write(join(root, "dist/LICENSE"), notices.join("\n\n"));

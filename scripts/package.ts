import { $ } from "bun";

import { bundle } from "./server.ts";

const target = process.argv[2] ?? `${process.platform}-${process.arch}`;

if (process.platform === "win32" && !target.startsWith("win32-")) {
    throw new Error("Package Unix targets on Linux or macOS to preserve executable permissions.");
}

await $`bun run check`;
await $`bun test`;
await $`bun run build`;
await bundle(target);
await $`bun run vsce package --target ${target} --no-dependencies --out dist/instar.vsix`;

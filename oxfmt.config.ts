import { defineConfig } from "oxfmt";

export default defineConfig({
    overrides: [
        {
            files: ["**/*.{js,jsx,mjs,cjs,ts,tsx,mts,cts}"],
            options: { tabWidth: 4 },
        },
    ],

    sortImports: { partitionByNewline: true, newlinesBetween: false },
});

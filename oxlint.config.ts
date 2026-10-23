import { defineConfig } from "oxlint";

export default defineConfig({
    categories: {
        correctness: "error",
        suspicious: "error",
        pedantic: "error",
        perf: "error",
    },

    options: {
        denyWarnings: true,
        reportUnusedDisableDirectives: "error",
        typeAware: true,
    },

    rules: {
        "eslint/curly": "error",
        "eslint/no-console": "error",
        "eslint/prefer-const": "error",
        "typescript/consistent-type-assertions": ["error", { assertionStyle: "never" }],
        "typescript/consistent-type-imports": "error",
        "typescript/no-explicit-any": "error",
        "typescript/no-non-null-assertion": "error",
    },
});

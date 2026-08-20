import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ["dist/**", "node_modules/**", "**/dist/**"],
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // Apps import sdk/src as TypeScript, so it has to survive Node's
    // strip-only type removal: no parameter properties, enums, or namespaces.
    files: ["sdk/src/**/*.ts"],
    rules: {
      "@typescript-eslint/parameter-properties": ["error", { prefer: "class-property" }],
      "@typescript-eslint/no-namespace": "error",
      "no-restricted-syntax": [
        "error",
        { selector: "TSEnumDeclaration", message: "Enums do not survive type stripping. Use a const object." },
      ],
    },
  },
);

// Size limits and crash shortcuts from docs/conventions.md; the structure check covers the rest.
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/", "src-tauri/", "node_modules/", "public/"] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
    linterOptions: { reportUnusedDisableDirectives: "error" },
    rules: {
      "max-lines": ["error", { max: 500, skipBlankLines: false, skipComments: false }],
      "max-lines-per-function": ["error", { max: 60, skipBlankLines: false, skipComments: false }],
      "max-params": ["error", 5],
      "max-depth": ["error", 4],
      "no-console": ["error", { allow: ["warn", "error"] }],
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/only-throw-error": "error",
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
    },
  },
  {
    files: ["tools/**"],
    rules: { "no-console": "off" },
  },
  // node:test registers tests synchronously; the returned promise is the runner's, not ours to await.
  { files: ["tests/**"], rules: { "@typescript-eslint/no-floating-promises": "off" } },
  { files: ["eslint.config.js"], ...tseslint.configs.disableTypeChecked },
);

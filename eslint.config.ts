import eslint from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

export default [
  eslint.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        fetch: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "no-console": "off",
      quotes: ["error", "double", { avoidEscape: true }],

      "no-ternary": "off",
      "no-nested-ternary": "error",
      "no-unneeded-ternary": "error",
      "multiline-ternary": "off",
      "operator-assignment": ["error", "always"],

      curly: ["error", "all"],
      "brace-style": ["error", "1tbs", { allowSingleLine: false }],
    },
  },
  {
    ignores: ["dist/", "node_modules/", "coverage/"],
  },
];

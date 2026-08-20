/* eslint-env node */
module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    ecmaFeatures: { jsx: true },
  },
  plugins: ["@typescript-eslint", "react-hooks", "react-refresh"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react-hooks/recommended",
  ],
  settings: { react: { version: "detect" } },
  ignorePatterns: [
    "dist",
    "node_modules",
    "mobile",
    "public",
    "supabase",
    "coverage",
    "*.config.js",
    "*.config.cjs",
    ".eslintrc.cjs",
  ],
  rules: {
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn",
    "react-refresh/only-export-components": [
      "warn",
      { allowConstantExport: true },
    ],
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-unused-vars": [
      "warn",
      {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        ignoreRestSiblings: true,
      },
    ],
    "@typescript-eslint/ban-ts-comment": "warn",
    "@typescript-eslint/no-non-null-assertion": "off",
    "@typescript-eslint/no-empty-function": "warn",
    "no-console": ["warn", { allow: ["warn", "error"] }],
    "no-empty": ["warn", { allowEmptyCatch: true }],
    "prefer-const": "warn",
    "no-case-declarations": "warn",
    "no-useless-escape": "warn",
    "no-prototype-builtins": "warn",
    // Legacy-code rules kept at warn level so lint stays green; tighten later.
    "@typescript-eslint/ban-types": "warn",
    "no-async-promise-executor": "warn",
    "no-useless-catch": "warn",
    "prefer-spread": "warn",
  },
  overrides: [
    {
      files: ["server/**/*.ts", "scripts/**/*.{js,ts}", "vite.config*.ts"],
      rules: { "no-console": "off" },
    },
  ],
};

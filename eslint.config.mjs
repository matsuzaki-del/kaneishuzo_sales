import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

/** @type {import('eslint').Linter.Config[]} */
const eslintConfig = [
  {
    ignores: [".next/*", "out/*", "build/*", "next-env.d.ts"],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript").map((config) => {
    // ESLint 9 Flat Config では、特定のプロパティ以外のトップレベルキーは制限されます。
    // eslint-config-next が付与してしまう 'name' を確実に取り除きます。
    const { name, ...rest } = config;
    return rest;
  }),
];

export default eslintConfig;

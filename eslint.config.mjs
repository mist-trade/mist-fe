import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "test-data/results/**",
  ]),
  // 设计系统契约：dashboard 与 charts 目录内禁止裸 hex 颜色字面量，
  // 必须经 Token（CSS 变量 var(--sem-*) 或 tokens.ts）。
  // 见 docs/design-system.md §8 红线#5。
  // 既有 globals.css/global-error.tsx 等不在本规则范围（见 themes.css 为 SSOT）。
  {
    files: ["app/dashboard/**/*.ts", "app/dashboard/**/*.tsx", "app/components/charts/**/*.ts", "app/components/charts/**/*.tsx"],
    rules: {
      "no-restricted-syntax": [
        "warn",
        {
          selector: "Literal[value=/^#[0-9a-fA-F]{3,8}$/]",
          message: "禁止裸 hex 颜色：改用设计 Token（CSS 变量 var(--sem-*) 或 app/styles/tokens.ts）。见 docs/design-system.md。",
        },
      ],
    },
  },
]);

export default eslintConfig;

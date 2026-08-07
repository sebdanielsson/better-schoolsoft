import { defineConfig } from "oxfmt";

export default defineConfig({
  useTabs: false,
  tabWidth: 2,
  singleQuote: false,
  trailingComma: "all",
  semi: true,
  printWidth: 100,
  sortPackageJson: true,
  /* `stylesheet` points at the Tailwind v4 entry so class sorting sees the
   * project's own theme and utilities, not just the stock ones. */
  sortTailwindcss: { stylesheet: "src/index.css", functions: ["cn", "cva"] },
  /* .agents/ and .claude/ hold vendored agent skills installed by the skills
   * CLI. They are upstream content pinned by computedHash in skills-lock.json:
   * reformatting them desyncs the lockfile and is reverted on the next skill
   * update. */
  ignorePatterns: [".agents/**", ".claude/**", "dist/**", "pnpm-lock.yaml"],
});

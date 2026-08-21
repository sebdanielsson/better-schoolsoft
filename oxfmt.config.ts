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
  /* All three are other people's code. .agents/ and .claude/ hold vendored agent skills
   * pinned by computedHash in skills-lock.json, so reformatting them desyncs the lockfile
   * and is reverted on the next skill update; src/components/ui/ is vendored shadcn, kept
   * untouched so re-running `shadcn add` diffs cleanly against upstream. */
  ignorePatterns: [".agents/**", ".claude/**", "src/components/ui/**"],
});

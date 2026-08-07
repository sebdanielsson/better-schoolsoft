import { defineConfig } from "oxlint";

export default defineConfig({
  plugins: ["react", "react-perf", "typescript", "unicorn", "oxc", "import", "promise"],
  /* Type-aware rules run through oxlint-tsgolint (a devDependency). Plain type
   * checking stays with `tsc --noEmit` in the `typecheck` script. */
  options: { typeAware: true },
  ignorePatterns: [".agents/**", ".claude/**", "dist/**"],
});

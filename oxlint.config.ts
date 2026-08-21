import { defineConfig } from "oxlint";

export default defineConfig({
  plugins: ["react", "react-perf", "typescript", "unicorn", "oxc", "import", "promise"],
  /* Vendored shadcn components stay untouched so re-running `shadcn add` diffs cleanly
   * against upstream. They are not ours to lint or reformat. */
  ignorePatterns: ["src/components/ui/**"],
  /* Type-aware rules run through oxlint-tsgolint (a devDependency). Plain type
   * checking stays with `tsc --noEmit` in the `typecheck` script. */
  options: { typeAware: true, typeCheck: true },
  rules: {
    /* The only rule turned off, and it fires 19 times on one shape: setLoading(true) /
     * setError(null) at the top of a data-fetching effect, across 12 pages. That is the
     * "synchronizing with an external system" case the rule's own help text says effects
     * are for. Satisfying it means either moving the calls into the async function — which
     * changes nothing except what the linter can see — or restructuring data loading behind
     * a shared hook, which is a refactor these pages have no test coverage for. */
    "react/set-state-in-effect": "off",
  },
});

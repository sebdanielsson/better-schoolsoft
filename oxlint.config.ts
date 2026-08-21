import { defineConfig } from "oxlint";

export default defineConfig({
  plugins: ["react", "react-perf", "typescript", "unicorn", "oxc", "import", "promise"],
  /* Type-aware rules run through oxlint-tsgolint (a devDependency). Plain type
   * checking stays with `tsc --noEmit` in the `typecheck` script. */
  options: { typeAware: true, typeCheck: true },
  rules: {
    /* Added in oxlint 1.79. It fires on the standard data-fetching effect —
     * setLoading(true)/setError(null) before an async load — which is exactly the
     * "synchronizing with an external system" case the rule text says effects are for.
     * Seven pages here do that; contorting them to satisfy the rule would be worse code. */
    "react/set-state-in-effect": "off",
  },
  ignorePatterns: [".agents/**", ".claude/**", "dist/**"],
});

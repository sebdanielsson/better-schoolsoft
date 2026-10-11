/** Whether the `?mock=1` preview mode is compiled into this build: always in
 *  dev, and in production only with `VITE_ENABLE_MOCKS=1` at build time. Both
 *  operands are static, so a normal production build folds this to `false`
 *  and drops everything behind it. */
export const MOCKS_ENABLED = import.meta.env.DEV || import.meta.env.VITE_ENABLE_MOCKS === "1";

/** localStorage key that keeps mock mode on across reloads. */
export const MOCK_FLAG = "bss_dev_mock";

/** True while mock mode is switched on (see `src/dev-mocks/`). */
export function mockModeOn(): boolean {
  return MOCKS_ENABLED && localStorage.getItem(MOCK_FLAG) === "1";
}

/** Registry of module-level caches that hold session-scoped data.
 *
 *  Several caches (staff details, avatar blob URLs) live at module scope so they
 *  survive route changes for the lifetime of the tab. That is deliberate — but
 *  it means they also survive *logout*, and their keys (a bare `teacherId`, a
 *  picture filename) are not qualified by school or org. On a shared device,
 *  signing out and signing in as a different parent would otherwise surface the
 *  previous account's cached staff details and avatars.
 *
 *  Rather than thread a tenant key through every cache read, the caches register
 *  a reset function here and `AuthProvider` calls `clearSessionCaches()` when the
 *  session identity changes or is torn down.
 *
 *  This module deliberately imports nothing: the caches depend on `useAuth`
 *  indirectly, so a direct `useAuth` -> cache import would be circular. */

type Resetter = () => void;

const resetters = new Set<Resetter>();

/** Register a reset function, called on logout and on session identity change.
 *  Callers invoke this at module scope; a cache whose module was never imported
 *  has nothing to clear, which is correct by construction. */
export function registerSessionCache(reset: Resetter): void {
  resetters.add(reset);
}

/** Drop every registered session-scoped cache. */
export function clearSessionCaches(): void {
  for (const reset of resetters) reset();
}

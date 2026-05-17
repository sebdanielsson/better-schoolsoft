/** Tiny priority-aware fetch queue. We use it to make sure cheap "data" fetches
 *  (staff details, ~500 bytes each) drain through the per-origin connection pool
 *  before "heavy" resource fetches (avatar images, several KB each).
 *
 *  Browsers cap HTTP/1.1 at ~6 concurrent connections per origin, so without
 *  ordering, kicking off the staff page would race the avatar stampede against
 *  the detail preload and either delay popovers becoming clickable-instant or
 *  starve the avatars. Routing both through this scheduler with explicit
 *  priorities makes the order predictable. */

type Priority = "high" | "low";

const MAX_CONCURRENT = 6;
const queues: Record<Priority, Array<() => void>> = { high: [], low: [] };
let active = 0;

function drain(): void {
  while (active < MAX_CONCURRENT) {
    const job = queues.high.shift() ?? queues.low.shift();
    if (!job) return;
    active++;
    job();
  }
}

/** Run `task` when a slot opens, respecting priority. High drains before low. */
export function schedule<T>(priority: Priority, task: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    queues[priority].push(() => {
      task()
        .then(resolve, reject)
        .finally(() => {
          active--;
          drain();
        });
    });
    drain();
  });
}

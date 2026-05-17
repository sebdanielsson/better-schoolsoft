import { useEffect, useRef, useState, type ReactNode } from "react";

/** Animate a container to match the natural height of its children whenever
 *  that height changes. Uses ResizeObserver on the inner wrapper so it adapts
 *  to any cause of height change (data swap, conditional rendering, font load,
 *  etc.) without callers having to declare what changed.
 *
 *  Initial render uses `height: auto` so there's no jank on mount; once the
 *  observer fires we switch to a pixel height and animate from there.
 */
export default function AnimateHeight({
  children,
  className,
  duration = 220,
}: {
  children: ReactNode;
  className?: string;
  duration?: number;
}) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const update = () => setHeight(el.scrollHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      className={className}
      style={{
        height: height === null ? "auto" : `${height}px`,
        overflow: "hidden",
        transition: `height ${duration}ms ease-out`,
      }}
    >
      <div ref={innerRef}>{children}</div>
    </div>
  );
}

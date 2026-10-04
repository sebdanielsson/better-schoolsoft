import { ChevronDown } from "lucide-react";
import { useHeroData } from "../hooks/useHeroData.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu.tsx";

/** Name + class of the child in focus. For guardians with several children it
 *  doubles as the switcher; everything below keys its data by child, so the
 *  switch re-fetches rather than showing a sibling's cached data. */
export default function ChildSwitcher() {
  const { child, children, selectChild } = useHeroData();
  if (!child) return null;
  const label = (
    <>
      {child.firstName}
      {child.schools[0]?.className ? ` · ${child.schools[0].className}` : ""}
    </>
  );
  if (children.length < 2) return label;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex cursor-pointer items-center gap-1 rounded-lg border-0 bg-transparent p-0 font-[inherit] text-inherit hover:opacity-90"
        aria-label={`Showing ${child.firstName}. Switch child`}
      >
        {label}
        <ChevronDown className="h-4 w-4 opacity-80 sm:h-5 sm:w-5" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[200px] rounded-lg">
        {children.map((c) => (
          <DropdownMenuItem
            key={c.studentId}
            className="cursor-pointer"
            onClick={() => selectChild(c.studentId)}
          >
            <span className={c.studentId === child.studentId ? "font-semibold" : undefined}>
              {c.firstName} {c.lastName}
            </span>
            {c.schools[0]?.className && (
              <span className="ml-auto text-xs text-muted-foreground">
                {c.schools[0].className}
              </span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu.tsx";

export default function SettingsPill() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={
          "flex items-center justify-center gap-1 rounded-full border-0 cursor-pointer font-[inherit] font-medium text-white transition-colors backdrop-blur-[4px] " +
          "pl-[0.4rem] pr-[0.55rem] py-[0.15rem] text-[11px] basis-[calc(50%-0.2rem)] grow-0 shrink-0 sm:gap-[0.4rem] sm:pl-[0.6rem] sm:pr-[0.7rem] sm:py-1 sm:text-xs sm:basis-auto " +
          "bg-white/15 hover:bg-white/30 data-[state=open]:bg-white/30"
        }
      >
        <span
          aria-hidden="true"
          className="inline-flex items-center justify-center leading-none w-[1.2rem] h-[1.2rem] text-[1.05rem] sm:w-[1.4rem] sm:h-[1.4rem] sm:text-[1.25rem]"
        >
          ⚙
        </span>
        <span className="inline-flex items-center justify-center leading-none h-[1.2rem] sm:h-[1.4rem]">
          Settings
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[200px] rounded-lg">
        <DropdownMenuItem asChild>
          <Link to="/staff" className="cursor-pointer">
            <span aria-hidden="true" className="text-muted-foreground">
              ✱
            </span>
            Staff directory
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/profile" className="cursor-pointer">
            <span aria-hidden="true" className="text-muted-foreground">
              ⚙
            </span>
            Profile settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          className="cursor-pointer"
          onSelect={() => {
            logout();
            void navigate("/login");
          }}
        >
          <span aria-hidden="true">↩</span>
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

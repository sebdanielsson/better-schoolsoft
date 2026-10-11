import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.tsx";
import { useInstall } from "../lib/install.ts";
import { btnPrimaryClass } from "./ConfirmDialog.tsx";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu.tsx";

export default function SettingsPill() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const install = useInstall();
  const [iosHelp, setIosHelp] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={
            "flex cursor-pointer items-center justify-center gap-1 rounded-full border-0 font-[inherit] font-medium text-white backdrop-blur-[4px] transition-colors " +
            "shrink-0 grow-0 basis-[calc(50%-0.2rem)] py-[0.15rem] pr-[0.55rem] pl-[0.4rem] text-[11px] sm:basis-auto sm:gap-[0.4rem] sm:py-1 sm:pr-[0.7rem] sm:pl-[0.6rem] sm:text-xs " +
            "bg-white/15 hover:bg-white/30 data-popup-open:bg-white/30"
          }
        >
          <span
            aria-hidden="true"
            className="inline-flex h-[1.2rem] w-[1.2rem] items-center justify-center text-[1.05rem] leading-none sm:h-[1.4rem] sm:w-[1.4rem] sm:text-[1.25rem]"
          >
            ⚙
          </span>
          <span className="inline-flex h-[1.2rem] items-center justify-center leading-none sm:h-[1.4rem]">
            Settings
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[200px] rounded-lg">
          <DropdownMenuItem render={<Link to="/staff" className="cursor-pointer" />}>
            <span aria-hidden="true" className="text-muted-foreground">
              ✱
            </span>
            Staff directory
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link to="/profile" className="cursor-pointer" />}>
            <span aria-hidden="true" className="text-muted-foreground">
              ⚙
            </span>
            Profile settings
          </DropdownMenuItem>
          {install.kind && (
            <DropdownMenuItem
              className="cursor-pointer"
              onClick={() => {
                if (install.kind === "prompt") void install.prompt();
                else setIosHelp(true);
              }}
            >
              <span aria-hidden="true" className="text-muted-foreground">
                ⤓
              </span>
              Install app
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            variant="destructive"
            className="cursor-pointer"
            onClick={() => {
              logout();
              void navigate("/login");
            }}
          >
            <span aria-hidden="true">↩</span>
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={iosHelp} onOpenChange={setIosHelp}>
        <DialogContent
          showCloseButton={false}
          className="gap-0 rounded-2xl bg-white p-6 text-slate-900 sm:max-w-md"
        >
          <DialogTitle className="font-sans text-lg font-bold tracking-[-0.01em] normal-case">
            Add to your Home Screen
          </DialogTitle>
          <DialogDescription className="mt-2 text-sm text-slate-600">
            Tap the Share button, then <strong>Add to Home Screen</strong>. The app then opens full
            screen from its own icon. Inside another app (a link from mail or social media), open
            the page in Safari first.
          </DialogDescription>
          <div className="mt-6 flex justify-end">
            <button type="button" className={btnPrimaryClass} onClick={() => setIosHelp(false)}>
              Got it
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

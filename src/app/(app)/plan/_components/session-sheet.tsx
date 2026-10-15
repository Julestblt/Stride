"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  SquareArrowOutUpRightIcon,
  XIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent } from "@/components/ui/sheet";
import { MonoLabel } from "@/components/stride/mono-label";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import type { SessionPanel } from "@/features/plans/view/session-panel";
import { SessionPanelBody } from "./session-panel";

const iconButton =
  "size-8.5 rounded-control border-border text-muted hover:text-foreground";

function href(sessionKey: string) {
  return `/plan/sessions/${encodeURIComponent(sessionKey)}`;
}

export function SessionSheet({ panel }: { panel: SessionPanel }) {
  const router = useRouter();
  const mobile = useIsMobile();
  const [open, setOpen] = useState(true);
  const touch = useRef<number | null>(null);

  const go = useCallback(
    (sessionKey: string | null) => {
      if (sessionKey) router.replace(href(sessionKey), { scroll: false });
    },
    [router],
  );

  const close = useCallback(() => {
    setOpen(false);
    router.back();
  }, [router]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)
        return;
      if (event.key === "ArrowLeft") go(panel.previousKey);
      else if (event.key === "ArrowRight") go(panel.nextKey);
      else return;
      event.preventDefault();
    }
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [go, panel.previousKey, panel.nextKey]);

  const position = `Séance ${panel.position.index} / ${panel.position.count}`;
  const previous = (
    <Button
      variant="outline"
      size="icon"
      aria-label="Séance précédente"
      disabled={!panel.previousKey}
      onClick={() => go(panel.previousKey)}
      className={cn(iconButton, "max-sm:size-11")}
    >
      <ChevronLeftIcon aria-hidden="true" />
    </Button>
  );
  const next = (
    <Button
      variant="outline"
      size="icon"
      aria-label="Séance suivante"
      disabled={!panel.nextKey}
      onClick={() => go(panel.nextKey)}
      className={cn(iconButton, "max-sm:size-11")}
    >
      <ChevronRightIcon aria-hidden="true" />
    </Button>
  );
  const fullPage = (
    <a href={href(panel.sessionKey)} aria-label="Ouvrir en page complète">
      <SquareArrowOutUpRightIcon aria-hidden="true" />
    </a>
  );

  return (
    <Sheet open={open} onOpenChange={(value) => !value && close()}>
      <SheetContent
        side={mobile ? "bottom" : "right"}
        showCloseButton={false}
        aria-describedby={undefined}
        overlayClassName="bg-background/45"
        onTouchStart={(event) => {
          touch.current = event.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(event) => {
          const start = touch.current;
          const end = event.changedTouches[0]?.clientX;
          touch.current = null;
          if (start === null || end === undefined) return;
          if (end - start > 60) go(panel.previousKey);
          else if (start - end > 60) go(panel.nextKey);
        }}
        className={cn(
          "gap-0 overflow-hidden border-border-strong bg-surface-panel text-foreground",
          mobile
            ? "data-[side=bottom]:top-14.5 data-[side=bottom]:rounded-t-[18px]"
            : "rounded-panel border shadow-[-30px_0_80px_rgba(0,0,0,.55)] data-[side=right]:inset-y-2 data-[side=right]:right-2 data-[side=right]:h-auto data-[side=right]:w-125 data-[side=right]:max-w-[calc(100vw-1rem)] data-[side=right]:sm:max-w-125",
        )}
      >
        {mobile && (
          <span
            aria-hidden="true"
            className="mt-2 mb-1 h-1 w-10 self-center rounded-mark bg-border-strong"
          />
        )}
        <header
          className={cn(
            "flex items-center gap-2 border-b border-border-subtle",
            mobile ? "px-4 pt-1.5 pb-3" : "px-4 py-3.5",
          )}
        >
          {previous}
          {mobile ? (
            <>
              <span className="flex flex-1 flex-col text-center">
                <span className="text-sm">{panel.day}</span>
                <MonoLabel size="nano" className="text-[9px]">
                  {position} · glisse ← →
                </MonoLabel>
              </span>
              {next}
            </>
          ) : (
            <>
              {next}
              <span className="ml-1.5 flex min-w-0 flex-col">
                <span className="text-[13px] text-muted">{panel.heading}</span>
                <MonoLabel size="nano" className="text-[9px]">
                  {position} de la semaine · ← → · Échap
                </MonoLabel>
              </span>
              <Button
                asChild
                variant="outline"
                size="icon"
                className={cn(iconButton, "ml-auto")}
              >
                {fullPage}
              </Button>
              <SheetClose asChild>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Fermer"
                  className={iconButton}
                >
                  <XIcon aria-hidden="true" />
                </Button>
              </SheetClose>
            </>
          )}
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-4.5 pb-6 sm:px-5.5 sm:pt-5">
          <SessionPanelBody panel={panel} titleId="session-panel-title" />
        </div>
        <footer
          className={cn(
            "flex items-center gap-2 border-t border-border-subtle bg-surface-inset px-4 py-3.5",
            mobile && "pb-[max(0.875rem,env(safe-area-inset-bottom))]",
          )}
        >
          <Button
            asChild
            variant="outline"
            size="md"
            className={cn(
              "rounded-control text-[13px]",
              mobile ? "min-h-11 flex-1" : "ml-auto min-h-9.5",
            )}
          >
            <a href={href(panel.sessionKey)}>
              <SquareArrowOutUpRightIcon aria-hidden="true" />
              Page complète
            </a>
          </Button>
        </footer>
      </SheetContent>
    </Sheet>
  );
}

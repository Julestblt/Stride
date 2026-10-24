"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { XIcon } from "lucide-react";
import { toast } from "sonner";
import { DataActivityLink as Link } from "@/features/data-activity/components/navigation";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { MonoLabel } from "@/components/stride/mono-label";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import type { ProposalReview } from "@/features/plans/review/review";
import {
  acceptProposal,
  rejectProposal,
  retryProposal,
  type ProposalActionResult,
} from "@/server/plans/actions";
import { ProposalReviewBody, toneText } from "./proposal-review";

let openedFromPlan = false;

export function markProposalOpened(event: React.MouseEvent) {
  openedFromPlan =
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey;
}

export function ProposalLink({
  onClick,
  ...props
}: React.ComponentProps<typeof Link>) {
  return (
    <Link
      {...props}
      onClick={(event) => {
        onClick?.(event);
        markProposalOpened(event);
      }}
    />
  );
}

const outcomes: Partial<Record<ProposalActionResult["status"], string>> = {
  applied: "Proposition appliquée au plan.",
  rejected: "Proposition refusée.",
};

const failures: Partial<Record<ProposalActionResult["status"], string>> = {
  error: "Ta décision n’a pas pu être enregistrée. Réessaie dans un instant.",
  "session-expired": "Ta session a expiré. Reconnecte-toi pour décider.",
  "invalid-request": "Cette proposition est introuvable.",
};

function Footer({
  review,
  mobile,
}: {
  review: ProposalReview;
  mobile: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [running, setRunning] = useState<"accept" | "reject" | null>(null);

  function run(
    kind: "accept" | "reject",
    action: (input: unknown) => Promise<ProposalActionResult>,
  ) {
    setRunning(kind);
    startTransition(async () => {
      const result = await action({ proposalId: review.id });
      const id = `proposal-${review.id}`;
      const outcome = outcomes[result.status];
      const failure = failures[result.status];
      if (outcome) toast.success(outcome, { id });
      if (failure) toast.error(failure, { id });
      setRunning(null);
    });
  }

  const { actions } = review;
  const decisionOpen = actions.accept || actions.reject || actions.retry;
  const button = mobile ? "w-full" : "";
  const historyLink = (
    <Button asChild variant="outline" size="md" className={cn(button, "h-11")}>
      <Link href="/plan/history">Historique</Link>
    </Button>
  );

  return (
    <footer
      className={cn(
        "flex flex-col gap-2.5 border-t border-border-subtle bg-surface-inset px-4 py-3.5",
        mobile && "pb-[max(0.875rem,env(safe-area-inset-bottom))]",
      )}
    >
      {decisionOpen ? (
        <div
          className={cn(
            "flex gap-2",
            mobile ? "flex-col" : "flex-row items-center",
          )}
        >
          {actions.retry ? (
            <Button
              size="md"
              className={cn(button, "h-11 px-4.5")}
              disabled={pending}
              aria-busy={running === "accept"}
              onClick={() => run("accept", retryProposal)}
            >
              Réessayer
            </Button>
          ) : (
            <Button
              size="md"
              className={cn(button, "h-11 px-4.5")}
              disabled={!actions.accept || pending}
              aria-busy={running === "accept"}
              onClick={() => run("accept", acceptProposal)}
            >
              {running === "accept" ? "Application…" : review.acceptLabel}
            </Button>
          )}
          {actions.reject && (
            <Button
              variant="outline"
              size="md"
              className={cn(button, "h-11")}
              disabled={pending}
              aria-busy={running === "reject"}
              onClick={() => run("reject", rejectProposal)}
            >
              Refuser
            </Button>
          )}
          <span
            className={cn(
              "text-xs text-muted-foreground",
              mobile ? "text-center" : "ml-auto max-w-55 text-right",
            )}
          >
            Rien ne change tant que tu n’as pas accepté.
          </span>
        </div>
      ) : (
        <div className={cn("flex gap-2", mobile && "flex-col")}>
          {review.appliedVersion !== null && review.extension && (
            <Button
              asChild
              variant="outline"
              size="md"
              className={cn(button, "h-11")}
            >
              <Link href={`/plan?race=${review.extension.raceId}`}>
                Voir le programme
              </Link>
            </Button>
          )}
          {review.appliedVersion !== null && review.weekStart && (
            <Button
              asChild
              variant="outline"
              size="md"
              className={cn(button, "h-11")}
            >
              <Link href={`/plan?week=${review.weekStart}`}>
                Voir la semaine
              </Link>
            </Button>
          )}
          {historyLink}
        </div>
      )}
    </footer>
  );
}

export function ProposalSheet({ review }: { review: ProposalReview }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mobile = useIsMobile();
  const [open, setOpen] = useState(true);

  const close = useCallback(() => {
    setOpen(false);
    if (openedFromPlan) {
      openedFromPlan = false;
      router.back();
      return;
    }
    const query = new URLSearchParams(searchParams);
    query.delete("proposal");
    const search = query.toString();
    router.replace(search ? `/plan?${search}` : "/plan", { scroll: false });
  }, [router, searchParams]);

  return (
    <Sheet open={open} onOpenChange={(value) => !value && close()}>
      <SheetContent
        side={mobile ? "bottom" : "right"}
        showCloseButton={false}
        aria-describedby={undefined}
        overlayClassName="bg-background/45"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          const links = document.querySelectorAll<HTMLElement>(
            `[data-proposal-id="${CSS.escape(review.id)}"]`,
          );
          [...links].find((link) => link.offsetParent !== null)?.focus();
        }}
        className={cn(
          "gap-0 overflow-hidden border-border-strong bg-surface-panel text-foreground",
          mobile
            ? "data-[side=bottom]:top-14.5 data-[side=bottom]:rounded-t-[18px]"
            : "rounded-panel border shadow-[-30px_0_80px_rgba(0,0,0,.55)] data-[side=right]:inset-y-2 data-[side=right]:right-2 data-[side=right]:h-auto data-[side=right]:w-140 data-[side=right]:max-w-[calc(100vw-1rem)] data-[side=right]:sm:max-w-140",
        )}
      >
        {mobile && (
          <span
            aria-hidden="true"
            className="mt-2 mb-1 h-1 w-10 self-center rounded-mark bg-border-strong"
          />
        )}
        <header className="flex items-center gap-2.5 border-b border-border-subtle px-4 py-3.5">
          <span className="flex min-w-0 flex-col gap-0.5">
            <MonoLabel size="micro">{review.kicker}</MonoLabel>
            <span className="truncate text-meta text-muted">
              {review.subkicker}
            </span>
          </span>
          <MonoLabel
            size="micro"
            className={cn("ml-auto text-right", toneText[review.status.tone])}
          >
            {review.status.label}
          </MonoLabel>
          <SheetClose asChild>
            <Button
              variant="outline"
              size="icon"
              aria-label="Fermer"
              className="size-8.5 rounded-control border-border text-muted hover:text-foreground max-sm:size-11"
            >
              <XIcon aria-hidden="true" />
            </Button>
          </SheetClose>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-5 pb-6 sm:px-5.5">
          <ProposalReviewBody
            review={review}
            titleSlot={
              <SheetTitle className="text-headline font-semibold">
                {review.title}
              </SheetTitle>
            }
          />
        </div>
        <Footer review={review} mobile={mobile} />
      </SheetContent>
    </Sheet>
  );
}

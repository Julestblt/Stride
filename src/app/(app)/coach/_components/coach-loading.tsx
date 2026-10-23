"use client";

import { ChevronLeftIcon, PlusIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { DataActivityLink as Link } from "@/features/data-activity/components/navigation";
import { LoadingScope } from "@/features/data-activity/components/loading";
import { AppHeader } from "@/features/app-shell/components/app-header";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { MonoLabel } from "@/components/stride/mono-label";
import { cn } from "@/lib/utils";
import { participantsLine } from "@/features/coach/conversations";
import {
  StaffPortrait,
  StaffStack,
} from "@/features/coach/components/staff-portrait";
import { useStaff } from "@/features/coach/components/staff-context";
import { staffAgents } from "@/features/coach/staff";

function ConversationListLoading() {
  const staff = useStaff();
  return (
    <section
      aria-label="Conversations"
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="flex flex-col gap-2.5 px-4 pt-4 pb-2.5 min-[980px]:px-3.5">
        <div className="flex flex-col gap-4 min-[980px]:hidden">
          <div className="flex min-h-11 items-center gap-2.5">
            <h1 className="text-title font-semibold tracking-[-0.02em]">
              Coach
            </h1>
            <Button
              asChild
              variant="outline"
              size="icon"
              className="ml-auto size-11 rounded-surface"
            >
              <Link href="/coach/nouvelle" aria-label="Nouvelle conversation">
                <PlusIcon aria-hidden="true" />
              </Link>
            </Button>
            <SidebarTrigger
              aria-label="Afficher ou masquer la barre latérale"
              className="-mr-2 size-11"
            />
          </div>
          <section aria-label="Ton staff" className="flex flex-col gap-2.5">
            <div className="flex items-baseline">
              <MonoLabel size="nano">Ton staff</MonoLabel>
            </div>
            <div className="flex gap-3">
              {staffAgents.map((agent) => (
                <span
                  key={agent}
                  className="flex w-15.5 flex-col items-center gap-1.5 text-xs text-muted"
                >
                  <StaffPortrait agent={agent} size={56} decorative />
                  <span aria-hidden="true">{staff[agent].name}</span>
                </span>
              ))}
            </div>
          </section>
        </div>
        <div className="flex items-center gap-2 max-[979px]:hidden">
          <h2 className="text-lead font-semibold">Conversations</h2>
          <Button
            asChild
            variant="outline"
            size="sm"
            className="ml-auto h-8 rounded-surface px-2.5"
          >
            <Link href="/coach/nouvelle">
              <PlusIcon aria-hidden="true" />
              Nouvelle
            </Link>
          </Button>
        </div>
        <div aria-hidden="true" className="flex flex-col gap-2.5">
          <Skeleton className="h-9 w-full rounded-surface" />
          <div className="flex gap-1.5">
            <Skeleton className="h-7.5 w-16 rounded-control" />
            <Skeleton className="h-7.5 w-20 rounded-control" />
          </div>
        </div>
      </div>
      <div
        aria-hidden="true"
        className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden px-1.5 pb-3"
      >
        <div className="px-3.5 pt-2.5 pb-0.5">
          <Skeleton className="h-2.5 w-20" />
        </div>
        {Array.from({ length: 6 }, (_, item) => (
          <div
            key={item}
            className="grid grid-cols-[40px_minmax(0,1fr)] items-start gap-x-3 px-3.5 py-3"
          >
            <Skeleton className="size-10 rounded-[10px]" />
            <div className="flex min-w-0 flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <Skeleton className="h-4 w-3/5" />
                <Skeleton className="h-2.5 w-10" />
              </div>
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ThreadHeader({ title }: { title: string | null }) {
  const staff = useStaff();
  return (
    <div className="flex min-h-14 shrink-0 items-center gap-2.5 border-b border-border-subtle py-2 pr-2.5 pl-1.5 min-[980px]:gap-3 min-[980px]:px-6 min-[980px]:py-3">
      <Button
        asChild
        variant="ghost"
        size="icon"
        className="size-11 text-muted min-[980px]:hidden"
      >
        <Link href="/coach" aria-label="Retour aux conversations">
          <ChevronLeftIcon aria-hidden="true" />
        </Link>
      </Button>
      {title ? (
        <>
          <StaffStack agents={["coach"]} size={30} />
          <span className="flex min-w-0 flex-1 flex-col">
            <h1 className="truncate text-body font-semibold">{title}</h1>
            <span className="truncate text-xs text-muted-foreground">
              {participantsLine(staff, ["coach"])}
            </span>
          </span>
        </>
      ) : (
        <span
          aria-hidden="true"
          className="flex min-w-0 flex-1 items-center gap-2.5 min-[980px]:gap-3"
        >
          <Skeleton className="size-7.5 shrink-0 rounded-[9px]" />
          <span className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </span>
        </span>
      )}
    </div>
  );
}

function EmptyThread({ plan }: { plan: boolean }) {
  const staff = useStaff();
  return (
    <div className="mx-auto flex w-full max-w-205 flex-col gap-4 px-4 pt-8 sm:px-[clamp(20px,3vw,44px)] sm:pt-12">
      <StaffPortrait agent="coach" size={56} />
      <h2 className="text-headline font-semibold">
        {plan ? `Demande ton plan à ${staff.coach.name}` : "Écris à ton staff"}
      </h2>
      <p className="max-w-140 text-body leading-normal text-muted">
        {plan
          ? `${staff.coach.name} construit ton plan à partir de tes objectifs, de tes disponibilités et de ton historique, puis te le propose. Rien n’est enregistré sans ton accord.`
          : `Pose ta question sur ton entraînement, ta récupération ou une douleur. ${staff.coach.name} te répond ou passe la main à ${staff.medical.name}, qui te parle directement quand c’est utile.`}
      </p>
    </div>
  );
}

function ThreadLogLoading() {
  return (
    <div
      aria-hidden="true"
      className="mx-auto flex w-full max-w-205 flex-col gap-6 px-4 pt-6 pb-6 sm:px-[clamp(20px,3vw,44px)]"
    >
      <Skeleton className="h-12 w-3/5 self-end rounded-card" />
      <div className="flex gap-3">
        <Skeleton className="size-8 shrink-0 rounded-[9px]" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
      <Skeleton className="h-10 w-2/5 self-end rounded-card" />
      <div className="flex gap-3">
        <Skeleton className="size-8 shrink-0 rounded-[9px]" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    </div>
  );
}

function ComposerLoading() {
  const staff = useStaff();
  return (
    <div className="mx-auto flex w-full max-w-205 flex-col gap-2.5 border-t border-border-subtle bg-surface-inset px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-[clamp(20px,3vw,44px)] sm:pb-5">
      <Skeleton aria-hidden="true" className="h-13 w-full rounded-card" />
      <p className="text-xs text-muted-foreground max-sm:hidden">
        {staff.coach.name} lit chaque message et passe la main au bon
        spécialiste, deux au plus par demande. Les questions d’un spécialiste
        lui reviennent directement. Rien ne change sans ton accord.
      </p>
    </div>
  );
}

export function CoachLoading({
  view,
}: {
  view: "conversations" | "thread" | "new";
}) {
  const plan = useSearchParams().get("demande") === "plan";
  const current = view !== "conversations";
  return (
    <LoadingScope
      label={
        view === "thread"
          ? "Chargement de la conversation"
          : "Chargement des conversations"
      }
      className="flex min-h-0 flex-1 flex-col"
    >
      <AppHeader
        title="Coach"
        crumbs={[{ label: "Coach" }, { label: "Conversations" }]}
        className="max-[980px]:hidden"
      />
      <div className="flex min-h-0 flex-1">
        <div
          className={cn(
            "min-h-0 w-full flex-col bg-surface-inset min-[980px]:flex min-[980px]:w-80 min-[980px]:shrink-0 min-[980px]:border-r min-[980px]:border-border-subtle",
            current ? "hidden" : "flex",
          )}
        >
          <ConversationListLoading />
        </div>
        <section
          aria-label={
            view === "thread" ? "Conversation" : "Nouvelle conversation"
          }
          className={cn(
            "min-h-0 min-w-0 flex-[999_1_520px] flex-col min-[980px]:flex",
            current ? "flex" : "hidden",
          )}
        >
          <ThreadHeader
            title={view === "thread" ? null : "Nouvelle conversation"}
          />
          <div className="min-h-0 flex-1 [scrollbar-gutter:stable] overflow-y-auto overscroll-contain">
            {view === "thread" ? (
              <ThreadLogLoading />
            ) : (
              <EmptyThread plan={view === "new" && plan} />
            )}
          </div>
          <ComposerLoading />
        </section>
      </div>
    </LoadingScope>
  );
}

export function TeamLoading() {
  const coach = useStaff().coach;
  return (
    <LoadingScope
      label="Chargement de l’équipe"
      className="flex min-h-0 flex-1 flex-col"
    >
      <AppHeader
        title="L’équipe"
        back={{ href: "/coach", label: "Retour aux conversations" }}
        crumbs={[{ label: "Coach", href: "/coach" }, { label: "L’équipe" }]}
      />
      <div className="min-h-0 flex-1 [scrollbar-gutter:stable] overflow-y-auto overscroll-contain">
        <main className="mx-auto flex w-full max-w-280 flex-col gap-4 px-4 pt-1 pb-14 md:gap-7 md:px-[clamp(20px,3vw,44px)] md:pt-8">
          <div className="flex flex-col gap-2 md:gap-2.5">
            <MonoLabel size="nano">
              Ton staff · {staffAgents.length} agents IA
            </MonoLabel>
            <h1 className="max-w-180 text-[28px] leading-[1.1] font-semibold tracking-[-0.03em] md:text-[40px] md:leading-[1.05]">
              <span className="md:hidden">
                Une équipe autour de toi, une seule conversation.
              </span>
              <span className="max-md:hidden">
                Une équipe autour de toi, dans une seule conversation.
              </span>
            </h1>
            <p className="text-sm leading-normal text-muted md:hidden">
              {coach.name} mène. Les spécialistes te parlent directement quand
              ta demande touche leur domaine, et tu valides chaque changement.
            </p>
            <p className="max-w-170 text-base leading-[1.55] text-muted max-md:hidden">
              Comme le staff d’un athlète pro : {coach.name} mène, et chaque
              spécialiste apporte son regard quand ta demande touche son
              domaine. Choisis le visage de chacun, leur expertise reste la
              même.
            </p>
          </div>
          <Skeleton
            aria-hidden="true"
            className="h-150 w-full rounded-[16px] min-[1100px]:h-75 md:h-90"
          />
          <section className="flex flex-col gap-3.5">
            <div className="flex items-baseline gap-2.5 pt-1.5 md:gap-3 md:pt-0">
              <h2 className="text-[17px] font-semibold md:text-lg">
                Les spécialistes
              </h2>
              <span className="text-xs text-muted-foreground md:text-meta">
                Consultés par {coach.name}
                <span className="max-md:hidden">, jamais en direct</span>
              </span>
            </div>
            <div
              aria-hidden="true"
              className="grid gap-4 min-[1100px]:grid-cols-2"
            >
              {staffAgents
                .filter((agent) => agent !== "coach")
                .map((agent) => (
                  <Skeleton
                    key={agent}
                    className="h-110 w-full rounded-[16px] md:h-100"
                  />
                ))}
            </div>
          </section>
        </main>
      </div>
    </LoadingScope>
  );
}

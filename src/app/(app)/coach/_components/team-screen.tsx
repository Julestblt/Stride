"use client";

import Link from "next/link";
import { ArrowRightIcon, CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MonoLabel } from "@/components/stride/mono-label";
import { AppHeader } from "@/features/app-shell/components/app-header";
import { useStaff } from "@/features/coach/components/staff-context";
import {
  StaffPortrait,
  StaffStack,
} from "@/features/coach/components/staff-portrait";
import {
  staffAgents,
  type SpecialistAgent,
  type StaffAgent,
} from "@/features/coach/staff";
import {
  conversationsLabel,
  opinionsLabel,
  teamProfiles,
  type StaffUsage,
} from "@/features/coach/team";
import { cn } from "@/lib/utils";
import { FacePicker } from "./face-picker";

const roleTone: Record<StaffAgent, { dot: string; text: string }> = {
  coach: { dot: "bg-accent", text: "text-accent" },
  medical: { dot: "bg-staff-medical", text: "text-staff-medical" },
  director: { dot: "bg-staff-director", text: "text-staff-director" },
  strategist: { dot: "bg-staff-strategist", text: "text-staff-strategist" },
  nutritionist: {
    dot: "bg-staff-nutritionist",
    text: "text-staff-nutritionist",
  },
};

const specialists = staffAgents.filter(
  (agent): agent is SpecialistAgent => agent !== "coach",
);

function Dot({ className }: { className: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("size-1.5 shrink-0 rounded-full", className)}
    />
  );
}

function RoleLine({ agent, label }: { agent: StaffAgent; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <Dot className={roleTone[agent].dot} />
      <MonoLabel size="nano" className={roleTone[agent].text}>
        {label}
      </MonoLabel>
      <MonoLabel
        size="nano"
        className="ml-auto rounded-[4px] border border-border-strong px-1.25 py-px max-md:hidden"
      >
        IA
      </MonoLabel>
    </span>
  );
}

function Checklist({
  title,
  items,
}: {
  title: string;
  items: readonly string[];
}) {
  return (
    <div className="flex flex-col gap-2">
      <MonoLabel size="nano">{title}</MonoLabel>
      <ul className="flex flex-col gap-1.5">
        {items.map((item) => (
          <li
            key={item}
            className="grid grid-cols-[14px_minmax(0,1fr)] gap-2 text-meta leading-[1.45] text-muted"
          >
            <CheckIcon
              aria-hidden="true"
              className="mt-0.75 size-3 text-accent"
              strokeWidth={2.4}
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Reads({ items }: { items: readonly string[] }) {
  return (
    <div className="flex flex-col gap-2">
      <MonoLabel size="nano" className="max-md:hidden">
        Regarde
      </MonoLabel>
      <ul aria-label="Données consultées" className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <li
            key={item}
            className="rounded-control border border-border-strong px-1.75 py-0.5 text-[11px] text-muted"
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Usage({
  count,
  label,
  className,
}: {
  count: number;
  label: string;
  className?: string;
}) {
  return (
    <span className={cn("flex items-baseline gap-1.5", className)}>
      <span className="font-metric text-[22px] font-semibold tabular-nums">
        {count}
      </span>{" "}
      <span className="text-xs text-muted-foreground">{label}</span>
    </span>
  );
}

function FaceRow({
  agent,
  className,
}: {
  agent: StaffAgent;
  className?: string;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span
        aria-hidden="true"
        className="text-xs text-muted-foreground max-md:mr-auto"
      >
        Visage
      </span>
      <FacePicker agent={agent} />
    </span>
  );
}

function CoachCard({ usage }: { usage: StaffUsage }) {
  const coach = useStaff().coach;
  const profile = teamProfiles.coach;
  return (
    <section
      aria-labelledby="team-coach"
      className="flex min-w-0 flex-col overflow-hidden rounded-[16px] border border-accent/20 bg-surface min-[1100px]:flex-row md:border-border"
    >
      <div className="relative h-75 w-75 max-w-full shrink-0 max-md:hidden min-[1100px]:h-auto min-[1100px]:min-h-75">
        <StaffPortrait agent="coach" size={300} fill decorative />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3.5 px-4 py-4.5 md:gap-4 md:px-7.5 md:py-7">
        <StaffPortrait
          agent="coach"
          size={120}
          decorative
          className="md:hidden"
        />
        <div className="flex flex-col gap-1.25 md:gap-4">
          <RoleLine agent="coach" label={profile.tagline} />
          <h2
            id="team-coach"
            className="text-[26px] leading-none font-semibold tracking-[-0.02em] md:text-[34px] md:tracking-[-0.03em]"
          >
            {coach.name}
          </h2>
          <p className="max-w-140 text-sm leading-normal text-muted md:text-base">
            {profile.summary(coach)}
          </p>
        </div>
        <div className="grid gap-3.5 border-t border-border pt-3 md:grid-cols-2 md:gap-5 md:pt-4">
          <Checklist title={profile.listTitle} items={profile.duties(coach)} />
          <div className="flex flex-col gap-1.5">
            <Reads items={profile.reads} />
            <Usage
              count={usage.conversations}
              label={conversationsLabel(usage.conversations)}
              className="mt-1.5 max-md:hidden"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 max-md:border-t max-md:border-border max-md:pt-3 md:mt-auto">
          <Button asChild size="md" className="rounded-surface max-md:hidden">
            <Link href="/coach/new">Écrire à {coach.name}</Link>
          </Button>
          <FaceRow agent="coach" className="max-md:w-full md:ml-auto" />
        </div>
      </div>
    </section>
  );
}

function SpecialistCard({
  agent,
  usage,
}: {
  agent: SpecialistAgent;
  usage: StaffUsage;
}) {
  const member = useStaff()[agent];
  const profile = teamProfiles[agent];
  const id = `team-${agent}`;
  return (
    <article
      aria-labelledby={id}
      className="flex min-w-0 flex-col gap-3.5 rounded-[16px] border border-border bg-surface px-4 py-4.5 md:gap-4 md:p-5.5"
    >
      <div className="flex items-start gap-3.5 md:gap-4">
        <StaffPortrait
          agent={agent}
          size={72}
          decorative
          className="md:hidden"
        />
        <StaffPortrait
          agent={agent}
          size={88}
          decorative
          className="max-md:hidden"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1.25 md:gap-1.5">
          <RoleLine agent={agent} label={profile.tagline} />
          <h3
            id={id}
            className="text-xl font-semibold tracking-[-0.02em] md:text-[22px]"
          >
            {member.name}
          </h3>
          <p className="text-sm leading-normal text-muted">
            {profile.summary(member)}
          </p>
        </div>
      </div>
      <div className="border-t border-border pt-3 md:pt-3.5">
        <Checklist title={profile.listTitle} items={profile.duties(member)} />
      </div>
      <Reads items={profile.reads} />
      <div className="mt-auto flex flex-wrap items-center gap-3 border-t border-border pt-3 md:pt-3.5">
        <Usage
          count={usage.opinions[agent]}
          label={opinionsLabel}
          className="max-md:hidden"
        />
        <FaceRow agent={agent} className="max-md:w-full md:ml-auto" />
      </div>
    </article>
  );
}

function Initials({ initials }: { initials: string }) {
  return (
    <span
      aria-hidden="true"
      className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-border text-xs font-semibold"
    >
      {initials}
    </span>
  );
}

function Arrow() {
  return <ArrowRightIcon aria-hidden="true" className="size-4.5 text-dim" />;
}

function Step({
  index,
  title,
  children,
  text,
}: {
  index: number;
  title: string;
  children: React.ReactNode;
  text: string;
}) {
  return (
    <li className="flex min-w-0 flex-col gap-3 rounded-panel border border-border p-5">
      <span className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className="grid size-6 place-items-center rounded-[7px] bg-surface-raised font-metric text-body font-semibold"
        >
          {index}
        </span>
        <h3 className="text-body font-semibold">{title}</h3>
      </span>
      <span aria-hidden="true" className="flex min-h-10 items-center gap-1.5">
        {children}
      </span>
      <p className="text-meta leading-normal text-muted">{text}</p>
    </li>
  );
}

function HowItWorks({ initials }: { initials: string }) {
  const coach = useStaff().coach;
  return (
    <section
      aria-labelledby="team-how"
      className="flex flex-col gap-3.5 max-md:hidden"
    >
      <h2 id="team-how" className="text-lg font-semibold">
        Comment le staff travaille
      </h2>
      <ol className="grid grid-cols-3 gap-3">
        <Step
          index={1}
          title={`Tu écris à ${coach.name}`}
          text="Une question, une douleur, une nouvelle course. Tu n’as pas à savoir qui consulter."
        >
          <Initials initials={initials} />
          <Arrow />
          <StaffPortrait agent="coach" size={36} decorative />
        </Step>
        <Step
          index={2}
          title={`${coach.name} passe la main`}
          text="Au spécialiste utile, deux au plus. Il te parle directement et te pose ses questions dans la conversation."
        >
          <StaffPortrait agent="coach" size={36} decorative />
          <Arrow />
          <StaffStack agents={specialists} size={36} />
        </Step>
        <Step
          index={3}
          title="Tu décides"
          text="Le staff propose, tu valides ou tu refuses. Ton plan ne change jamais sans toi."
        >
          <StaffPortrait agent="coach" size={36} decorative />
          <Arrow />
          <Initials initials={initials} />
          <span className="rounded-control border border-accent bg-accent px-2 py-0.75 text-xs font-semibold text-accent-foreground">
            Valider
          </span>
        </Step>
      </ol>
      <ul className="flex flex-wrap gap-5 pt-1 text-meta text-muted-foreground">
        <li className="inline-flex items-center gap-2">
          <Dot className="bg-staff-medical" />
          Ta santé passe avant la performance
        </li>
        <li className="inline-flex items-center gap-2">
          <Dot className="bg-accent" />
          {coach.name} mène la conversation
        </li>
        <li className="inline-flex items-center gap-2">
          <Dot className="bg-muted" />
          Lecture seule de tes données
        </li>
      </ul>
    </section>
  );
}

function Principles() {
  return (
    <ul className="flex flex-col gap-2 rounded-panel border border-border px-4 py-3.5 text-meta text-muted md:hidden">
      <li className="inline-flex items-center gap-2">
        <Dot className="bg-staff-medical" />
        Ta santé passe avant la performance
      </li>
      <li className="inline-flex items-center gap-2">
        <Dot className="bg-accent" />
        Deux spécialistes au plus par demande
      </li>
      <li className="inline-flex items-center gap-2">
        <Dot className="bg-muted" />
        Rien ne change sans ton accord
      </li>
    </ul>
  );
}

export function TeamScreen({
  usage,
  initials,
}: {
  usage: StaffUsage;
  initials: string;
}) {
  const coach = useStaff().coach;
  return (
    <>
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
          <CoachCard usage={usage} />
          <section
            aria-labelledby="team-specialists"
            className="flex flex-col gap-3.5"
          >
            <div className="flex items-baseline gap-2.5 pt-1.5 md:gap-3 md:pt-0">
              <h2
                id="team-specialists"
                className="text-[17px] font-semibold md:text-lg"
              >
                Les spécialistes
              </h2>
              <span className="text-xs text-muted-foreground md:text-meta">
                Consultés par {coach.name}
                <span className="max-md:hidden">, jamais en direct</span>
              </span>
            </div>
            <div className="grid gap-4 min-[1100px]:grid-cols-2">
              {specialists.map((agent) => (
                <SpecialistCard key={agent} agent={agent} usage={usage} />
              ))}
            </div>
          </section>
          <HowItWorks initials={initials} />
          <Principles />
        </main>
      </div>
    </>
  );
}

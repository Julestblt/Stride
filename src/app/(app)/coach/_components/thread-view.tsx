"use client";

import { useId, useState } from "react";
import { ArrowRightIcon, CheckIcon, ChevronDownIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MonoLabel } from "@/components/stride/mono-label";
import { PulseDot } from "@/components/stride/marks";
import { cn } from "@/lib/utils";
import { dayLabel, sameDay, timeLabel } from "@/features/coach/conversations";
import {
  StaffPortrait,
  StaffStack,
} from "@/features/coach/components/staff-portrait";
import { staff } from "@/features/coach/staff";
import {
  askedByLabel,
  consultHeadline,
  questionAttribution,
  type CoachBlock,
  type ConsultView,
  type ProposalCardStatus,
  type ThreadEntry,
} from "@/features/coach/thread";
import { ProposalLink } from "../../plan/_components/proposal-sheet";

export const quickAnswers = ["Oui", "Non", "Je ne sais pas"] as const;

function StaffName({ agent }: { agent: ConsultView["agent"] }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-meta font-semibold text-foreground">
      {staff[agent].name}
      <MonoLabel size="nano" className="font-normal">
        {staff[agent].role}
      </MonoLabel>
    </span>
  );
}

function ConsultSteps({ consult }: { consult: ConsultView }) {
  return (
    <>
      {consult.steps.map((step, index) => (
        <div
          key={index}
          className="grid grid-cols-[28px_minmax(0,1fr)] gap-2.5 px-3 py-2.5 sm:px-4"
        >
          <StaffPortrait agent={step.from} size={28} decorative />
          <div className="flex min-w-0 flex-col gap-1.25">
            <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">
                {staff[step.from].name}
              </span>
              {step.from !== "coach" && (
                <MonoLabel size="nano">{staff[step.from].role}</MonoLabel>
              )}
              {step.to && (
                <>
                  <ArrowRightIcon aria-hidden="true" className="size-3" />
                  <span className="sr-only">à</span>
                  <span>{staff[step.to].name}</span>
                </>
              )}
            </span>
            <p
              className={cn(
                "text-sm leading-normal whitespace-pre-wrap",
                step.from === "coach" ? "text-muted" : "text-foreground",
              )}
            >
              {step.text}
            </p>
          </div>
        </div>
      ))}
      {consult.reads.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pr-3 pb-2.5 pl-15.5 sm:pr-4">
          {consult.reads.map((read) => (
            <span
              key={read}
              className="inline-flex items-center rounded-control border border-border-strong px-1.75 py-0.5 text-[11px] text-muted"
            >
              {read}
            </span>
          ))}
        </div>
      )}
    </>
  );
}

function LiveConsult({ consults }: { consults: ConsultView[] }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Le staff travaille"
      className="flex flex-col rounded-panel border border-border bg-surface-panel"
    >
      <div className="flex items-center gap-2 border-b border-border-subtle px-3 py-2.5 sm:px-4">
        <PulseDot />
        <MonoLabel size="micro" tone="foreground">
          Le staff travaille
        </MonoLabel>
      </div>
      {consults.map((consult) => (
        <div key={consult.thread} className="flex flex-col py-0.5">
          <ConsultSteps consult={consult} />
          {consult.state === "working" && (
            <div className="grid grid-cols-[28px_minmax(0,1fr)] gap-2.5 px-3 pb-3 sm:px-4">
              <StaffPortrait agent={consult.agent} size={28} decorative />
              <div className="flex min-w-0 flex-col gap-2">
                <StaffName agent={consult.agent} />
                <span className="text-meta text-muted">{consult.summary}</span>
                <span
                  aria-hidden="true"
                  className="relative h-0.5 overflow-hidden rounded-full bg-border"
                >
                  <span className="absolute inset-y-0 left-0 w-[30%] bg-linear-to-r from-transparent via-accent to-transparent motion-safe:animate-trace motion-reduce:hidden" />
                </span>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function FoldedConsult({ consults }: { consults: ConsultView[] }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div
      role="group"
      aria-label="Concertation du staff"
      className="flex flex-col rounded-card border border-border bg-surface-panel"
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
        className="flex flex-col gap-2 rounded-card px-3 py-2.5 text-left text-meta text-muted focus-visible:outline-2 focus-visible:outline-ring sm:px-3.5"
      >
        <span className="flex w-full items-center gap-2.5">
          <MonoLabel size="micro" tone="foreground">
            Concertation
          </MonoLabel>
          <span className="text-xs text-muted-foreground">
            {consultHeadline(consults)}
          </span>
          <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            {open ? "Masquer" : "Voir le détail"}
            <ChevronDownIcon
              aria-hidden="true"
              className={cn(
                "size-3 transition-transform duration-200 ease-stride",
                open && "rotate-180",
              )}
            />
          </span>
        </span>
        {!open &&
          consults.map((consult) => (
            <span
              key={consult.thread}
              className="grid grid-cols-[20px_minmax(0,1fr)] items-center gap-2"
            >
              <StaffPortrait agent={consult.agent} size={20} decorative />
              <span>
                <b className="font-semibold text-foreground">
                  {staff[consult.agent].name}
                </b>{" "}
                · {consult.summary}
              </span>
            </span>
          ))}
      </button>
      <div
        id={id}
        hidden={!open}
        className="border-t border-border-subtle py-1"
      >
        {consults.map((consult) => (
          <ConsultSteps key={consult.thread} consult={consult} />
        ))}
      </div>
    </div>
  );
}

function QuestionCard({
  block,
  timeZone,
  onAnswer,
  disabled,
}: {
  block: Extract<CoachBlock, { type: "question" }>;
  timeZone: string;
  onAnswer: (text: string) => void;
  disabled: boolean;
}) {
  const pending = block.state === "pending";
  return (
    <div
      className={cn(
        "flex flex-col gap-2.5 rounded-panel border px-3.5 py-3 sm:px-4 sm:py-3.5",
        pending ? "border-warning-border" : "border-border",
      )}
    >
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {pending ? (
          <span className="inline-flex items-center gap-1.5 text-warning">
            <PulseDot tone="warning" breathing={false} />
            {questionAttribution(block.askedFor)}
          </span>
        ) : block.state === "answered" ? (
          <span className="inline-flex items-center gap-1.5">
            <CheckIcon aria-hidden="true" className="size-3 text-success" />
            Question répondue
            {block.answeredAt && ` · ${timeLabel(block.answeredAt, timeZone)}`}
          </span>
        ) : (
          <span>Question restée sans réponse</span>
        )}
        <span className="ml-auto inline-flex items-center gap-1.5">
          <StaffPortrait agent={block.askedFor} size={16} decorative />
          {askedByLabel(block.askedFor)}
        </span>
      </div>
      <p className="text-body leading-snug font-medium">{block.question}</p>
      {pending && (
        <div className="flex flex-wrap gap-1.5">
          {quickAnswers.map((answer) => (
            <Button
              key={answer}
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => onAnswer(answer)}
              className="h-9 rounded-full px-3 text-meta font-normal text-muted"
            >
              {answer}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

const proposalStatus: Record<
  ProposalCardStatus,
  { label: string; tone: "warning" | "accent" | "foreground" | "muted" }
> = {
  pending: { label: "À toi de décider", tone: "warning" },
  applying: { label: "Application en cours", tone: "accent" },
  applied: { label: "Appliquée", tone: "foreground" },
  rejected: { label: "Refusée", tone: "muted" },
  closed: { label: "Plus applicable", tone: "muted" },
};

function ProposalCard({
  block,
}: {
  block: Extract<CoachBlock, { type: "proposal" }>;
}) {
  const status = proposalStatus[block.status];
  return (
    <div className="flex flex-col gap-3.5 rounded-panel border border-border bg-surface p-4 sm:p-4.5">
      <div className="flex items-center gap-2">
        <MonoLabel tone="foreground">
          {block.scope === "new_plan"
            ? "Proposition · Nouveau plan"
            : "Proposition · Plan"}
        </MonoLabel>
        <MonoLabel
          tone={status.tone}
          className={cn(
            "ml-auto",
            block.status === "applied" && "text-success",
          )}
        >
          {status.label}
        </MonoLabel>
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-lead font-semibold">{block.title}</p>
        {block.summary && (
          <p className="text-sm leading-normal text-muted">{block.summary}</p>
        )}
      </div>
      {block.opinions.length > 0 && (
        <div className="flex flex-col border-t border-border">
          {block.opinions.map((opinion, index) => (
            <div
              key={index}
              className="grid grid-cols-[20px_minmax(0,1fr)] gap-2.5 border-b border-border py-2.5 text-meta leading-snug text-muted"
            >
              <StaffPortrait agent={opinion.agent} size={20} decorative />
              <span>
                <b className="font-semibold text-foreground">
                  {staff[opinion.agent].name}
                </b>{" "}
                · {opinion.summary}
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          asChild
          size="md"
          variant={block.status === "pending" ? "default" : "outline"}
        >
          <ProposalLink
            href={`/plan?proposition=${block.proposalId}`}
            data-proposal-id={block.proposalId}
          >
            {block.status === "pending" ? "Examiner" : "Voir la proposition"}
          </ProposalLink>
        </Button>
      </div>
    </div>
  );
}

function CoachMessage({
  entry,
  timeZone,
  onAnswer,
  busy,
}: {
  entry: Extract<ThreadEntry, { type: "coach" }>;
  timeZone: string;
  onAnswer: (text: string) => void;
  busy: boolean;
}) {
  return (
    <div className="flex flex-col gap-2.5 sm:grid sm:grid-cols-[36px_minmax(0,1fr)] sm:items-start sm:gap-3">
      <span className="max-sm:hidden">
        <StaffPortrait agent="coach" size={36} decorative />
      </span>
      <div className="flex min-w-0 flex-col gap-2.5 sm:gap-3">
        <div className="flex items-center gap-2">
          <span className="sm:hidden">
            <StaffPortrait agent="coach" size={28} decorative />
          </span>
          <StaffName agent="coach" />
          <MonoLabel size="nano">{timeLabel(entry.at, timeZone)}</MonoLabel>
        </div>
        {entry.blocks.map((block, index) => {
          if (block.type === "text")
            return (
              <p
                key={index}
                className="text-body leading-[1.55] whitespace-pre-wrap"
              >
                {block.text}
              </p>
            );
          if (block.type === "consult")
            return block.live ? (
              <LiveConsult key={block.key} consults={block.consults} />
            ) : (
              <FoldedConsult key={block.key} consults={block.consults} />
            );
          if (block.type === "question")
            return (
              <QuestionCard
                key={index}
                block={block}
                timeZone={timeZone}
                onAnswer={onAnswer}
                disabled={busy}
              />
            );
          if (block.type === "proposal")
            return <ProposalCard key={index} block={block} />;
          return (
            <p key={index} className="text-sm text-danger">
              {block.text}
            </p>
          );
        })}
      </div>
    </div>
  );
}

function AthleteMessage({
  entry,
  timeZone,
}: {
  entry: Extract<ThreadEntry, { type: "athlete" }>;
  timeZone: string;
}) {
  return (
    <div className="flex max-w-[84%] flex-col gap-1.5 self-end">
      {entry.consult && (
        <span className="inline-flex items-center gap-1.5 self-end text-xs text-muted-foreground">
          <StaffStack agents={[entry.consult]} size={16} />
          Avis demandé à {staff[entry.consult].name}
        </span>
      )}
      <div className="rounded-[16px_16px_4px_16px] bg-surface-raised px-3.25 py-2.75 text-body leading-[1.45] whitespace-pre-wrap">
        {entry.text}
        <MonoLabel size="nano" className="mt-1 block text-right">
          {timeLabel(entry.at, timeZone)}
        </MonoLabel>
      </div>
    </div>
  );
}

export function ThreadLog({
  entries,
  pending,
  timeZone,
  now,
  busy,
  onAnswer,
}: {
  entries: ThreadEntry[];
  pending: string | null;
  timeZone: string;
  now: Date;
  busy: boolean;
  onAnswer: (text: string) => void;
}) {
  return (
    <div
      role="log"
      aria-label="Messages"
      className="mx-auto flex w-full max-w-205 flex-col gap-5.5 px-4 pt-5 pb-6 sm:px-[clamp(20px,3vw,44px)] sm:pt-7"
    >
      {entries.map((entry, index) => {
        const previous = entries[index - 1];
        const separator =
          !previous || !sameDay(previous.at, entry.at, timeZone);
        return (
          <div key={entry.key} className="flex flex-col gap-5.5">
            {separator && (
              <div className="flex items-center gap-3" aria-hidden="true">
                <span className="h-px flex-1 bg-border-subtle" />
                <MonoLabel size="nano">
                  {dayLabel(entry.at, now, timeZone)}
                </MonoLabel>
                <span className="h-px flex-1 bg-border-subtle" />
              </div>
            )}
            {entry.type === "athlete" ? (
              <AthleteMessage entry={entry} timeZone={timeZone} />
            ) : (
              <CoachMessage
                entry={entry}
                timeZone={timeZone}
                onAnswer={onAnswer}
                busy={busy}
              />
            )}
          </div>
        );
      })}
      {pending && (
        <div className="flex max-w-[84%] flex-col self-end rounded-[16px_16px_4px_16px] bg-surface-raised px-3.25 py-2.75 text-body leading-[1.45] whitespace-pre-wrap opacity-70">
          {pending}
          <span className="sr-only">Envoi en cours</span>
        </div>
      )}
    </div>
  );
}

export function StaffWorking() {
  return (
    <div
      role="status"
      className="mx-auto flex w-full max-w-205 items-center gap-2 px-4 pb-4 text-meta text-muted sm:px-[clamp(20px,3vw,44px)]"
    >
      <PulseDot />
      {staff.coach.name} réfléchit…
    </div>
  );
}

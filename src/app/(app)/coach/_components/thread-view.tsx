"use client";

import { useId } from "react";
import { CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ContextChipLink } from "@/components/stride/context-chip";
import { MonoLabel } from "@/components/stride/mono-label";
import { PulseDot } from "@/components/stride/marks";
import { cn } from "@/lib/utils";
import {
  attachmentDate,
  attachmentHref,
  type SentAttachment,
} from "@/features/coach/attachments";
import { longWriteNote, workingLabel } from "@/features/coach/activity";
import { AttachmentIcon } from "@/features/coach/components/attachment-icon";
import { dayLabel, sameDay, timeLabel } from "@/features/coach/conversations";
import { StaffPortrait } from "@/features/coach/components/staff-portrait";
import { Markdown } from "@/features/coach/components/markdown";
import { useStaff } from "@/features/coach/components/staff-context";
import type { StaffAgent } from "@/features/coach/staff";
import {
  questionAttribution,
  replyToLabel,
  typingLabel,
  type ProposalCardStatus,
  type StaffBlock,
  type ThreadEntry,
} from "@/features/coach/thread";
import { ProposalLink } from "../../plan/_components/proposal-sheet";

function StaffName({ agent }: { agent: StaffAgent }) {
  const staff = useStaff();
  return (
    <span className="inline-flex items-center gap-1.5 text-meta font-semibold text-foreground">
      {staff[agent].name}
      <MonoLabel size="nano" className="font-normal">
        {staff[agent].role}
      </MonoLabel>
    </span>
  );
}

function QuestionCard({
  block,
  timeZone,
  onAnswer,
  onOther,
  disabled,
}: {
  block: Extract<StaffBlock, { type: "question" }>;
  timeZone: string;
  onAnswer: (text: string) => void;
  onOther: () => void;
  disabled: boolean;
}) {
  const staff = useStaff();
  const titleId = useId();
  const pending = block.state === "pending";
  return (
    <div
      role="group"
      aria-labelledby={titleId}
      className={cn(
        "flex flex-col gap-2.5 rounded-panel border bg-surface-panel px-3.5 py-3 sm:px-4 sm:py-3.5",
        pending ? "border-warning-border" : "border-border",
      )}
    >
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {pending ? (
          <span className="inline-flex items-center gap-1.5 text-warning">
            <PulseDot tone="warning" breathing={false} />
            {questionAttribution(staff[block.askedFor])}
          </span>
        ) : (
          <MonoLabel size="nano">
            {questionAttribution(staff[block.askedFor])}
          </MonoLabel>
        )}
        <span className="ml-auto inline-flex items-center gap-1.5">
          {block.state === "answered" ? (
            <>
              <CheckIcon aria-hidden="true" className="size-3 text-success" />
              Répondue
              {block.answeredAt &&
                ` · ${timeLabel(block.answeredAt, timeZone)}`}
            </>
          ) : block.state === "closed" ? (
            "Restée sans réponse"
          ) : null}
        </span>
      </div>
      <p id={titleId} className="text-body leading-snug font-medium">
        {block.question}
      </p>
      {block.options.length > 0 && (pending || block.answer) && (
        <div className="flex flex-wrap gap-1.5">
          {block.options.map((option) => {
            const chosen = block.answer === option;
            return (
              <Button
                key={option}
                type="button"
                variant="outline"
                size="sm"
                aria-pressed={chosen}
                disabled={!pending || disabled}
                onClick={() => onAnswer(option)}
                className={cn(
                  "h-auto min-h-9 rounded-full px-3 py-1.5 text-left text-meta font-normal whitespace-normal text-muted",
                  chosen &&
                    "border-staff-medical bg-surface-raised text-foreground disabled:opacity-100",
                )}
              >
                {chosen && <CheckIcon aria-hidden="true" className="size-3" />}
                {option}
              </Button>
            );
          })}
          {pending && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={onOther}
              className="min-h-9 rounded-full px-3 text-meta font-normal text-muted"
            >
              Autre…
            </Button>
          )}
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
  block: Extract<StaffBlock, { type: "proposal" }>;
}) {
  const staff = useStaff();
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

function StaffMessage({
  entry,
  timeZone,
  onAnswer,
  onOther,
  busy,
}: {
  entry: Extract<ThreadEntry, { type: "staff" }>;
  timeZone: string;
  onAnswer: (text: string) => void;
  onOther: () => void;
  busy: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 sm:grid sm:grid-cols-[36px_minmax(0,1fr)] sm:items-start sm:gap-3">
      <span className="max-sm:hidden">
        <StaffPortrait agent={entry.agent} size={36} decorative />
      </span>
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="sm:hidden">
            <StaffPortrait agent={entry.agent} size={28} decorative />
          </span>
          <StaffName agent={entry.agent} />
          <MonoLabel size="nano">{timeLabel(entry.at, timeZone)}</MonoLabel>
        </div>
        {entry.blocks.map((block, index) => {
          if (block.type === "text")
            return (
              <Markdown
                key={index}
                text={block.text}
                className="text-body leading-[1.55]"
              />
            );
          if (block.type === "question")
            return (
              <QuestionCard
                key={index}
                block={block}
                timeZone={timeZone}
                onAnswer={onAnswer}
                onOther={onOther}
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
        {entry.reads.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <MonoLabel size="nano">A lu</MonoLabel>
            {entry.reads.map((read) => (
              <span
                key={read}
                className="inline-flex items-center rounded-control border border-border-strong px-1.75 py-0.5 text-[11px] text-muted"
              >
                {read}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TypingMessage({
  entry,
}: {
  entry: Extract<ThreadEntry, { type: "typing" }>;
}) {
  const staff = useStaff();
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col gap-2 sm:grid sm:grid-cols-[36px_minmax(0,1fr)] sm:items-start sm:gap-3"
    >
      <span className="max-sm:hidden">
        <StaffPortrait agent={entry.agent} size={36} decorative />
      </span>
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="sm:hidden">
            <StaffPortrait agent={entry.agent} size={28} decorative />
          </span>
          <StaffName agent={entry.agent} />
        </div>
        <span className="inline-flex items-center gap-2.5 self-start rounded-[4px_16px_16px_16px] border border-border bg-surface px-3.5 py-2.5 text-meta text-muted">
          <span aria-hidden="true" className="inline-flex gap-1">
            {[0, 1, 2].map((dot) => (
              <span
                key={dot}
                className="size-1.25 rounded-full bg-staff-medical motion-safe:animate-pulse"
                style={{ animationDelay: `${dot * 300}ms` }}
              />
            ))}
          </span>
          {typingLabel(staff[entry.agent], entry.read)}
        </span>
      </div>
    </div>
  );
}

function SentChips({ attachments }: { attachments: SentAttachment[] }) {
  if (attachments.length === 0) return null;
  return (
    <ul
      aria-label="Contexte joint"
      className="mt-2.5 flex flex-wrap gap-1.5 whitespace-normal"
    >
      {attachments.map((attachment) => (
        <li
          key={`${attachment.kind}-${attachment.id}`}
          className="flex max-w-full"
        >
          <ContextChipLink
            href={attachmentHref(attachment)}
            icon={<AttachmentIcon kind={attachment.kind} />}
            label={attachment.title}
            meta={attachmentDate(attachment.date)}
          />
        </li>
      ))}
    </ul>
  );
}

function AthleteMessage({
  entry,
  timeZone,
}: {
  entry: Extract<ThreadEntry, { type: "athlete" }>;
  timeZone: string;
}) {
  const staff = useStaff();
  const target = entry.replyTo ?? entry.consult;
  return (
    <div className="flex max-w-[84%] flex-col items-end gap-1 self-end sm:max-w-[72%]">
      {target && (
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <StaffPortrait agent={target} size={16} decorative />
          {entry.replyTo
            ? replyToLabel(staff[target])
            : `@${staff[target].name}`}
        </span>
      )}
      <div className="rounded-[16px_16px_4px_16px] bg-surface-raised px-3.25 py-2.75 text-body leading-[1.45] whitespace-pre-wrap">
        {entry.text}
        <SentChips attachments={entry.attachments} />
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
  onOther,
}: {
  entries: ThreadEntry[];
  pending: { text: string; attachments: SentAttachment[] } | null;
  timeZone: string;
  now: Date;
  busy: boolean;
  onAnswer: (text: string) => void;
  onOther: () => void;
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
            ) : entry.type === "typing" ? (
              <TypingMessage entry={entry} />
            ) : (
              <StaffMessage
                entry={entry}
                timeZone={timeZone}
                onAnswer={onAnswer}
                onOther={onOther}
                busy={busy}
              />
            )}
          </div>
        );
      })}
      {pending && (
        <div className="flex max-w-[84%] flex-col self-end rounded-[16px_16px_4px_16px] bg-surface-raised px-3.25 py-2.75 text-body leading-[1.45] whitespace-pre-wrap opacity-70">
          {pending.text}
          <SentChips attachments={pending.attachments} />
          <span className="sr-only">Envoi en cours</span>
        </div>
      )}
    </div>
  );
}

export function StaffWorking({
  composingSince,
  now,
}: {
  composingSince: string | null;
  now: Date;
}) {
  const staff = useStaff();
  const label = workingLabel(staff.coach, composingSince, now);
  return (
    <div
      role="status"
      aria-live="polite"
      className="mx-auto flex w-full max-w-205 flex-col gap-2 px-4 pb-4 sm:grid sm:grid-cols-[36px_minmax(0,1fr)] sm:items-start sm:gap-3 sm:px-[clamp(20px,3vw,44px)]"
    >
      <span className="max-sm:hidden">
        <StaffPortrait agent="coach" size={36} decorative />
      </span>
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="sm:hidden">
            <StaffPortrait agent="coach" size={28} decorative />
          </span>
          <StaffName agent="coach" />
        </div>
        <span className="inline-flex flex-wrap items-center gap-2.5 self-start rounded-[4px_16px_16px_16px] border border-border bg-surface px-3.5 py-2.5 text-meta text-muted">
          <span aria-hidden="true" className="inline-flex gap-1">
            {[0, 1, 2].map((dot) => (
              <span
                key={dot}
                className="size-1.25 rounded-full bg-accent motion-safe:animate-pulse"
                style={{ animationDelay: `${dot * 300}ms` }}
              />
            ))}
          </span>
          {label.text}
          {label.since && <MonoLabel size="nano">{label.since}</MonoLabel>}
        </span>
        {label.writing && (
          <>
            <span
              aria-hidden="true"
              className="relative h-0.5 max-w-65 overflow-hidden rounded-full bg-border"
            >
              <span className="absolute inset-y-0 left-0 w-[30%] bg-linear-to-r from-transparent via-accent to-transparent motion-safe:animate-trace motion-reduce:hidden" />
            </span>
            <p className="max-w-115 text-meta leading-normal text-muted-foreground">
              {longWriteNote}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

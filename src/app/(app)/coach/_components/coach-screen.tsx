"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ListIcon,
  PlusIcon,
} from "lucide-react";
import { DataActivityLink as Link } from "@/features/data-activity/components/navigation";
import { AppHeader } from "@/features/app-shell/components/app-header";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Toggle } from "@/components/ui/toggle";
import { ContextChip } from "@/components/stride/context-chip";
import { SuggestedReplies } from "@/components/stride/suggested-reply";
import { MonoLabel } from "@/components/stride/mono-label";
import { cn } from "@/lib/utils";
import { localToday } from "@/features/app-shell/shell";
import {
  attachmentDate,
  attachmentRefs,
  toggleAttachment,
  type AttachmentOption,
  type AttachmentOptions,
  type SentAttachment,
} from "@/features/coach/attachments";
import { AttachmentIcon } from "@/features/coach/components/attachment-icon";
import {
  closedStates,
  conversationSections,
  participantsLine,
  threadParticipants,
  threadPreview,
  threadStatus,
  threadTitle,
  timeLabel,
  type ConversationSummary,
  type SessionState,
} from "@/features/coach/conversations";
import type { ThreadItem } from "@/features/coach/items";
import {
  StaffPortrait,
  StaffStack,
} from "@/features/coach/components/staff-portrait";
import { useStaff } from "@/features/coach/components/staff-context";
import { staffAgents } from "@/features/coach/staff";
import { refusalText, splitFrames, turnFailure } from "@/features/coach/stream";
import { suggestedReplies } from "@/features/coach/suggested-replies";
import { buildThread } from "@/features/coach/thread";
import { markCoachThreadRead } from "@/server/coaching/actions";
import { ContextPicker } from "./context-picker";
import { ConversationList } from "./conversation-list";
import { SuiviPanel } from "./suivi-panel";
import { ThreadMenu } from "./thread-menu";
import { StaffWorking, ThreadLog } from "./thread-view";

export type CoachThreadProps = {
  id: string;
  managedSessionId: string;
  mode: "conversation" | "plan";
  title: string;
  state: SessionState;
  pendingToolUseId: string | null;
  lastTurnAt: string | null;
  composingSince: string | null;
  createdAt: string;
  items: ThreadItem[];
  proposalStatuses: Record<string, string>;
};

type Live = {
  base: ThreadItem[];
  items: ThreadItem[];
};

function mergeLive(live: Live, base: ThreadItem[]): Live {
  if (live.base === base) return live;
  const grown = base.length - live.base.length;
  return {
    base,
    items:
      grown >= live.items.length ? [] : live.items.slice(Math.max(0, grown)),
  };
}

function Composer({
  placeholder,
  answering,
  busy,
  closed,
  initialText,
  replies,
  options,
  today,
  onSend,
}: {
  placeholder: string;
  answering: boolean;
  busy: boolean;
  closed: boolean;
  initialText: string;
  replies: readonly string[];
  options: AttachmentOptions;
  today: string;
  onSend: (
    text: string,
    consult: boolean,
    attachments: SentAttachment[],
  ) => Promise<boolean>;
}) {
  const staff = useStaff();
  const [text, setText] = useState(initialText);
  const [consult, setConsult] = useState(false);
  const [attachments, setAttachments] = useState<AttachmentOption[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const contextTrigger = useRef<HTMLButtonElement>(null);

  async function submit() {
    const message = text.trim();
    if (!message || busy) return;
    const attached = answering ? [] : attachments;
    setText("");
    if (!answering) setAttachments([]);
    const sent = await onSend(message, consult && !answering, attached);
    if (sent) setConsult(false);
    else {
      setText(message);
      if (!answering) setAttachments(attached);
    }
  }

  async function reply(message: string) {
    if (busy) return;
    const sent = await onSend(message, false, []);
    if (!sent) setText((current) => (current.trim() ? current : message));
  }

  function remove(option: AttachmentOption) {
    setAttachments((current) => toggleAttachment(current, option));
    input.current?.focus();
  }

  if (closed)
    return (
      <div className="mx-auto flex w-full max-w-205 flex-col gap-2 border-t border-border-subtle px-4 py-4 sm:px-[clamp(20px,3vw,44px)]">
        <p className="text-sm text-muted">
          Cette conversation est terminée. Démarre une nouvelle conversation
          pour continuer.
        </p>
        <Button asChild variant="outline" size="md" className="self-start">
          <Link href="/coach/nouvelle">Nouvelle conversation</Link>
        </Button>
      </div>
    );

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      className="mx-auto flex w-full max-w-205 flex-col gap-2.5 border-t border-border-subtle bg-surface-inset px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-[clamp(20px,3vw,44px)] sm:pb-5"
    >
      <SuggestedReplies
        replies={replies}
        onSelect={(message) => void reply(message)}
        className="max-sm:-mx-4 max-sm:px-4"
      />
      <InputGroup className="h-auto flex-wrap rounded-card border-border-strong bg-surface p-1.5 has-[>[data-align=block-start]]:flex-row md:h-auto">
        {!answering && attachments.length > 0 && (
          <InputGroupAddon
            align="block-start"
            className="cursor-default px-0.5 pt-0.5 pb-1"
          >
            <ul
              aria-label="Contexte joint au message"
              className="flex min-w-0 gap-1.5 max-md:overflow-x-auto md:flex-wrap"
            >
              {attachments.map((option) => (
                <li
                  key={`${option.kind}-${option.id}`}
                  className="flex max-w-full shrink-0"
                >
                  <ContextChip
                    icon={<AttachmentIcon kind={option.kind} />}
                    label={option.title}
                    meta={attachmentDate(option.date)}
                    removeLabel={`Retirer ${option.title} du contexte`}
                    onRemove={() => remove(option)}
                    disabled={busy}
                  />
                </li>
              ))}
            </ul>
          </InputGroupAddon>
        )}
        {!answering && (
          <InputGroupAddon align="inline-start" className="self-end pl-0">
            <Button
              ref={contextTrigger}
              type="button"
              variant="ghost"
              aria-label="Ajouter du contexte : séance, activité ou course"
              aria-haspopup="dialog"
              aria-expanded={pickerOpen}
              disabled={busy}
              onClick={() => setPickerOpen(true)}
              className="size-11 rounded-surface p-0 text-muted md:h-9 md:w-auto md:border md:border-border md:px-2.5 md:text-meta md:font-normal"
            >
              <PlusIcon aria-hidden="true" />
              <span aria-hidden="true" className="max-md:hidden">
                Contexte
              </span>
            </Button>
          </InputGroupAddon>
        )}
        <InputGroupTextarea
          ref={input}
          id="coach-composer"
          aria-label={answering ? "Ta réponse au staff" : "Écrire au staff"}
          placeholder={placeholder}
          rows={1}
          value={text}
          maxLength={2000}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              void submit();
            }
          }}
          className="max-h-40 min-h-10 min-w-0 flex-1 basis-0 py-2.5 text-body"
        />
        <InputGroupAddon align="inline-end" className="gap-1.5 self-end pr-0">
          {!answering && (
            <Toggle
              variant="choice"
              pressed={consult}
              onPressedChange={setConsult}
              aria-label={`Mentionner ${staff.medical.name}`}
              disabled={busy}
              className="min-h-9 gap-1.5 rounded-control border-border bg-transparent pr-2 pl-1.5 text-meta font-normal data-[state=on]:border-foreground data-[state=on]:bg-surface-raised data-[state=on]:font-semibold data-[state=on]:text-foreground"
            >
              <StaffStack agents={["medical"]} size={18} />@{staff.medical.name}
            </Toggle>
          )}
          <Button
            type="submit"
            size="icon"
            aria-label="Envoyer"
            disabled={busy || !text.trim()}
            className="size-9.5 rounded-surface"
          >
            <ArrowUpIcon aria-hidden="true" />
          </Button>
        </InputGroupAddon>
      </InputGroup>
      {!answering && (
        <ContextPicker
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          options={options}
          selected={attachments}
          today={today}
          returnFocus={contextTrigger}
          onToggle={(option) =>
            setAttachments((current) => toggleAttachment(current, option))
          }
        />
      )}
      <p className="text-xs text-muted-foreground max-sm:hidden">
        {staff.coach.name} lit chaque message et passe la main au bon
        spécialiste, deux au plus par demande. Les questions d’un spécialiste
        lui reviennent directement. Rien ne change sans ton accord.
      </p>
    </form>
  );
}

export function CoachScreen({
  conversations,
  thread,
  current,
  draft,
  now: nowIso,
  timeZone,
  attachmentOptions,
}: {
  conversations: ConversationSummary[];
  thread: CoachThreadProps | null;
  current: boolean;
  draft: { mode: "conversation" | "plan"; text: string };
  now: string;
  timeZone: string;
  attachmentOptions: AttachmentOptions;
}) {
  const staff = useStaff();
  const router = useRouter();
  const now = useMemo(() => new Date(nowIso), [nowIso]);
  const baseItems = useMemo(() => thread?.items ?? [], [thread]);
  const [liveState, setLive] = useState<Live>({ base: baseItems, items: [] });
  const live = mergeLive(liveState, baseItems);
  if (live !== liveState) setLive(live);
  const [ids, setIds] = useState(() => ({
    threadId: thread?.id ?? null,
    sessionId: thread?.managedSessionId ?? null,
  }));
  const [state, setState] = useState<SessionState | null>(
    thread?.state ?? null,
  );
  const [pendingQuestion, setPendingQuestion] = useState(
    thread?.pendingToolUseId ?? null,
  );
  const [lastTurnAt, setLastTurnAt] = useState(thread?.lastTurnAt ?? null);
  const [composingSince, setComposingSince] = useState(
    thread?.composingSince ?? null,
  );
  const [busy, setBusy] = useState(false);
  const [syncedThread, setSyncedThread] = useState(thread);
  if (syncedThread !== thread) {
    setSyncedThread(thread);
    if (thread && !busy) {
      setState(thread.state);
      setPendingQuestion(thread.pendingToolUseId);
      setLastTurnAt(thread.lastTurnAt);
      setComposingSince(thread.composingSince);
    }
  }
  const [clock, setClock] = useState(now);
  const [sending, setSending] = useState<{
    text: string;
    attachments: SentAttachment[];
  } | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [suiviOpen, setSuiviOpen] = useState(false);
  const logEnd = useRef<HTMLDivElement>(null);

  const items = useMemo(
    () => [...live.base, ...live.items],
    [live.base, live.items],
  );
  const mode = thread?.mode ?? draft.mode;
  const proposalStatuses = useMemo(
    () => thread?.proposalStatuses ?? {},
    [thread],
  );
  const status =
    state === null
      ? null
      : threadStatus({
          state: busy ? "running" : state,
          lastTurnAt: busy ? new Date().toISOString() : lastTurnAt,
          now: busy ? new Date() : clock,
          proposalStatuses: Object.values(proposalStatuses).concat(
            items.flatMap((item) =>
              item.kind === "proposal" && !(item.proposalId in proposalStatuses)
                ? ["ready"]
                : [],
            ),
          ),
        });
  const resumed = !busy && status === "working";
  const working = busy || resumed;
  const entries = useMemo(
    () =>
      buildThread({
        items,
        live: working,
        pendingToolUseId: pendingQuestion,
        proposalStatuses,
      }),
    [items, working, pendingQuestion, proposalStatuses],
  );
  const closed = state !== null && closedStates.includes(state);
  const participants = threadParticipants(items);
  const title =
    thread?.title ??
    (items[0]?.kind === "athlete"
      ? threadTitle(items[0].text)
      : "Nouvelle conversation");
  const startedAt = thread?.createdAt ?? items[0]?.at ?? null;

  const sections = useMemo(() => {
    const merged = conversations.filter(
      (conversation) => conversation.id !== ids.threadId,
    );
    const original = conversations.find(
      (conversation) => conversation.id === ids.threadId,
    );
    if (ids.threadId && state)
      merged.push({
        id: ids.threadId,
        title,
        lastActivityAt: items.at(-1)?.at ?? original?.lastActivityAt ?? nowIso,
        readAt: items.at(-1)?.at ?? nowIso,
        state: busy ? "running" : state,
        lastTurnAt: busy ? nowIso : lastTurnAt,
        preview: threadPreview(staff, items),
        participants,
        proposalStatuses: original?.proposalStatuses ?? [],
      });
    return conversationSections(merged, now, timeZone);
  }, [
    conversations,
    staff,
    ids.threadId,
    state,
    title,
    items,
    busy,
    lastTurnAt,
    participants,
    now,
    nowIso,
    timeZone,
  ]);

  const threadId = thread?.id ?? null;
  useEffect(() => {
    if (threadId) void markCoachThreadRead({ threadId });
  }, [threadId]);

  useEffect(() => {
    logEnd.current?.scrollIntoView({ block: "end" });
  }, [items.length, sending]);

  useEffect(() => {
    if (!working) return;
    const tick = window.setInterval(() => setClock(new Date()), 5_000);
    return () => window.clearInterval(tick);
  }, [working]);

  useEffect(() => {
    if (!resumed) return;
    const poll = window.setInterval(() => router.refresh(), 4_000);
    return () => window.clearInterval(poll);
  }, [resumed, router]);

  async function send(
    text: string,
    consult: boolean,
    attachments: SentAttachment[] = [],
  ) {
    if (working) return false;
    const answering = pendingQuestion;
    setFailure(null);
    setComposingSince(null);
    setBusy(true);
    setSending({
      text,
      attachments: attachments.map(({ kind, id, title, date }) => ({
        kind,
        id,
        title,
        date,
      })),
    });
    let sent = false;
    let started = false;
    let threadKnown = Boolean(thread);
    let currentThread = ids.threadId;
    let turnError: string | null = null;
    let errorShown = false;
    let finished = false;
    try {
      const response = await fetch("/api/coach/turns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(ids.sessionId ? { sessionId: ids.sessionId } : {}),
          mode,
          input: answering
            ? { kind: "answer", toolUseId: answering, text }
            : {
                kind: "message",
                text,
                ...(consult ? { consult: "medical" } : {}),
                ...(attachments.length
                  ? { attachments: attachmentRefs(attachments) }
                  : {}),
              },
        }),
      });
      if (!response.ok) {
        const data: unknown = await response.json().catch(() => null);
        setFailure(
          refusalText(
            data && typeof data === "object" && "code" in data
              ? data.code
              : null,
          ),
        );
        setSending(null);
      } else {
        sent = true;
        const reader = response.body
          ?.pipeThrough(new TextDecoderStream())
          .getReader();
        let buffer = "";
        while (reader) {
          const { value, done } = await reader.read();
          if (done) break;
          const { events, rest } = splitFrames(buffer + value);
          buffer = rest;
          for (const event of events) {
            if (event.type === "session") {
              started = true;
              currentThread = event.threadId;
              setIds({ threadId: event.threadId, sessionId: event.sessionId });
              setState("running");
              setLastTurnAt(new Date().toISOString());
              if (!threadKnown) {
                threadKnown = true;
                window.history.replaceState(
                  null,
                  "",
                  `/coach/${event.threadId}`,
                );
              }
            }
            if (event.type === "item") {
              if (event.item.kind === "athlete" || event.item.kind === "answer")
                setSending(null);
              if (event.item.kind === "answer") setPendingQuestion(null);
              if (event.item.kind === "error") errorShown = true;
              setLive((current) => ({
                ...current,
                items: [...current.items, event.item],
              }));
            }
            if (event.type === "question") setPendingQuestion(event.toolUseId);
            if (event.type === "composing") setComposingSince(event.since);
            if (event.type === "error") turnError = event.text;
            if (event.type === "done") {
              finished = true;
              setState(event.status as SessionState);
              if (event.status !== "awaiting_athlete") setPendingQuestion(null);
            }
          }
        }
      }
    } catch {
      if (!started) setFailure(turnFailure);
    } finally {
      if (turnError && !errorShown) setFailure(turnError);
      if (finished) setComposingSince(null);
      setSending(null);
      setBusy(false);
    }
    if (sent && currentThread) {
      void markCoachThreadRead({ threadId: currentThread });
      if (thread) router.refresh();
    }
    return sent;
  }

  const answeringAgent = pendingQuestion
    ? ([...items]
        .reverse()
        .find(
          (item): item is Extract<ThreadItem, { kind: "question" }> =>
            item.kind === "question" && item.toolUseId === pendingQuestion,
        )?.askedFor ?? "coach")
    : null;
  const placeholder = answeringAgent
    ? `Ta réponse à ${staff[answeringAgent].name}…`
    : "Écris au staff…";
  const empty = items.length === 0 && !sending;
  const replies = suggestedReplies({
    mode,
    busy: working,
    closed,
    questionPending: pendingQuestion !== null,
    status,
    items,
  });

  const suivi = (
    <SuiviPanel
      items={items}
      status={status}
      pendingToolUseId={pendingQuestion}
      proposalStatuses={proposalStatuses}
      timeZone={timeZone}
    />
  );

  return (
    <>
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
          <ConversationList
            sections={sections}
            currentId={ids.threadId}
            mobileHeader={
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
                    <Link
                      href="/coach/nouvelle"
                      aria-label="Nouvelle conversation"
                    >
                      <PlusIcon aria-hidden="true" />
                    </Link>
                  </Button>
                  <SidebarTrigger
                    aria-label="Afficher ou masquer la barre latérale"
                    className="-mr-2 size-11"
                  />
                </div>
                <section
                  aria-label="Ton staff"
                  className="flex flex-col gap-2.5"
                >
                  <div className="flex items-baseline">
                    <MonoLabel size="nano">Ton staff</MonoLabel>
                    <Link
                      href="/coach/equipe"
                      className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted hover:text-foreground"
                    >
                      Voir l’équipe
                      <ChevronRightIcon
                        aria-hidden="true"
                        className="size-2.5"
                      />
                    </Link>
                  </div>
                  <div className="flex gap-3">
                    {staffAgents.map((agent) => (
                      <Link
                        key={agent}
                        href="/coach/equipe"
                        aria-label={`${staff[agent].alt}, voir l’équipe`}
                        className="flex w-15.5 flex-col items-center gap-1.5 text-xs text-muted hover:text-foreground"
                      >
                        <StaffPortrait agent={agent} size={56} decorative />
                        <span aria-hidden="true">{staff[agent].name}</span>
                      </Link>
                    ))}
                  </div>
                </section>
              </div>
            }
          />
        </div>
        <section
          aria-label={title}
          className={cn(
            "min-h-0 min-w-0 flex-[999_1_520px] flex-col min-[980px]:flex",
            current ? "flex" : "hidden",
          )}
        >
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
            <StaffStack agents={participants} size={30} />
            <span className="flex min-w-0 flex-1 flex-col">
              <h1 className="truncate text-body font-semibold">
                {empty && !thread ? "Nouvelle conversation" : title}
              </h1>
              <span className="truncate text-xs text-muted-foreground">
                {participantsLine(staff, participants)}
                {startedAt &&
                  !empty &&
                  ` · commencé à ${timeLabel(startedAt, timeZone)}`}
              </span>
            </span>
            {!empty && (
              <Button
                variant="outline"
                size="icon"
                aria-label="Suivi de la conversation"
                onClick={() => setSuiviOpen(true)}
                className="size-11 rounded-surface min-[980px]:size-8.5 min-[1180px]:hidden"
              >
                <ListIcon aria-hidden="true" />
              </Button>
            )}
            {ids.threadId && state !== null && (
              <ThreadMenu
                threadId={ids.threadId}
                busy={working}
                onFailure={setFailure}
              />
            )}
          </div>
          <div className="min-h-0 flex-1 [scrollbar-gutter:stable] overflow-y-auto overscroll-contain">
            {empty ? (
              <div className="mx-auto flex w-full max-w-205 flex-col gap-4 px-4 pt-8 sm:px-[clamp(20px,3vw,44px)] sm:pt-12">
                <StaffPortrait agent="coach" size={56} />
                <h2 className="text-headline font-semibold">
                  {mode === "plan"
                    ? `Demande ton plan à ${staff.coach.name}`
                    : "Écris à ton staff"}
                </h2>
                <p className="max-w-140 text-body leading-normal text-muted">
                  {mode === "plan"
                    ? `${staff.coach.name} construit ton plan à partir de tes objectifs, de tes disponibilités et de ton historique, puis te le propose. Rien n’est enregistré sans ton accord.`
                    : `Pose ta question sur ton entraînement, ta récupération ou une douleur. ${staff.coach.name} te répond ou passe la main à ${staff.medical.name}, qui te parle directement quand c’est utile.`}
                </p>
              </div>
            ) : (
              <ThreadLog
                entries={entries}
                pending={sending}
                timeZone={timeZone}
                now={now}
                busy={working}
                onAnswer={(answer) => void send(answer, false)}
                onOther={() =>
                  document.getElementById("coach-composer")?.focus()
                }
              />
            )}
            {working && !entries.some((entry) => entry.type === "typing") && (
              <StaffWorking composingSince={composingSince} now={clock} />
            )}
            {failure && (
              <p
                role="alert"
                className="mx-auto w-full max-w-205 px-4 pb-4 text-sm text-danger sm:px-[clamp(20px,3vw,44px)]"
              >
                {failure}
              </p>
            )}
            <div ref={logEnd} />
          </div>
          <Composer
            key={ids.threadId ?? "new"}
            placeholder={placeholder}
            answering={pendingQuestion !== null}
            busy={working}
            closed={closed}
            initialText={thread ? "" : draft.text}
            replies={replies}
            options={attachmentOptions}
            today={localToday(now)}
            onSend={send}
          />
        </section>
        {!empty && (
          <aside
            aria-label="Suivi de la conversation"
            className="hidden w-85 shrink-0 overflow-y-auto border-l border-border-subtle px-5.5 pt-5.5 pb-7 min-[1180px]:block"
          >
            {suivi}
          </aside>
        )}
      </div>
      <Sheet open={suiviOpen} onOpenChange={setSuiviOpen}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          aria-describedby={undefined}
          className="max-h-[85svh] gap-0 overflow-hidden border-border-strong bg-surface-panel min-[640px]:inset-x-auto min-[640px]:right-2 min-[640px]:bottom-2 min-[640px]:w-100 min-[640px]:rounded-panel min-[640px]:border"
        >
          <div className="flex items-center gap-2 border-b border-border-subtle px-4 py-3">
            <SheetTitle className="text-sm font-semibold">
              Suivi de la conversation
            </SheetTitle>
            <SheetClose asChild>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto min-h-11 text-muted"
              >
                Fermer
              </Button>
            </SheetClose>
          </div>
          <div className="min-h-0 overflow-y-auto overscroll-contain px-4 pt-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            {suivi}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

import "server-only";
import { displayTimeZone } from "@/features/app-shell/shell";
import {
  threadParticipants,
  threadPreview,
  type ConversationSummary,
} from "@/features/coach/conversations";
import type { ThreadItem } from "@/features/coach/items";
import { staffOf } from "@/features/coach/staff";
import type { OnboardingContext } from "@/server/onboarding/context";
import {
  findOwnThread,
  listOwnThreads,
  readConsultRequests,
  readThreadItems,
  readThreadProposalStatuses,
  type CoachSessionRecord,
} from "./managed/store";
import { readStaffFaces } from "./staff";

export const coachTimeZone = displayTimeZone;

const previewItems = 20;

export type CoachThreadData = {
  id: string;
  managedSessionId: string;
  mode: CoachSessionRecord["mode"];
  title: string;
  state: CoachSessionRecord["status"];
  pendingToolUseId: string | null;
  lastTurnAt: string | null;
  composingSince: string | null;
  createdAt: string;
  readAt: string | null;
  lastActivityAt: string;
  items: ThreadItem[];
  proposalStatuses: Record<string, string>;
};

export async function loadConversations(
  context: OnboardingContext,
): Promise<ConversationSummary[]> {
  const threads = await listOwnThreads(context);
  const ids = threads.map((thread) => thread.id);
  const [latest, consults, proposals, faces] = await Promise.all([
    Promise.all(
      threads.map((thread) =>
        readThreadItems(context, thread.id, previewItems),
      ),
    ),
    readConsultRequests(context, ids),
    readThreadProposalStatuses(context, ids),
    readStaffFaces(context),
  ]);
  const staff = staffOf(faces);
  return threads.flatMap((thread, index) => {
    const threadItems = latest[index];
    if (!visibleThread(thread.title, threadItems)) return [];
    return {
      id: thread.id,
      title: thread.title ?? "Conversation",
      lastActivityAt: thread.lastActivityAt,
      readAt: thread.readAt,
      state: thread.status,
      lastTurnAt: thread.lastTurnAt,
      preview: threadPreview(staff, threadItems),
      participants: threadParticipants([
        ...(consults.get(thread.id) ?? []),
        ...threadItems,
      ]),
      proposalStatuses: Object.values(proposals.get(thread.id) ?? {}),
    };
  });
}

function visibleThread(title: string | null, items: readonly ThreadItem[]) {
  return title !== null || items.length > 0;
}

export async function loadThread(
  context: OnboardingContext,
  threadId: string,
): Promise<CoachThreadData | null> {
  const thread = await findOwnThread(context, threadId);
  if (!thread) return null;
  const [items, proposals] = await Promise.all([
    readThreadItems(context, thread.id),
    readThreadProposalStatuses(context, [thread.id]),
  ]);
  if (!visibleThread(thread.title, items)) return null;
  return {
    id: thread.id,
    managedSessionId: thread.managedSessionId,
    mode: thread.mode,
    title: thread.title ?? "Conversation",
    state: thread.status,
    pendingToolUseId: thread.pendingToolUseId,
    lastTurnAt: thread.lastTurnAt,
    composingSince: thread.composingSince,
    createdAt: thread.createdAt,
    readAt: thread.readAt,
    lastActivityAt: thread.lastActivityAt,
    items,
    proposalStatuses: proposals.get(thread.id) ?? {},
  };
}

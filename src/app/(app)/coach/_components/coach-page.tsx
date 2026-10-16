import { notFound } from "next/navigation";
import { requireAthlete } from "@/server/app/session";
import {
  coachTimeZone,
  loadConversations,
  loadThread,
} from "@/server/coaching/threads";
import { CoachScreen } from "./coach-screen";

const planRequest = "Construis-moi un plan d’entraînement pour mon objectif.";

export async function CoachPage({
  threadId = null,
  current,
  request = null,
}: {
  threadId?: string | null;
  current: boolean;
  request?: string | null;
}) {
  const context = await requireAthlete();
  const [conversations, thread] = await Promise.all([
    loadConversations(context),
    threadId ? loadThread(context, threadId) : null,
  ]);
  if (threadId && !thread) notFound();
  const plan = request === "plan";
  return (
    <CoachScreen
      key={thread?.id ?? "new"}
      conversations={conversations}
      thread={thread}
      current={current}
      draft={{
        mode: plan ? "plan" : "conversation",
        text: plan ? planRequest : "",
      }}
      now={new Date().toISOString()}
      timeZone={coachTimeZone}
    />
  );
}

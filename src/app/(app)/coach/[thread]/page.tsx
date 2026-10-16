import type { Metadata } from "next";
import { CoachPage } from "../_components/coach-page";

export const metadata: Metadata = { title: "Conversation · Coach" };

export default async function CoachThreadPage({
  params,
}: {
  params: Promise<{ thread: string }>;
}) {
  const { thread } = await params;
  return <CoachPage threadId={thread} current />;
}

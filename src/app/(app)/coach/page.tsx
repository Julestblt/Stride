import type { Metadata } from "next";
import { CoachPage } from "./_components/coach-page";

export const metadata: Metadata = { title: "Conversations · Coach" };

export default function CoachConversationsPage() {
  return <CoachPage current={false} />;
}

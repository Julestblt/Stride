import type { Metadata } from "next";
import { parseRequestText } from "@/features/coach/request";
import { CoachPage } from "../_components/coach-page";

export const metadata: Metadata = { title: "Nouvelle conversation · Coach" };

export default async function NewCoachConversationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { demande, seance, texte } = await searchParams;
  return (
    <CoachPage
      current
      request={typeof demande === "string" ? demande : null}
      sessionKey={typeof seance === "string" ? seance : null}
      text={parseRequestText(texte)}
    />
  );
}

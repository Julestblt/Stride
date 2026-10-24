import type { Metadata } from "next";
import { getShellIdentity } from "@/server/app/shell";
import { requireAthlete } from "@/server/app/session";
import { loadStaffUsage } from "@/server/coaching/staff";
import { TeamScreen } from "../_components/team-screen";

export const metadata: Metadata = { title: "Équipe · Coach" };

export default async function CoachTeamPage() {
  const context = await requireAthlete();
  const [shell, usage] = await Promise.all([
    getShellIdentity(),
    loadStaffUsage(context, new Date()),
  ]);
  return <TeamScreen usage={usage} initials={shell.athlete.initials} />;
}

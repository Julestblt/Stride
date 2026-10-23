import { redirect } from "next/navigation";
import { requireAthlete } from "@/server/app/session";
import { getCurrentUser } from "@/server/auth/session";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (!(await getCurrentUser())) redirect("/sign-in");
  await requireAthlete();
  redirect("/today");
}

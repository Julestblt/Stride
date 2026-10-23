import { redirect } from "next/navigation";
import { requireAthlete } from "@/server/app/session";
import { getCurrentUser } from "@/server/auth/session";

export default async function Home() {
  if (!(await getCurrentUser())) redirect("/sign-in");
  await requireAthlete();
  redirect("/today");
}

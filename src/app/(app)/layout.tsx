import { cookies } from "next/headers";
import { AppShell } from "@/features/app-shell/components/app-shell";
import { getShell } from "@/server/app/shell";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [shell, cookieStore] = await Promise.all([getShell(), cookies()]);
  return (
    <AppShell
      {...shell}
      defaultOpen={cookieStore.get("sidebar_state")?.value !== "false"}
    >
      {children}
    </AppShell>
  );
}

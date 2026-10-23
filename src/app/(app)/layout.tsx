import { cookies } from "next/headers";
import { AppShell } from "@/features/app-shell/components/app-shell";
import {
  getShellIdentity,
  getShellNavigation,
  getShellNotifications,
} from "@/server/app/shell";
import { requireAthlete } from "@/server/app/session";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAthlete();
  const navigation = getShellNavigation();
  const notifications = getShellNotifications();
  const [identity, cookieStore] = await Promise.all([
    getShellIdentity(),
    cookies(),
  ]);
  return (
    <AppShell
      {...identity}
      navigation={navigation}
      notifications={notifications}
      notificationsAt={new Date().toISOString()}
      defaultOpen={cookieStore.get("sidebar_state")?.value !== "false"}
    >
      {children}
    </AppShell>
  );
}

import { DataActivityProvider } from "@/features/data-activity/components/provider";
import { StaffProvider } from "@/features/coach/components/staff-context";
import { NotificationsProvider } from "@/features/notifications/components/notifications-context";
import { SettingsShell } from "@/features/settings/components/settings-shell";
import { getShellIdentity, getShellNotifications } from "@/server/app/shell";
import { requireAthlete } from "@/server/app/session";

export const dynamic = "force-dynamic";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAthlete();
  const notifications = getShellNotifications();
  const identity = await getShellIdentity();
  return (
    <StaffProvider faces={identity.staffFaces}>
      <NotificationsProvider
        feed={notifications}
        now={new Date().toISOString()}
      >
        <DataActivityProvider>
          <SettingsShell athlete={identity.athlete}>{children}</SettingsShell>
        </DataActivityProvider>
      </NotificationsProvider>
    </StaffProvider>
  );
}

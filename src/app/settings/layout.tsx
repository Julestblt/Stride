import { DataActivityProvider } from "@/features/data-activity/components/provider";
import { StaffProvider } from "@/features/coach/components/staff-context";
import { NotificationsProvider } from "@/features/notifications/components/notifications-context";
import { SettingsShell } from "@/features/settings/components/settings-shell";
import { getShell } from "@/server/app/shell";

export const dynamic = "force-dynamic";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const shell = await getShell();
  return (
    <StaffProvider faces={shell.staffFaces}>
      <NotificationsProvider
        feed={shell.notifications}
        now={shell.notificationsAt}
      >
        <DataActivityProvider initial={shell.initialActivity}>
          <SettingsShell athlete={shell.athlete}>{children}</SettingsShell>
        </DataActivityProvider>
      </NotificationsProvider>
    </StaffProvider>
  );
}

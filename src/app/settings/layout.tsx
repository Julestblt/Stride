import { DataActivityProvider } from "@/features/data-activity/components/provider";
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
    <DataActivityProvider initial={shell.initialActivity}>
      <SettingsShell athlete={shell.athlete}>{children}</SettingsShell>
    </DataActivityProvider>
  );
}

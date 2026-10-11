import { SettingsShell } from "@/features/settings/components/settings-shell";
import { getShell } from "@/server/app/shell";

export const dynamic = "force-dynamic";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const shell = await getShell();
  return <SettingsShell athlete={shell.athlete}>{children}</SettingsShell>;
}

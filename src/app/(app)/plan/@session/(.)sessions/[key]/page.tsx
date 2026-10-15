import { requireAthlete } from "@/server/app/session";
import { loadSessionPanel } from "@/server/plans/session-panel";
import { SessionSheet } from "../../../_components/session-sheet";

export default async function SessionPanelPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const [context, { key }] = await Promise.all([requireAthlete(), params]);
  const panel = await loadSessionPanel(context, key);
  if (!panel) return null;
  return <SessionSheet key={panel.sessionKey} panel={panel} />;
}

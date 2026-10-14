import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { mondayOf } from "@/features/plans/model/dates";
import { formatLongDay } from "@/features/plans/view/format";
import { weekPosition } from "@/features/plans/view/plan-view";
import { requireAthlete } from "@/server/app/session";
import { loadPlanDraft } from "@/server/plans/draft";
import { DraftBanner, PlanFrame } from "../../_components/plan-frame";
import {
  SessionDetail,
  WeekSessionsAside,
} from "../../_components/session-detail";
import { weekHref } from "../../_components/week-view";

export const metadata: Metadata = { title: "Séance · Plan" };

export default async function PlanSessionPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const [context, { key }] = await Promise.all([requireAthlete(), params]);
  const { plan } = await loadPlanDraft(context);
  if (plan.status !== "ready") notFound();
  const session = plan.state.sessions.find((item) => item.sessionKey === key);
  if (!session) notFound();
  const weekStart = mondayOf(session.scheduledOn);
  const position = weekPosition(plan.state, weekStart);
  return (
    <PlanFrame
      crumbs={[
        { label: "Plan", href: "/plan" },
        { label: `Semaine ${position.number}`, href: weekHref(weekStart) },
        { label: `${formatLongDay(session.scheduledOn)} · ${session.title}` },
      ]}
    >
      <DraftBanner />
      <div className="grid gap-10 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <WeekSessionsAside
          state={plan.state}
          weekStart={weekStart}
          report={plan.report}
          selected={key}
          className="max-lg:hidden lg:sticky lg:top-0 lg:self-start"
        />
        <SessionDetail
          session={session}
          block={position.block}
          weekNumber={position.number}
          weekStart={weekStart}
          targets={plan.targets}
        />
      </div>
    </PlanFrame>
  );
}

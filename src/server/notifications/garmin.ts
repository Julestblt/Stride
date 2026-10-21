import "server-only";
import { after } from "next/server";
import { pairQuestions } from "@/features/gear/check-view";
import type { PairChecks } from "@/server/gear/checks";
import { tokenContext } from "@/server/garmin/watch";
import type { OnboardingContext } from "@/server/onboarding/context";

type Mismatch = {
  activityId: string;
  sessionTitle: string | null;
  day: string | null;
  garmin: string;
  planned: string;
};

function gearMismatches(pairs: PairChecks): Mismatch[] {
  return pairQuestions(pairs.checks.values(), pairs.shoes).map((question) => {
    const check = pairs.checks.get(question.activityId);
    return {
      activityId: question.activityId,
      sessionTitle: check?.sessionTitle ?? null,
      day: check?.day ?? null,
      garmin: question.garmin.name,
      planned: question.planned.name,
    };
  });
}

async function reconcile(
  context: OnboardingContext,
  mismatches: Mismatch[] | null,
) {
  try {
    const { error } = await context.client.rpc(
      "reconcile_garmin_notifications",
      { p_gear_mismatches: mismatches },
    );
    if (error) throw new Error(error.message);
  } catch (error) {
    console.error("Garmin notifications were not reconciled", {
      message: error instanceof Error ? error.message : "unknown",
    });
  }
}

function reconcileAfterResponse(
  context: OnboardingContext,
  mismatches: Mismatch[] | null,
) {
  let detached: OnboardingContext;
  try {
    detached = { ...context, ...tokenContext(context) };
  } catch {
    return;
  }
  after(() => reconcile(detached, mismatches));
}

export function reconcileGarminNotificationsAfterResponse(
  context: OnboardingContext,
) {
  reconcileAfterResponse(context, null);
}

export function reconcileGearNotificationsAfterResponse(
  context: OnboardingContext,
  pairs: PairChecks | null,
) {
  if (pairs) reconcileAfterResponse(context, gearMismatches(pairs));
}

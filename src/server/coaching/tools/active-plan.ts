import "server-only";
import { z } from "zod";
import { localToday } from "@/features/plans/constraints";
import { addDays } from "@/features/plans/model/dates";
import { sessionSchema, weekSchema } from "@/features/plans/model/plan";
import type { OnboardingContext } from "@/server/onboarding/context";
import { readActivePlan } from "@/server/plans/stored";
import { defineTool } from "./define";
import { toolError } from "./errors";

export const maxRangeDays = 42;

export const dateRangeInput = z
  .strictObject({
    from: z.iso.date().describe("First date to read (YYYY-MM-DD)."),
    to: z.iso
      .date()
      .describe(
        `Last date to read (YYYY-MM-DD), at most ${maxRangeDays} days after from.`,
      ),
  })
  .refine(({ from, to }) => from <= to && addDays(from, maxRangeDays) >= to, {
    message: "range_too_large",
  });

export async function requireActivePlan(context: OnboardingContext) {
  const stored = await readActivePlan(context);
  if (!stored) throw toolError("no_active_plan");
  return stored;
}

export const planHeaderSchema = z.strictObject({
  title: z.string(),
  startsOn: z.iso.date(),
  endsOn: z.iso.date(),
  timeZone: z.string(),
  version: z.number().int().positive(),
});

export const readActivePlanTool = defineTool({
  name: "read_active_plan",
  description:
    "Read the athlete's active training plan for a date range: weeks, planned sessions with their keys, dates, content and targets, and the plan version. Returns JSON. Session keys from this result are the only valid keys for proposal operations.",
  class: "read",
  dataClasses: ["plan"],
  input: dateRangeInput,
  output: z.strictObject({
    today: z.iso.date(),
    plan: planHeaderSchema,
    weeks: z.array(weekSchema),
    sessions: z.array(sessionSchema),
  }),
  run: async (context, { from, to }) => {
    const stored = await requireActivePlan(context);
    const { plan, weeks, sessions } = stored.state;
    return {
      today: localToday(plan.timeZone),
      plan: {
        title: plan.title,
        startsOn: plan.startsOn,
        endsOn: plan.endsOn,
        timeZone: plan.timeZone,
        version: stored.activeVersion,
      },
      weeks: weeks.filter(
        (week) => week.weekStart <= to && addDays(week.weekStart, 6) >= from,
      ),
      sessions: sessions.filter(
        (session) => session.scheduledOn >= from && session.scheduledOn <= to,
      ),
    };
  },
});

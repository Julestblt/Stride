import "server-only";
import { z } from "zod";
import { localToday } from "@/features/plans/constraints";
import { addDays } from "@/features/plans/model/dates";
import type { OnboardingContext } from "@/server/onboarding/context";
import { readPlanningConstraints } from "@/server/plans/constraints";
import { defineTool } from "./define";

export const checkinSchema = z.strictObject({
  date: z.iso.date(),
  legs: z.string().optional(),
  soreness: z.string().optional(),
  stress: z.string().optional(),
});

export type Checkin = z.infer<typeof checkinSchema>;

type CheckinRow = {
  checkin_date: string;
  legs: string | null;
  soreness: string | null;
  stress: string | null;
};

export function toCheckin(row: CheckinRow): Checkin {
  return {
    date: row.checkin_date,
    ...(row.legs ? { legs: row.legs } : {}),
    ...(row.soreness ? { soreness: row.soreness } : {}),
    ...(row.stress ? { stress: row.stress } : {}),
  };
}

export async function readCheckins(
  context: OnboardingContext,
  since: string,
): Promise<Checkin[]> {
  const { data, error } = await context.client
    .from("athlete_wellness_checkins")
    .select("checkin_date, legs, soreness, stress")
    .eq("user_id", context.userId)
    .gte("checkin_date", since)
    .order("checkin_date", { ascending: false });
  if (error) throw new Error("Unable to read the wellness check-ins");
  return (data ?? []).map(toCheckin);
}

export const readHealthReportsTool = defineTool({
  name: "read_health_reports",
  description:
    "Read the athlete's wellness check-ins for the last days, newest first: legs, soreness and stress by date. Values the athlete did not report are absent. Returns JSON. Use it before giving any health opinion.",
  class: "read",
  dataClasses: ["health"],
  input: z.strictObject({
    days: z
      .int()
      .min(1)
      .max(42)
      .describe("Number of past days to read, ending today."),
  }),
  output: z.strictObject({
    today: z.iso.date(),
    checkins: z.array(checkinSchema),
  }),
  run: async (context, { days }) => {
    const { timeZone } = await readPlanningConstraints(context);
    const today = localToday(timeZone);
    return {
      today,
      checkins: await readCheckins(context, addDays(today, -days)),
    };
  },
});

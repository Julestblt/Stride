import "server-only";
import { z } from "zod";
import { localToday } from "@/features/plans/constraints";
import { addDays } from "@/features/plans/model/dates";
import {
  calendarRules,
  checkCalendar,
  roleOfPriority,
  type CalendarRaceInput,
} from "@/features/races/calendar";
import { readActivePlan } from "@/server/plans/stored";
import { defineTool } from "./define";
import { toolError } from "./errors";

const historyDays = 180;

const raceRowSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  race_date: z.string().nullable(),
  distance_km: z.number().nullable(),
  elevation_gain_m: z.number().nullable(),
  race_kind: z.enum(["road", "trail"]),
  priority: z.enum(["A", "B", "C"]),
});

const candidateSchema = z.strictObject({
  name: z.string().trim().min(1).max(120).describe("Race name."),
  date: z.iso.date().describe("Race date (YYYY-MM-DD)."),
  distanceKm: z.number().positive().max(400).describe("Distance in km."),
  elevationGainM: z
    .number()
    .min(0)
    .max(20_000)
    .nullable()
    .describe("Elevation gain in m, null when unknown."),
  kind: z.enum(["road", "trail"]),
  role: z
    .enum(["primary", "preparation", "fun"])
    .describe(
      "Role to test: primary (objectif principal), preparation or fun (plaisir).",
    ),
});

const calendarRaceSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  kind: z.enum(["road", "trail"]),
  role: z.enum(["primary", "preparation", "fun"]),
  date: z.string(),
  dateLabel: z.string(),
  weekday: z.string(),
  weekend: z.boolean(),
  daysFromToday: z.number().nullable(),
  distanceKm: z.number(),
  elevationGainM: z.number(),
  kmEffort: z.number(),
  recoveryDays: z.number(),
  recoveryEndsOn: z.string(),
  taperDays: z.number().nullable(),
  taperStartsOn: z.string().nullable(),
});

const inputRaceSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  date: z.string().nullable(),
  distanceKm: z.number().nullable(),
  elevationGainM: z.number().nullable(),
  kind: z.enum(["road", "trail"]),
  role: z.enum(["primary", "preparation", "fun"]),
});

export const readSeasonCalendarTool = defineTool({
  name: "read_season_calendar",
  description:
    "Check the athlete's season calendar with Stride's deterministic rules: every race of the last 180 days and ahead with its weekday, km-effort (km + D+/100, D+ ignored on road), recovery window after it and taper window before the main objective, the gaps between consecutive races, and every conflict with the rule applied. Pass candidates to test races the athlete mentions that are not saved yet; they are checked with the saved races and never stored. Also returns the active plan's dates and the rule table. Never compute dates or gaps yourself: use this result.",
  class: "compute",
  dataClasses: ["training", "plan"],
  input: z.strictObject({
    candidates: z
      .array(candidateSchema)
      .max(5)
      .describe("Races to test, not saved. Empty to check the saved season."),
  }),
  output: z.strictObject({
    today: z.iso.date(),
    plan: z
      .strictObject({ startsOn: z.iso.date(), endsOn: z.iso.date() })
      .nullable(),
    rules: z.unknown(),
    races: z.array(calendarRaceSchema),
    gaps: z.array(
      z.object({
        fromRaceId: z.string(),
        toRaceId: z.string(),
        days: z.number(),
        weeks: z.number(),
      }),
    ),
    conflicts: z.array(
      z.object({
        code: z.string(),
        firstRaceId: z.string(),
        secondRaceId: z.string(),
        requiredDays: z.number(),
        actualDays: z.number(),
      }),
    ),
    undated: z.array(inputRaceSchema),
    incomplete: z.array(inputRaceSchema),
  }),
  run: async (context, { candidates }) => {
    const [rows, stored] = await Promise.all([
      context.client
        .from("athlete_races")
        .select(
          "id, name, race_date, distance_km, elevation_gain_m, race_kind, priority",
        )
        .eq("user_id", context.userId),
      readActivePlan(context),
    ]);
    if (rows.error) throw toolError("tool_unavailable");
    const today = localToday(stored?.state.plan.timeZone ?? "Europe/Paris");
    const since = addDays(today, -historyDays);
    const saved: CalendarRaceInput[] = z
      .array(raceRowSchema)
      .parse(rows.data)
      .filter((row) => !row.race_date || row.race_date >= since)
      .map((row) => ({
        id: row.id,
        name: row.name,
        date: row.race_date,
        distanceKm: row.distance_km,
        elevationGainM: row.elevation_gain_m,
        kind: row.race_kind,
        role: roleOfPriority(row.priority),
      }));
    const tested: CalendarRaceInput[] = candidates.map((candidate, index) => ({
      id: `candidate-${index + 1}`,
      ...candidate,
    }));
    const check = checkCalendar([...saved, ...tested], { today });
    return {
      today,
      plan: stored
        ? {
            startsOn: stored.state.plan.startsOn,
            endsOn: stored.state.plan.endsOn,
          }
        : null,
      rules: calendarRules,
      ...check,
    };
  },
});

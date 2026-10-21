import "server-only";
import { z } from "zod";
import { localToday } from "@/features/app-shell/shell";
import { breakIn, racePair } from "@/features/gear/break-in";
import { pairWear, replacementDate } from "@/features/gear/mileage";
import { pairFacts } from "@/features/gear/planned";
import {
  optionSentence,
  recommendationSentence,
} from "@/features/gear/reasons";
import { modelName } from "@/features/gear/view";
import { addDays } from "@/features/plans/model/dates";
import { localToday as planToday } from "@/features/plans/constraints";
import { buildPlanShoes, readRaceFacts } from "@/server/gear/planned";
import { loadGear } from "@/server/gear/load";
import { readActivePlan } from "@/server/plans/stored";
import { defineTool } from "./define";
import { toolError } from "./errors";

const maxRangeDays = 28;

const reasonCodes = {
  kind_fit: "pair type suits the session kind",
  terrain_fit: "pair terrain matches the session terrain",
  long_climb: "long session or large D+: cushioned or trail pair",
  rested: "pair has rested for `days` days",
  rotation: "another suitable pair ran the day before",
  race_key: "race pair used on a key session before its race",
  break_in: "race pair breaking in before its race",
  preferred: "the athlete chose this pair before for this session kind",
  only_option: "only eligible pair",
  reserved: "race pair kept for its race and key sessions",
  terrain_mismatch: "pair terrain does not fit the session",
  used_yesterday: "pair ran the day before",
  less_suited: "eligible but a weaker fit",
};

const reasonSchema = z
  .object({ code: z.string() })
  .catchall(z.union([z.string(), z.number()]));

const pairSchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  brand: z.string(),
  category: z.string(),
  terrain: z.string(),
  description: z.string().nullable(),
  totalKm: z.number(),
  lifespanKm: z.number(),
  remainingKm: z.number(),
  wearPercent: z.number(),
  worn: z.boolean(),
  garminLinked: z.boolean(),
  firstUseDate: z.iso.date(),
  lastRunOn: z.iso.date().nullable(),
  longestRunKm: z.number(),
  replacementOn: z.iso.date().nullable(),
});

const round = (value: number) => Math.round(value * 10) / 10;

export const readGearTool = defineTool({
  name: "read_gear",
  description:
    "Read the athlete's running shoes and Stride's pair for each planned session. Returns every active pair (km counted by Garmin plus starting km, lifespan, wear, longest run in the last year, projected replacement date), the pair Stride recommends or the athlete chose for every running session between `from` and `to` (at most 28 days, today to today + 6 by default) with reason codes and the French sentence Stride shows, and each upcoming race with its race pair (linked on the race gear list, else the race pair reserved for it) and that pair's break-in status. Recommendations come from deterministic rules: never pick or name a pair that is not in this result, and never describe a pair beyond its type, terrain and description.",
  class: "read",
  dataClasses: ["training", "plan"],
  input: z.strictObject({
    from: z.iso
      .date()
      .nullable()
      .describe("First day (YYYY-MM-DD), null for today."),
    to: z.iso
      .date()
      .nullable()
      .describe("Last day (YYYY-MM-DD), null for from + 6 days."),
  }),
  output: z.strictObject({
    today: z.iso.date(),
    from: z.iso.date(),
    to: z.iso.date(),
    pairs: z.array(pairSchema),
    retiredPairs: z.number().int(),
    sessions: z.array(
      z.strictObject({
        sessionKey: z.string(),
        date: z.iso.date(),
        title: z.string(),
        kind: z.string(),
        terrain: z.string().nullable(),
        pairId: z.string().nullable(),
        pairName: z.string().nullable(),
        choice: z.enum(["recommended", "athlete", "none"]),
        recommendedPairId: z.string().nullable(),
        reasons: z.array(reasonSchema),
        sentence: z.string(),
        alternatives: z.array(
          z.strictObject({
            pairId: z.string(),
            eligible: z.boolean(),
            reasons: z.array(reasonSchema),
            sentence: z.string(),
          }),
        ),
      }),
    ),
    races: z.array(
      z.strictObject({
        raceId: z.string(),
        name: z.string(),
        date: z.iso.date(),
        kind: z.enum(["road", "trail"]),
        pair: z
          .strictObject({
            id: z.string(),
            name: z.string(),
            source: z.enum(["checklist", "reserved"]),
          })
          .nullable(),
        breakIn: z
          .strictObject({
            status: z.enum(["new", "breaking_in", "broken_in"]),
            totalKm: z.number(),
            longestRunKm: z.number(),
            budgetKm: z.strictObject({ min: z.number(), max: z.number() }),
          })
          .nullable(),
      }),
    ),
    reasonCodes: z.record(z.string(), z.string()),
  }),
  run: async (context, input) => {
    const stored = await readActivePlan(context);
    const today = stored
      ? planToday(stored.state.plan.timeZone)
      : localToday(new Date());
    const from = input.from ?? today;
    const to = input.to ?? addDays(from, 6);
    if (to < from || addDays(from, maxRangeDays - 1) < to)
      throw toolError("invalid_input", [
        {
          path: "to",
          message:
            "La période doit commencer avant de finir et durer 28 jours au plus.",
        },
      ]);
    const [{ gear, races, plan }, links] = await Promise.all([
      stored
        ? buildPlanShoes(context, stored.state.sessions, today)
        : Promise.all([loadGear(context), readRaceFacts(context)]).then(
            ([gear, races]) => ({ gear, races, plan: null }),
          ),
      context.client
        .from("race_checklist_items")
        .select("race_id, shoe_id")
        .eq("user_id", context.userId)
        .eq("list", "gear_kit")
        .not("shoe_id", "is", null),
    ]);
    if (links.error) throw toolError("tool_unavailable");
    const active = gear.shoes.filter((shoe) => shoe.retiredOn === null);
    const names = new Map(
      gear.shoes.map((shoe) => [shoe.id, modelName(shoe.spec)]),
    );
    const longest = new Map(
      gear.shoes.map((shoe) => [
        shoe.id,
        round(
          Math.max(0, ...shoe.activities.map((run) => run.distanceM)) / 1000,
        ),
      ]),
    );
    const pairs = active.map((shoe) => {
      const wear = pairWear({
        startingDistanceM: shoe.startingDistanceM,
        garminDistanceM: shoe.garmin?.totalDistanceM ?? 0,
        lifespanKm: shoe.spec.lifespanKm,
      });
      return {
        id: shoe.id,
        name: modelName(shoe.spec),
        brand: shoe.spec.brand,
        category: shoe.spec.category,
        terrain: shoe.spec.terrain,
        description: shoe.spec.description,
        totalKm: round(wear.totalKm),
        lifespanKm: wear.lifespanKm,
        remainingKm: round(wear.remainingKm),
        wearPercent: wear.percent,
        worn: wear.worn,
        garminLinked: shoe.garmin !== null,
        firstUseDate: shoe.firstUseDate,
        lastRunOn: shoe.activities[0]?.day ?? null,
        longestRunKm: longest.get(shoe.id) ?? 0,
        replacementOn: replacementDate(wear, shoe.activities, today),
      };
    });
    const sessions = (stored?.state.sessions ?? [])
      .filter(
        (session) => session.scheduledOn >= from && session.scheduledOn <= to,
      )
      .sort(
        (first, second) =>
          first.scheduledOn.localeCompare(second.scheduledOn) ||
          first.sessionKey.localeCompare(second.sessionKey),
      )
      .flatMap((session) => {
        const result = plan?.results.get(session.sessionKey);
        const need = plan?.needs.get(session.sessionKey);
        if (!result || !need) return [];
        const { recommendation, chosen } = result;
        return [
          {
            sessionKey: session.sessionKey,
            date: session.scheduledOn,
            title: session.title,
            kind: session.kind,
            terrain: session.terrain,
            pairId: chosen?.pairId ?? null,
            pairName: chosen ? (names.get(chosen.pairId) ?? null) : null,
            choice: chosen
              ? chosen.overridden
                ? ("athlete" as const)
                : ("recommended" as const)
              : ("none" as const),
            recommendedPairId: recommendation.pairId,
            reasons: recommendation.reasons,
            sentence: recommendationSentence(recommendation.reasons, need),
            alternatives: recommendation.alternatives.map((option) => ({
              pairId: option.pairId,
              eligible: option.eligible,
              reasons: option.reasons,
              sentence: optionSentence(option),
            })),
          },
        ];
      });
    const candidates = gear.shoes.map((shoe) => ({
      ...pairFacts(shoe),
      retired: shoe.retiredOn !== null,
    }));
    const upcoming = races
      .filter((race) => race.date >= today)
      .sort((first, second) => first.date.localeCompare(second.date));
    return {
      today,
      from,
      to,
      pairs,
      retiredPairs: gear.shoes.length - active.length,
      sessions,
      races: upcoming.map((race) => {
        const linked = links.data
          .filter((row) => row.race_id === race.id && row.shoe_id)
          .map((row) => row.shoe_id as string);
        const pair = racePair(race, linked, candidates, upcoming, today);
        const facts = pair
          ? pairs.find((item) => item.id === pair.pairId)
          : null;
        return {
          raceId: race.id,
          name: race.name,
          date: race.date,
          kind: race.terrain,
          pair:
            pair && facts
              ? { id: pair.pairId, name: facts.name, source: pair.source }
              : null,
          breakIn: facts ? breakIn(facts.totalKm, facts.longestRunKm) : null,
        };
      }),
      reasonCodes,
    };
  },
});

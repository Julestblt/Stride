import type { DeterministicPlanInput } from "@/features/plans/detailing/build";
import { addDays } from "@/features/plans/model/dates";
import type { ProfileValues } from "@/features/onboarding/profile";

export const fixtureToday = "2026-10-14";

function activities() {
  return Array.from({ length: 16 * 7 }, (_, index) => {
    const day = addDays(fixtureToday, -(index + 1));
    const weekday = index % 7;
    if (![0, 2, 4, 5].includes(weekday)) return null;
    const long = weekday === 5;
    return {
      day,
      type: weekday === 4 ? "trail_running" : "running",
      distance: long ? 21_000 : 10_000 + (index % 3) * 500,
      duration: long ? 7_200 : 3_300,
      gain: weekday === 4 ? 450 : 60,
    };
  }).filter((activity) => activity !== null);
}

export function planningInputFixture(): DeterministicPlanInput {
  return {
    today: fixtureToday,
    races: [
      {
        id: "11111111-1111-4111-8111-111111111111",
        name: "Marathon de Lyon",
        date: "2027-04-04",
        distanceKm: 42.195,
        elevationGainM: 120,
        kind: "road",
        priority: "A",
        targetSeconds: 11_700,
      },
      {
        id: "22222222-2222-4222-8222-222222222222",
        name: "Semi de Paris",
        date: "2027-03-07",
        distanceKm: 21.1,
        elevationGainM: null,
        kind: "road",
        priority: "B",
        targetSeconds: null,
      },
      {
        id: "33333333-3333-4333-8333-333333333333",
        name: "Trail passé",
        date: "2026-09-01",
        distanceKm: 30,
        elevationGainM: 1_500,
        kind: "trail",
        priority: "C",
        targetSeconds: null,
      },
    ],
    activities: activities(),
    availability: {
      availableWeekdays: [1, 3, 5, 6, 7],
      weekdaySessionMinutes: 75,
      longRunDay: "sunday",
      trainingAccess: ["track", "hills"],
    },
    constraints: {
      timeZone: "Europe/Paris",
      maxWeeklyMinutes: 420,
      unavailablePeriods: [
        {
          id: "44444444-4444-4444-8444-444444444444",
          startsOn: "2026-06-01",
          endsOn: "2026-06-07",
          kind: "travel",
          reason: null,
          revision: 1,
        },
        {
          id: "55555555-5555-4555-8555-555555555555",
          startsOn: "2026-12-20",
          endsOn: "2026-12-27",
          kind: "travel",
          reason: "Vacances",
          revision: 1,
        },
      ],
    },
    targets: {
      flatLapThresholdPace: { secondsPerKm: 262, asOf: fixtureToday },
      garminLactateThreshold: {
        speedMps: 3.8,
        heartRateBpm: 171,
        asOf: "2026-10-01",
      },
      bestEfforts: [{ meters: 10_000, seconds: 2_640, asOf: "2026-09-20" }],
      vo2Max: { value: 56, asOf: "2026-10-12" },
      garminZones: null,
      strideZones: {
        zones: [
          { zone: 1, lower: 100, upper: 119 },
          { zone: 2, lower: 120, upper: 139 },
          { zone: 3, lower: 140, upper: 159 },
          { zone: 4, lower: 160, upper: 175 },
          { zone: 5, lower: 176, upper: 195 },
        ],
        asOf: fixtureToday,
      },
    },
    optimisticSeconds: 11_400,
  };
}

export function profileFixture(): ProfileValues {
  return {
    first_name: "Jules",
    birth_date: "1990-05-20",
    sex: "male",
    height_cm: 180,
    weight_kg: 70,
    primary_terrain: "road",
    available_weekdays: [1, 3, 5, 6, 7],
    long_run_day: "sunday",
    weekday_session_minutes: 75,
    training_access: ["track", "hills"],
    value_sources: {},
  };
}

export const checkinFixture = Array.from({ length: 14 }, (_, index) => ({
  checkin_date: addDays(fixtureToday, -index),
  legs: index % 3 === 0 ? "heavy" : "fresh",
  soreness: index === 2 ? null : "none",
  stress: "low",
}));

export const predictionFixture = [
  {
    metric: "race_prediction_10k_seconds",
    observed_on: "2026-10-12",
    value_numeric: 2_610,
  },
  {
    metric: "race_prediction_half_marathon_seconds",
    observed_on: "2026-10-12",
    value_numeric: 5_790,
  },
  {
    metric: "race_prediction_marathon_seconds",
    observed_on: "2026-10-12",
    value_numeric: 12_300,
  },
];

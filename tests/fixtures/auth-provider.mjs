import { createServer } from "node:http";
import { createHmac, createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

const user = {
  id: "11111111-1111-4111-8111-111111111111",
  aud: "authenticated",
  role: "authenticated",
  email: "athlete@example.com",
  email_confirmed_at: "2026-01-01T00:00:00Z",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: { full_name: "Jules Thibault" },
};
const encode = (value) =>
  Buffer.from(JSON.stringify(value)).toString("base64url");
function accessToken(expires, identity = user) {
  const payload = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: identity.id, aud: identity.aud, role: identity.role, email: identity.email, exp: expires })}`;
  return `${payload}.${createHmac("sha256", "isolated-test-secret").update(payload).digest("base64url")}`;
}
const token = accessToken(Math.floor(Date.now() / 1000) + 3600);
const session = {
  access_token: token,
  refresh_token: "isolated-refresh-token",
  expires_in: 3600,
  token_type: "bearer",
  user,
};
const recordsEmptyUser = {
  ...user,
  id: "22222222-2222-4222-8222-222222222222",
  email: "records-empty@example.com",
};
const recordsFailureUser = {
  ...user,
  id: "33333333-3333-4333-8333-333333333333",
  email: "records-failure@example.com",
};
const recordsGoalFailureUser = {
  ...user,
  id: "44444444-4444-4444-8444-444444444444",
  email: "records-goal-failure@example.com",
};
const planUser = {
  ...user,
  id: "55555555-5555-4555-8555-555555555555",
  email: "plan@example.com",
};
const syncUser = {
  ...user,
  id: "66666666-6666-4666-8666-666666666666",
  email: "sync@example.com",
};
const planReviewUser = {
  ...user,
  id: "77777777-7777-4777-8777-777777777777",
  email: "plan-review@example.com",
};
const planHistoryUser = {
  ...user,
  id: "88888888-8888-4888-8888-888888888888",
  email: "plan-history@example.com",
};
const coachUser = {
  ...user,
  id: "99999999-9999-4999-8999-999999999999",
  email: "coach@example.com",
};
const watchUser = {
  ...user,
  id: "abababab-abab-4bab-8bab-abababababab",
  email: "watch@example.com",
};
const recordsSessions = [
  watchUser,
  coachUser,
  recordsEmptyUser,
  recordsFailureUser,
  recordsGoalFailureUser,
  planUser,
  syncUser,
  planReviewUser,
  planHistoryUser,
].map((identity) => ({
  ...session,
  user: identity,
  access_token: accessToken(Math.floor(Date.now() / 1000) + 3600, identity),
}));
const day = 86_400_000;
const daysAgo = (days, time = "07:12:00") => {
  const date = new Date(Date.now() - days * day).toISOString().slice(0, 10);
  return {
    started_at: `${date}T${time}Z`,
    local_started_at: `${date} ${time}`,
  };
};
const activity = (id, days, values) => ({
  id: `aaaaaaaa-aaaa-4aaa-8aaa-${String(id).padStart(12, "0")}`,
  provider: "garmin",
  activity_type: "running",
  activity_name: null,
  route_name: null,
  distance_meters: null,
  duration_seconds: null,
  elevation_gain_meters: null,
  elevation_loss_meters: null,
  average_heart_rate: null,
  max_heart_rate: null,
  average_cadence: null,
  average_power_watts: null,
  max_power_watts: null,
  aerobic_training_effect: null,
  anaerobic_training_effect: null,
  detail_imported_at: null,
  calories: null,
  workout_rpe: null,
  workout_feel: null,
  ...daysAgo(days),
  ...values,
});
const lap = (activityId, index, values) => ({
  activity_id: `aaaaaaaa-aaaa-4aaa-8aaa-${String(activityId).padStart(12, "0")}`,
  user_id: user.id,
  segment_type: "lap",
  segment_index: index,
  started_at: null,
  average_cadence: null,
  average_power_watts: null,
  ...values,
});
const progressLaps = [
  ...Array.from({ length: 70 }, (_, run) =>
    Array.from({ length: 8 }, (_, index) =>
      lap(100 + run, index, {
        distance_meters: 1000,
        duration_seconds: 330 + Math.round(run * 0.25) + (index % 3),
        average_heart_rate: index === 6 ? 157 : 134 + (index % 3),
        elevation_gain_meters: 4,
        elevation_loss_meters: 4,
      }),
    ),
  ).flat(),
  ...Array.from({ length: 21 }, (_, index) =>
    lap(2, index, {
      distance_meters: 1000,
      duration_seconds: index % 5 === 2 ? 540 : 350,
      average_heart_rate: index < 10 ? 140 : 152,
      elevation_gain_meters: index % 5 === 2 ? 100 : 6,
      elevation_loss_meters: index % 5 === 3 ? 100 : 6,
    }),
  ),
];
const progressObservations = Array.from({ length: 200 }, (_, index) => {
  const age = 199 - index;
  const observed_on = new Date(Date.now() - age * day)
    .toISOString()
    .slice(0, 10);
  const chronic = Math.round(
    260 + index * 0.9 - Math.max(0, 38 - age) * 1.5 + Math.sin(index / 9) * 12,
  );
  const acute = Math.round(chronic + Math.sin(index / 3.2) * 70);
  return [
    ["training_load_chronic", chronic],
    ["training_load_acute", acute],
    ["vo2_max", index < 120 ? 54 : 55],
  ].map(([metric, value_numeric]) => ({
    user_id: user.id,
    metric,
    observed_on,
    value_numeric,
    availability: "available",
  }));
}).flat();
const recoveryObservations = Array.from({ length: 60 }, (_, index) => {
  const age = 59 - index;
  const observed_on = new Date(Date.now() - age * day)
    .toISOString()
    .slice(0, 10);
  const wave = Math.sin(index / 2.3);
  const values = [
    ["training_readiness", age === 0 ? 58 : Math.round(70 + wave * 6), null],
    [
      "sleep_duration_seconds",
      age === 0 ? 21_120 : Math.round(26_400 + wave * 1200),
      null,
    ],
    ["sleep_score", age === 0 ? 61 : Math.round(82 + wave * 5), null],
    ["hrv_last_night_ms", age === 0 ? 46 : Math.round(58 + wave * 4), null],
    ["hrv_status", null, "BALANCED"],
    ["sleep_deep_seconds", age === 0 ? 3480 : 4800, null],
    ["sleep_light_seconds", age === 0 ? 12_360 : 14_400, null],
    ["sleep_rem_seconds", age === 0 ? 5280 : 5700, null],
    ["sleep_awake_seconds", age === 0 ? 840 : 600, null],
    ["average_stress", Math.round(30 + wave * 6), null],
    ["body_battery_wake", age === 0 ? 61 : Math.round(80 + wave * 8), null],
    ["body_battery_charged", age === 0 ? 38 : Math.round(55 + wave * 6), null],
    ["body_battery_drained", Math.round(-50 - wave * 8), null],
    ["recovery_time_minutes", age === 0 ? 840 : 600, null],
    ["load_focus_low_aerobic", 310, null],
    ["load_focus_high_aerobic", 280, null],
    ["load_focus_anaerobic", 70, null],
  ];
  return values.map(([metric, value_numeric, value_text]) => ({
    user_id: user.id,
    metric,
    observed_on,
    value_numeric,
    value_text,
    availability: "available",
  }));
}).flat();
const planShoe = (id, brand, model, version, category, terrain, km) => ({
  id,
  user_id: planUser.id,
  garmin_gear_uuid: `${id.slice(-1).repeat(8)}${"0".repeat(24)}`,
  brand,
  model,
  version,
  category,
  terrain,
  description: null,
  suggested_fields: [],
  size_eu: null,
  lifespan_km: 800,
  starting_distance_m: km * 1000,
  first_use_date: "2026-03-01",
  retired_on: null,
  revision: 1,
  created_at: "2026-03-01T00:00:00Z",
  updated_at: "2026-03-01T00:00:00Z",
});
const tables = {
  athlete_shoes: [
    planShoe(
      "d1000000-0000-4000-8000-000000000001",
      "Adidas",
      "Adizero Evo SL",
      "3",
      "daily",
      "road",
      594,
    ),
    planShoe(
      "d1000000-0000-4000-8000-000000000002",
      "Saucony",
      "Endorphin Speed",
      "4",
      "tempo",
      "road",
      120,
    ),
    planShoe(
      "d1000000-0000-4000-8000-000000000003",
      "Nike",
      "Zegama",
      null,
      "daily",
      "trail",
      241,
    ),
  ],
  plan_session_shoe_choices: [],
  activity_shoe_decisions: [],
  athlete_wellness_checkins: [],
  provider_activities: [
    activity(1, 1, {
      distance_meters: 8320,
      duration_seconds: 3014,
      average_heart_rate: 138,
    }),
    activity(2, 3, {
      activity_type: "trail_running",
      route_name: "Fontainebleau",
      distance_meters: 21400,
      duration_seconds: 7500,
      elevation_gain_meters: 540,
      average_heart_rate: 146,
    }),
    activity(3, 4, {
      activity_type: "strength_training",
      duration_seconds: 3300,
    }),
    activity(4, 6, {
      activity_name: "Threshold 3 × 10 min",
      calories: 720,
      workout_rpe: 8,
      workout_feel: 75,
      distance_meters: 11300,
      duration_seconds: 3520,
      elevation_gain_meters: 64,
      elevation_loss_meters: 58,
      average_heart_rate: 152,
      max_heart_rate: 176,
      average_cadence: 168,
      aerobic_training_effect: 3.4,
      anaerobic_training_effect: 1.8,
      detail_imported_at: "2026-10-07T04:12:00Z",
    }),
    activity(5, 38, {
      activity_type: "trail_running",
      route_name: "Trail 80K",
      distance_meters: 80200,
      duration_seconds: 40500,
      elevation_gain_meters: 1620,
    }),
    ...Array.from({ length: 64 }, (_, index) =>
      activity(900 + index, 2 + Math.floor(index / 4) * 7 + (index % 4) * 2, {
        user_id: planUser.id,
        activity_name: "Footing",
        distance_meters: index % 4 === 3 ? 16000 : 9000,
        duration_seconds: index % 4 === 3 ? 5400 : 3000,
        average_heart_rate: 142,
        max_heart_rate: 186,
      }),
    ),
    ...Array.from({ length: 70 }, (_, index) =>
      activity(100 + index, 40 + index, {
        activity_name:
          index === 60
            ? "Été 100%_effort \\ sentier * (soir), lac"
            : "Course à pied",
        distance_meters: 8000 + index * 10,
        duration_seconds: 3000 + index,
      }),
    ),
  ],
  provider_activity_segments: [
    [900, 2570, 5.5, 134, 168, 6],
    [600, 2270, 4.4, 161, 182, 4],
    [120, 320, 6.2, 141, 164, 0],
    [600, 2230, 4.49, 167, 181, 3],
    [120, 320, 6.18, 146, 163, 0],
    [440, 1600, 4.36, 171, 180, 2],
    [740, 1990, 6.12, 136, 158, 1],
  ]
    .map(([duration, distance, , heartRate, cadence, gain], index) => ({
      activity_id: "aaaaaaaa-aaaa-4aaa-8aaa-000000000004",
      user_id: user.id,
      segment_type: "lap",
      segment_index: index,
      started_at: null,
      distance_meters: distance,
      duration_seconds: duration,
      average_heart_rate: heartRate,
      average_cadence: cadence,
      average_power_watts: null,
      elevation_gain_meters: gain,
      elevation_loss_meters: null,
    }))
    .concat(progressLaps),
  provider_activity_tracks: [
    {
      activity_id: "aaaaaaaa-aaaa-4aaa-8aaa-000000000005",
      user_id: user.id,
      status: "available",
      route: null,
      bounds: null,
      series: {
        elapsed_s: [0, 240, 480, 720, 960, 1200],
        distance_m: [0, 400, 800, 1200, 1600, 2000],
        elevation_m: [100, 156, 212, 268, 324, 380],
      },
      heart_rate_histogram: null,
      source_point_count: 6,
    },
    {
      activity_id: "aaaaaaaa-aaaa-4aaa-8aaa-000000000004",
      user_id: user.id,
      status: "available",
      route: Array.from({ length: 100 }, (_, index) => {
        const angle = (index / 99) * Math.PI * 2;
        return [
          48.827 + Math.sin(angle) * 0.008,
          2.418 + Math.cos(angle) * 0.014,
        ];
      }),
      bounds: {
        min_lat: 48.819,
        max_lat: 48.835,
        min_lon: 2.404,
        max_lon: 2.432,
      },
      series: {
        elapsed_s: Array.from(
          { length: 100 },
          (_, index) => (index * 3520) / 99,
        ),
        distance_m: Array.from(
          { length: 100 },
          (_, index) => (index * 11300) / 99,
        ),
        heart_rate: Array.from(
          { length: 100 },
          (_, index) => 125 + Math.round(51 * Math.abs(Math.sin(index / 11))),
        ),
        speed_mps: Array.from(
          { length: 100 },
          (_, index) => 3 + Math.sin(index / 8) * 0.7,
        ),
        elevation_m: Array.from(
          { length: 100 },
          (_, index) => 42 + Math.sin(index / 12) * 12,
        ),
        cadence: Array.from(
          { length: 100 },
          (_, index) => 168 + Math.round(Math.sin(index / 8) * 12),
        ),
      },
      heart_rate_histogram: {
        110: 180,
        130: 700,
        145: 1000,
        160: 1180,
        176: 460,
      },
      source_point_count: 3520,
    },
    {
      activity_id: "aaaaaaaa-aaaa-4aaa-8aaa-000000000003",
      user_id: user.id,
      status: "available",
      route: null,
      bounds: null,
      series: {
        elapsed_s: [0, 600, 1200, 1800, 2400, 3300],
        heart_rate: [100, 120, 140, 130, 125, 105],
        speed_mps: [1, 2, 3, 2, 1, 1],
      },
      heart_rate_histogram: { 100: 600, 120: 900, 140: 1800 },
      source_point_count: 3300,
    },
  ],
  provider_observations: Array.from({ length: 10 }, (_, index) => ({
    user_id: user.id,
    metric: "resting_heart_rate_bpm",
    observed_on: new Date(Date.now() - index * day).toISOString().slice(0, 10),
    value_numeric: 50,
    availability: "available",
  }))
    .concat(progressObservations)
    .concat(recoveryObservations),
  athlete_profiles: [
    {
      user_id: user.id,
      first_name: "Jules",
      birth_date: "1991-06-14",
      sex: "male",
      height_cm: 178,
      weight_kg: 68.2,
      primary_terrain: "trail",
      available_weekdays: [2, 3, 4, 6, 7],
      long_run_day: "sunday",
      weekday_session_minutes: 60,
      training_access: ["hills", "gym"],
      running_max_heart_rate_override: null,
      threshold_heart_rate_override: null,
      coach_face: "claire",
      medical_face: "ines",
      threshold_heart_rate_source: null,
      profile_photo_path: null,
      time_zone: "Europe/Paris",
      max_weekly_minutes: null,
      value_sources: {
        weight_kg: { source: "garmin", observed_on: "2026-10-07" },
      },
      revision: 1,
      updated_at: "2026-10-07T00:00:00Z",
    },
  ],
  athlete_unavailability: [],
  athlete_goals: [
    {
      user_id: user.id,
      focus: "ultra_trail",
      revision: 1,
      updated_at: "2026-01-01T00:00:00Z",
    },
  ],
  athlete_races: [
    {
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      user_id: user.id,
      name: "EcoTrail Paris 120K",
      race_kind: "trail",
      race_date: new Date(Date.now() + 164 * day).toISOString().slice(0, 10),
      distance_km: 120,
      elevation_gain_m: 1800,
      priority: "A",
      target_duration_seconds: null,
      revision: 1,
      updated_at: "2026-01-01T00:00:00Z",
    },
    {
      id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      user_id: planUser.id,
      name: "Marathon de Paris",
      race_kind: "road",
      race_date: new Date(Date.now() + 150 * day).toISOString().slice(0, 10),
      distance_km: 42.2,
      elevation_gain_m: null,
      priority: "A",
      target_duration_seconds: null,
      revision: 1,
      updated_at: "2026-01-01T00:00:00Z",
    },
  ],
};
tables.athlete_profiles.push({
  ...tables.athlete_profiles[0],
  user_id: planUser.id,
  first_name: "Paula",
  primary_terrain: "road",
  available_weekdays: [2, 3, 4, 6, 7],
  long_run_day: "sunday",
  weekday_session_minutes: 75,
  training_access: [],
  value_sources: {},
});
tables.athlete_goals.push({
  ...tables.athlete_goals[0],
  user_id: planUser.id,
  focus: "half_marathon_marathon",
});
tables.athlete_profiles.push({
  ...tables.athlete_profiles[0],
  user_id: syncUser.id,
  first_name: "Sacha",
});
tables.athlete_goals.push({
  ...tables.athlete_goals[0],
  user_id: syncUser.id,
});
const planId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const isoDay = (time) => new Date(time).toISOString().slice(0, 10);
const shiftDay = (iso, days) =>
  isoDay(Date.parse(`${iso}T00:00:00Z`) + days * day);
const mondayOf = (iso) =>
  shiftDay(iso, -((new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7));
const planToday = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
const planRaceDay = tables.athlete_races.find(
  (race) => race.user_id === planUser.id,
).race_date;
const planStart = shiftDay(mondayOf(planToday), -7);
const planWeekCount =
  (Date.parse(mondayOf(planRaceDay)) - Date.parse(planStart)) / (7 * day) + 1;
const planSecondaryRaceId = "ffffffff-ffff-4fff-8fff-ffffffffffff";
tables.athlete_races.push({
  id: planSecondaryRaceId,
  user_id: planUser.id,
  name: "10K Vincennes",
  race_kind: "road",
  race_date: shiftDay(planStart, 7 * 7 + 6),
  distance_km: 10,
  elevation_gain_m: null,
  priority: "C",
  target_duration_seconds: 2_670,
  revision: 1,
  updated_at: "2026-01-01T00:00:00Z",
});
const step = (seconds, intensity, type = "work") => ({
  type,
  end: { kind: "time", seconds },
  target: { kind: "rpe", min: 3, max: 4 },
  intensity,
});
const planSessionTemplates = {
  easy: (minutes) => ({
    sport: "run",
    kind: "easy",
    title: "Footing",
    purpose: "Endurance fondamentale en aisance respiratoire.",
    terrain: "road",
    durationSeconds: minutes * 60,
    distanceMeters: Math.round(minutes * 166),
    elevationGainMeters: null,
    structure: [step(minutes * 60, "easy")],
  }),
  threshold: () => ({
    sport: "run",
    kind: "threshold",
    title: "Seuil · 4 × 6’",
    purpose: "Développer l’allure seuil sans se mettre dans le rouge.",
    terrain: "road",
    durationSeconds: 3_300,
    distanceMeters: 9_600,
    elevationGainMeters: null,
    structure: [
      step(900, "easy", "warmup"),
      {
        type: "repeat",
        count: 4,
        steps: [step(360, "threshold"), step(90, "recovery", "recovery")],
      },
      step(600, "easy", "cooldown"),
    ],
  }),
  strength: () => ({
    sport: "strength",
    kind: "strength",
    title: "Renfo haut du corps",
    purpose: "Gainage et haut du corps pour tenir la posture.",
    terrain: null,
    durationSeconds: 1_800,
    distanceMeters: null,
    elevationGainMeters: null,
    structure: [step(1_800, "easy")],
  }),
  hills: () => ({
    sport: "run",
    kind: "hills",
    title: "Côtes · 8 × 3’",
    purpose: "Force spécifique en montée.",
    terrain: "trail",
    durationSeconds: 4_200,
    distanceMeters: 9_000,
    elevationGainMeters: 450,
    structure: [
      step(1_200, "easy", "warmup"),
      {
        type: "repeat",
        count: 8,
        steps: [step(180, "marathon"), step(120, "recovery", "recovery")],
      },
      step(600, "easy", "cooldown"),
    ],
  }),
  long: (minutes) => ({
    sport: "trail",
    kind: "long",
    title: "Sortie longue trail",
    purpose: "Temps sur les pieds en terrain varié.",
    terrain: "trail",
    durationSeconds: minutes * 60,
    distanceMeters: Math.round(minutes * 157),
    elevationGainMeters: minutes * 5,
    structure: [step(minutes * 60, "easy")],
  }),
  race: () => ({
    sport: "run",
    kind: "race",
    title: "Marathon de Paris",
    purpose: "Course objectif.",
    terrain: "road",
    durationSeconds: 12_600,
    distanceMeters: 42_195,
    elevationGainMeters: null,
    structure: [step(12_600, "marathon")],
  }),
};
const planBlockSizes = [4, planWeekCount - 13, 6, 3];
const planBlockDefinitions = [
  [
    "b-reconstruction",
    "build",
    "Reconstruction",
    "Reprendre du volume sans casse, réintroduire le seuil et les côtes.",
  ],
  [
    "b-volume",
    "base",
    "Volume",
    "Monter le temps hebdomadaire et la sortie longue.",
  ],
  [
    "b-specifique",
    "specific",
    "Spécifique",
    "Allure marathon et sorties longues spécifiques.",
  ],
  [
    "b-affutage",
    "taper",
    "Affûtage",
    "−30 % puis −50 % de volume, l’intensité reste.",
  ],
];
const planWeeks = [];
const planSessions = [];
let planWeekIndex = 0;
planBlockDefinitions.forEach(([blockKey], blockIndex) => {
  for (let inBlock = 0; inBlock < planBlockSizes[blockIndex]; inBlock++) {
    const weekStart = shiftDay(planStart, planWeekIndex * 7);
    const weekType =
      blockIndex === 3
        ? ["taper", "taper", "race"][inBlock]
        : (inBlock + 1) % 4 === 0
          ? "recovery"
          : "build";
    const longMinutes = 90 + planWeekIndex * 5;
    const plan =
      weekType === "race"
        ? [
            [1, planSessionTemplates.easy(40)],
            [3, planSessionTemplates.easy(30)],
          ]
        : weekType === "recovery" || weekType === "taper"
          ? [
              [1, planSessionTemplates.easy(40)],
              [2, planSessionTemplates.threshold()],
              [3, planSessionTemplates.easy(40)],
              [6, planSessionTemplates.long(75)],
            ]
          : [
              [1, planSessionTemplates.easy(50)],
              [2, planSessionTemplates.threshold()],
              [3, planSessionTemplates.easy(45)],
              [4, planSessionTemplates.strength()],
              [5, planSessionTemplates.hills()],
              [6, planSessionTemplates.long(longMinutes)],
            ];
    if (weekType === "race")
      plan.push([
        (Date.parse(planRaceDay) - Date.parse(weekStart)) / day,
        planSessionTemplates.race(),
      ]);
    const scheduled = plan
      .map(([offset, content]) => ({
        date: shiftDay(weekStart, offset),
        content,
      }))
      .filter(
        ({ date, content }) =>
          date < planRaceDay ||
          (date === planRaceDay && content.kind === "race"),
      );
    for (const { date, content } of scheduled)
      planSessions.push({
        plan_id: planId,
        user_id: planUser.id,
        valid_from_version: 1,
        valid_to_version: null,
        session_key: `s-${date}-1`,
        scheduled_on: date,
        sport: content.sport,
        kind: content.kind,
        title: content.title,
        purpose: content.purpose,
        is_key: ["threshold", "long", "race"].includes(content.kind),
        priority: content.kind === "race" ? "high" : "normal",
        targets: {
          durationSeconds: content.durationSeconds,
          distanceMeters: content.distanceMeters,
          elevationGainMeters: content.elevationGainMeters,
        },
        structure: content.structure,
        terrain: content.terrain,
        origin: "coach",
        contingencies: [],
      });
    const current =
      weekStart <= planToday && planToday <= shiftDay(weekStart, 6);
    planWeeks.push({
      plan_id: planId,
      user_id: planUser.id,
      valid_from_version: 1,
      valid_to_version: null,
      week_key: `w-${weekStart}`,
      week_start: weekStart,
      block_key: blockKey,
      week_type: weekType,
      target_duration_s: scheduled.reduce(
        (total, { content }) => total + content.durationSeconds,
        0,
      ),
      target_distance_m: null,
      target_elevation_m: null,
      quality_sessions: 1,
      long_run_target_s: longMinutes * 60,
      intensity_split: { easyPct: 85, moderatePct: 5, hardPct: 10 },
      notes: current
        ? "Une séance de qualité, une de côtes, une sortie longue trail. Garde le footing de jeudi vraiment facile."
        : null,
    });
    planWeekIndex += 1;
  }
});
let planWeekCursor = 0;
const planBlocks = planBlockDefinitions.map(
  ([blockKey, kind, name, objective], blockIndex) => {
    const startsOn = shiftDay(planStart, planWeekCursor * 7);
    planWeekCursor += planBlockSizes[blockIndex];
    return {
      plan_id: planId,
      user_id: planUser.id,
      valid_from_version: 1,
      valid_to_version: null,
      block_key: blockKey,
      kind,
      name,
      starts_on: startsOn,
      ends_on:
        blockIndex === 3
          ? planRaceDay
          : shiftDay(planStart, planWeekCursor * 7 - 1),
      objective,
      race_id: blockIndex === 1 ? planSecondaryRaceId : null,
    };
  },
);
const pastPlanSessions = planSessions.filter(
  (session) => session.scheduled_on < planToday,
);
const planMatchedSessions = pastPlanSessions.filter(
  (session, index) => index !== 2,
);
const planDoneSession = planMatchedSessions.findLast(
  (session) => session.kind === "easy",
);
const planDoneActivityId = "aaaaaaaa-aaaa-4aaa-8aaa-000000005000";
const planMissedSession = pastPlanSessions[2];
const planImportedActivityId = "aaaaaaaa-aaaa-4aaa-8aaa-000000005001";
const planDoneStart = Date.parse(`${planDoneSession.scheduled_on}T17:12:00Z`);
tables.provider_activities.push({
  ...activity(5000, 0, {
    distance_meters: 8320,
    duration_seconds: 3012,
    average_heart_rate: 142,
    detail_imported_at: new Date(
      planDoneStart + (3012 + 180) * 1000,
    ).toISOString(),
  }),
  user_id: planUser.id,
  provider_activity_id: "21894515000",
  started_at: new Date(planDoneStart).toISOString(),
  local_started_at: `${planDoneSession.scheduled_on} 19:12:00`,
});
tables.provider_activity_gear = [
  {
    user_id: planUser.id,
    provider: "garmin",
    provider_activity_id: "21894515000",
    gear_uuid: `${"3".repeat(8)}${"0".repeat(24)}`,
  },
];
tables.provider_activity_tracks.push({
  activity_id: planDoneActivityId,
  user_id: planUser.id,
  status: "available",
  route: null,
  bounds: null,
  series: (() => {
    const elapsed = Array.from({ length: 302 }, (_, index) => index * 10);
    let meters = 0;
    const distance = elapsed.map((time) => {
      const minute = Math.floor(time / 60);
      const pace = 362 + Math.sin(minute / 4) * 6;
      if (time > 0) meters += (10 * 1000) / pace;
      return Math.round(meters);
    });
    return { elapsed_s: elapsed, distance_m: distance };
  })(),
  heart_rate_histogram: null,
  source_point_count: 302,
});
const planWeekEnd = shiftDay(mondayOf(planToday), 6);
const proposable = (session) =>
  session.scheduled_on <= planWeekEnd && session.kind !== "race";
const nextPlanSession =
  planSessions.find(
    (session) => session.scheduled_on > planToday && proposable(session),
  ) ??
  planSessions.find(
    (session) => session.scheduled_on === planToday && proposable(session),
  );
const placedContent = (content) => ({
  sport: content.sport,
  kind: content.kind,
  title: content.title,
  purpose: content.purpose,
  isKey: false,
  priority: "normal",
  targets: {
    durationSeconds: content.durationSeconds,
    distanceMeters: content.distanceMeters,
    elevationGainMeters: content.elevationGainMeters,
  },
  structure: content.structure,
  terrain: content.terrain,
  origin: "coach",
  contingencies: [],
});
const laterPlanSessions = planSessions.filter(
  (session) =>
    session.scheduled_on >= shiftDay(planToday, 21) && session.kind !== "race",
);
const acceptPlanSession = laterPlanSessions.find(
  (session) => session.kind === "easy",
);
const rejectPlanSession = laterPlanSessions.find(
  (session) => session.kind === "hills",
);
const proposalAt = (days, time) => `${shiftDay(planToday, days)}T${time}Z`;
const readyPlanProposal = (owner, ownerPlanId, id) => ({
  id,
  user_id: owner.id,
  plan_id: ownerPlanId,
  base_version: 3,
  scope: "session",
  origin: "recovery",
  requested_by: "athlete",
  status: "ready",
  summary: null,
  rationale: null,
  operations: [],
  applied_version: null,
  validation: null,
  specialist_opinions: [],
  target_keys: [],
  coach_session_id: null,
  created_at: proposalAt(0, "06:00:00"),
  updated_at: proposalAt(0, "06:00:00"),
});
function shortenProposal(owner, ownerPlanId, id) {
  return {
    ...readyPlanProposal(owner, ownerPlanId, id),
    title: "Raccourcir la séance",
    summary: "Un footing court à la place de la séance prévue.",
    rationale:
      "Ton sommeil baisse depuis trois nuits. Je garde une sortie, plus courte et facile.",
    operations: [
      {
        op: "replace_session",
        sessionKey: nextPlanSession.session_key,
        content: {
          ...placedContent(planSessionTemplates.easy(30)),
          title: "Footing court",
        },
      },
    ],
    specialist_opinions: [
      {
        specialist: "medical",
        verdict: "compatible",
        summary: "Une sortie facile reste possible. Signale toute gêne.",
      },
    ],
    target_keys: [`session:${nextPlanSession.session_key}`],
  };
}
function seedPlanHistory(owner, ownerPlanId, prefix) {
  const id = (index) => `eeeeeeee-eeee-4eee-8eee-${prefix}0000000000${index}`;
  const proposal = (index, fields) => ({
    ...readyPlanProposal(owner, ownerPlanId, id(index)),
    ...fields,
  });
  const decision = (index, kind, days, fields = {}) => ({
    id: randomUUID(),
    user_id: owner.id,
    proposal_id: id(index),
    decision: kind,
    actor: "athlete",
    note: null,
    resulting_version: null,
    created_at: proposalAt(days, "20:00:00"),
    ...fields,
  });
  return {
    proposals: [
      ...(nextPlanSession ? [shortenProposal(owner, ownerPlanId, id(1))] : []),
      ...(acceptPlanSession
        ? [
            proposal(2, {
              title: "Retirer un footing",
              summary: "Un footing en moins pour laisser place au travail.",
              rationale: "Tu m’as dit avoir une semaine chargée au travail.",
              origin: "schedule",
              operations: [
                {
                  op: "skip_session",
                  sessionKey: acceptPlanSession.session_key,
                },
              ],
              target_keys: [`session:${acceptPlanSession.session_key}`],
              created_at: proposalAt(0, "05:00:00"),
            }),
          ]
        : []),
      ...(rejectPlanSession
        ? [
            proposal(3, {
              title: "Remplacer les côtes",
              summary: "Un footing plat à la place des côtes.",
              rationale: "Ta gêne au genou revient après les côtes.",
              operations: [
                {
                  op: "replace_session",
                  sessionKey: rejectPlanSession.session_key,
                  content: {
                    ...placedContent(planSessionTemplates.easy(40)),
                    title: "Footing plat",
                  },
                },
              ],
              target_keys: [`session:${rejectPlanSession.session_key}`],
              created_at: proposalAt(0, "04:00:00"),
            }),
          ]
        : []),
      proposal(4, {
        title: "Repos avancé à mardi",
        summary: "Le repos de jeudi passe à mardi.",
        origin: "schedule",
        status: "applied",
        base_version: 2,
        applied_version: 3,
        created_at: proposalAt(-3, "19:10:00"),
      }),
      proposal(5, {
        title: "Ajouter des côtes courtes",
        status: "rejected",
        base_version: 2,
        created_at: proposalAt(-5, "16:25:00"),
      }),
      proposal(6, {
        title: "Échanger le seuil et la sortie longue",
        status: "stale",
        base_version: 2,
        created_at: proposalAt(-8, "06:05:00"),
      }),
      proposal(7, {
        title: "Nouveau plan · Marathon de Paris",
        summary: "Quatre blocs jusqu’au marathon.",
        scope: "new_plan",
        origin: "training",
        status: "applied",
        base_version: null,
        applied_version: 1,
        created_at: proposalAt(-40, "17:02:00"),
      }),
    ],
    decisions: [
      decision(4, "accepted", -3),
      decision(4, "applied", -3, { actor: "system", resulting_version: 3 }),
      decision(5, "rejected", -5, { note: "week-end en famille" }),
      decision(6, "accepted", -8),
      decision(6, "stale", -8, { actor: "system", note: "stale_version" }),
    ],
  };
}
const planProposals = nextPlanSession
  ? [shortenProposal(planUser, planId, "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee")]
  : [];
const planDecisions = [];
Object.assign(tables, {
  training_plans: [
    {
      id: planId,
      user_id: planUser.id,
      status: "active",
      title: "Marathon de Paris",
      starts_on: planStart,
      ends_on: planRaceDay,
      time_zone: "Europe/Paris",
      primary_race_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      active_version: 3,
      matches_computed_at: new Date().toISOString(),
      matches_version: 3,
      matches_activities_through: null,
    },
  ],
  plan_versions: [
    {
      plan_id: planId,
      user_id: planUser.id,
      version: 3,
      race_roles: [
        { raceId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", role: "primary" },
        { raceId: planSecondaryRaceId, role: "secondary" },
      ],
      confidence: {
        level: "low",
        reasons: ["Peu de sorties au-delà de 30 km"],
      },
      summary:
        "Quatre blocs jusqu’au marathon. Je l’ajuste chaque semaine selon ta récupération, avec ton accord.",
      created_at: `${shiftDay(planToday, -3)}T08:00:00Z`,
    },
  ],
  plan_blocks: planBlocks,
  plan_weeks: planWeeks,
  plan_sessions: planSessions,
  session_activity_matches: planMatchedSessions.map((session, index) => ({
    user_id: planUser.id,
    plan_id: planId,
    session_key: session.session_key,
    activity_id: session === planDoneSession ? planDoneActivityId : null,
    method: "auto",
    status: "completed",
    confidence: 0.9,
    compliance: { duration: [0.98, 1, 0.94, 1.02][index % 4] },
    algorithm_version: "match-v1",
  })),
  plan_proposals: planProposals,
  plan_decisions: planDecisions,
});
const planTables = [
  "training_plans",
  "plan_versions",
  "plan_blocks",
  "plan_weeks",
  "plan_sessions",
];
function twinPlanAthlete(owner, ownerPlanId, prefix) {
  const races = tables.athlete_races.filter(
    (race) => race.user_id === planUser.id,
  );
  let text = JSON.stringify({
    races,
    ...Object.fromEntries(
      planTables.map((table) => [
        table,
        tables[table].filter((row) => row.user_id === planUser.id),
      ]),
    ),
  })
    .replaceAll(planUser.id, owner.id)
    .replaceAll(planId, ownerPlanId);
  races.forEach((race, index) => {
    text = text.replaceAll(
      race.id,
      `${prefix}${prefix}-0000-4000-8000-00000000000${index}`.slice(0, 36),
    );
  });
  const twin = JSON.parse(text);
  tables.athlete_races.push(...twin.races);
  for (const table of planTables) tables[table].push(...twin[table]);
  const history = seedPlanHistory(owner, ownerPlanId, prefix.slice(0, 1));
  tables.plan_proposals.push(...history.proposals);
  tables.plan_decisions.push(...history.decisions);
}
const coachKneeThread = "c0c0c0c0-0000-4000-8000-000000000001";
const coachPlanThread = "c0c0c0c0-0000-4000-8000-000000000002";
const coachSpikeThread = "c0c0c0c0-0000-4000-8000-000000000003";
const coachNewPlanProposal = "eeeeeeee-eeee-4eee-8eee-900000000001";
const coachToday = new Date().toISOString().slice(0, 10);
const coachAt = (time) => `${coachToday}T${time}Z`;
const coachSession = (values) => ({
  user_id: coachUser.id,
  mode: "conversation",
  status: "idle",
  pending_tool_use_id: null,
  budget_cents: 100,
  list_cost_cents: 12,
  last_turn_at: null,
  read_at: null,
  composing_since: null,
  ...values,
});
let coachItemId = 0;
const coachItem = (threadId, time, kind, body) => ({
  id: ++coachItemId,
  user_id: coachUser.id,
  coach_session_id: threadId,
  kind,
  body,
  created_at: coachAt(time),
});
tables.coach_sessions = [
  coachSession({
    id: coachKneeThread,
    managed_session_id: "sesn_01Genou",
    title: "Genou en descente",
    status: "awaiting_athlete",
    pending_tool_use_id: "sevt_knee",
    last_turn_at: coachAt("08:02:00"),
    last_activity_at: coachAt("08:04:00"),
    created_at: coachAt("08:00:00"),
  }),
  coachSession({
    id: coachPlanThread,
    managed_session_id: "sesn_01Plan",
    mode: "plan",
    budget_cents: 200,
    title: "Mon premier plan",
    last_turn_at: coachAt("06:00:00"),
    last_activity_at: coachAt("06:10:00"),
    read_at: coachAt("06:20:00"),
    created_at: coachAt("06:00:00"),
  }),
];
tables.coach_sessions.push(
  coachSession({
    id: coachSpikeThread,
    managed_session_id: "sesn_01Spike",
    title: null,
    status: "awaiting_athlete",
    pending_tool_use_id: "sevt_spike",
    last_turn_at: coachAt("09:00:00"),
    last_activity_at: coachAt("09:00:00"),
    created_at: coachAt("09:00:00"),
  }),
);
const coachActivity = {
  ...activity(9101, 2, {
    activity_name: "Sortie longue vallonnée",
    activity_type: "trail_running",
    distance_meters: 24_600,
    duration_seconds: 9_000,
    elevation_gain_meters: 680,
  }),
  user_id: coachUser.id,
};
tables.provider_activities.push(coachActivity);
const coachRace = {
  id: "c0ace000-0000-4000-8000-000000000001",
  user_id: coachUser.id,
  name: "Trail des Lacs",
  race_kind: "trail",
  race_date: new Date(Date.now() + 250 * day).toISOString().slice(0, 10),
  distance_km: 50,
  elevation_gain_m: 2400,
  priority: "B",
  target_duration_seconds: null,
  revision: 1,
  updated_at: "2026-01-01T00:00:00Z",
};
tables.athlete_races.push(coachRace);
tables.coach_thread_items = [
  coachItem(coachKneeThread, "08:00:00", "athlete", {
    text: "J’ai une douleur au genou depuis la sortie de dimanche.",
    consult: "medical",
    attachments: [
      {
        kind: "activity",
        id: coachActivity.id,
        title: "Sortie longue vallonnée",
        date: coachActivity.started_at.slice(0, 10),
      },
    ],
  }),
  coachItem(coachKneeThread, "08:01:00", "coach", {
    text: "@Inès, tu peux regarder ton genou avec Jules ?",
  }),
  coachItem(coachKneeThread, "08:01:00", "consult_request", {
    thread: "sthr_knee",
    agent: "medical",
    text: "Jules a mal au genou depuis dimanche. Vérifie s’il peut courir.",
  }),
  coachItem(coachKneeThread, "08:02:00", "read", {
    thread: "sthr_knee",
    agent: "medical",
    tool: "read_health_reports",
    label: "Signalements · 14 jours",
  }),
  coachItem(coachKneeThread, "08:04:00", "question", {
    toolUseId: "sevt_knee",
    question: "Comment réagit ton genou en descente ?",
    options: [
      "Aucune gêne",
      "Gêne légère, qui passe",
      "Douleur qui m’oblige à ralentir",
    ],
    askedFor: "medical",
  }),
  coachItem(coachPlanThread, "06:00:00", "athlete", {
    text: "Construis-moi un plan d’entraînement pour mon objectif.",
    consult: null,
  }),
  coachItem(coachPlanThread, "06:09:00", "coach", {
    text: "Voici mon plan pour les quatre prochaines semaines.",
  }),
  coachItem(coachPlanThread, "06:10:00", "proposal", {
    proposalId: coachNewPlanProposal,
    scope: "new_plan",
    title: "Marathon de Paris",
    summary: "Quatre semaines de base.",
    opinions: [],
  }),
];
tables.plan_proposals.push({
  id: coachNewPlanProposal,
  user_id: coachUser.id,
  plan_id: null,
  base_version: null,
  scope: "new_plan",
  origin: "training",
  requested_by: "athlete",
  status: "ready",
  title: "Marathon de Paris",
  summary: "Quatre semaines de base.",
  rationale: null,
  operations: [
    {
      op: "create_plan",
      state: coachNewPlanState(),
    },
  ],
  applied_version: null,
  validation: null,
  specialist_opinions: [],
  target_keys: ["plan"],
  coach_session_id: coachPlanThread,
  created_at: coachAt("06:10:00"),
  updated_at: coachAt("06:10:00"),
});
function coachNewPlanState() {
  const text = readFileSync(
    new URL("./coach-new-plan.json", import.meta.url),
    "utf8",
  );
  const start = new Date(`${shiftDay(mondayOf(planToday), 7)}T00:00:00Z`);
  const shift = Math.round((start - Date.parse("2026-10-12T00:00:00Z")) / day);
  return JSON.parse(
    text.replace(/\d{4}-\d{2}-\d{2}/g, (iso) => shiftDay(iso, shift)),
  );
}
tables.athlete_profiles.push({
  ...tables.athlete_profiles[0],
  user_id: coachUser.id,
});
const coachTables = [
  "athlete_profiles",
  "coach_sessions",
  "coach_thread_items",
  "plan_proposals",
  "plan_decisions",
];
const coachSnapshot = structuredClone(
  Object.fromEntries(
    coachTables.map((table) => [
      table,
      tables[table].filter((row) => row.user_id === coachUser.id),
    ]),
  ),
);
const profileSnapshot = structuredClone(tables.athlete_profiles[0]);
const planReviewPlanId = "dddddddd-dddd-4ddd-8ddd-777777777777";
twinPlanAthlete(planReviewUser, planReviewPlanId, "7777");
const planExtensionRaceId = "77777777-0000-4000-8000-000000000009";
const planExtensionRaceDay = shiftDay(planRaceDay, 28);
tables.athlete_races.push({
  id: planExtensionRaceId,
  user_id: planReviewUser.id,
  name: "Trail des Lacs 30K",
  race_kind: "trail",
  race_date: planExtensionRaceDay,
  distance_km: 30,
  elevation_gain_m: 900,
  priority: "B",
  target_duration_seconds: null,
  revision: 1,
  updated_at: "2026-01-01T00:00:00Z",
});
const planExtensionWeeks = [];
for (
  let weekStart = shiftDay(mondayOf(planRaceDay), 7);
  weekStart <= mondayOf(planExtensionRaceDay);
  weekStart = shiftDay(weekStart, 7)
)
  planExtensionWeeks.push(weekStart);
const planExtensionSessions = [
  ...planExtensionWeeks
    .map((weekStart) => shiftDay(weekStart, 2))
    .filter((date) => date < planExtensionRaceDay)
    .map((date) => ({
      ...placedContent(planSessionTemplates.easy(40)),
      sessionKey: `s-${date}-1`,
      scheduledOn: date,
    })),
  {
    ...placedContent(planSessionTemplates.easy(180)),
    kind: "race",
    title: "Trail des Lacs 30K",
    purpose: "Course ajoutée après le marathon",
    isKey: true,
    priority: "high",
    sessionKey: `s-${planExtensionRaceDay}-1`,
    scheduledOn: planExtensionRaceDay,
  },
];
tables.plan_proposals.push({
  ...readyPlanProposal(
    planReviewUser,
    planReviewPlanId,
    "eeeeeeee-eeee-4eee-8eee-700000000009",
  ),
  scope: "plan",
  origin: "race",
  requested_by: "system",
  title: "Ajoute le Trail des Lacs et prolonge le plan",
  summary: "Le plan continue après le marathon jusqu’au Trail des Lacs.",
  rationale:
    "Tu as ajouté le Trail des Lacs quatre semaines après le marathon. Je garde ta préparation et j’ajoute une récupération puis une reprise.",
  operations: [
    {
      op: "extend_plan",
      previousEndsOn: planRaceDay,
      endsOn: planExtensionRaceDay,
      raceId: planExtensionRaceId,
      role: "secondary",
      blocks: [
        {
          blockKey: "b-recovery-9",
          kind: "recovery",
          name: "Récupération",
          startsOn: planExtensionWeeks[0],
          endsOn: planExtensionRaceDay,
          objective: "Récupérer du marathon puis préparer le trail",
          raceId: planExtensionRaceId,
        },
      ],
      weeks: planExtensionWeeks.map((weekStart) => ({
        weekKey: `w-${weekStart}`,
        weekStart,
        blockKey: "b-recovery-9",
        weekType: "recovery",
        targets: {
          durationSeconds: 2_400,
          distanceMeters: null,
          elevationGainMeters: null,
          qualitySessions: 0,
          longRunSeconds: null,
          intensitySplit: { easyPct: 100, moderatePct: 0, hardPct: 0 },
        },
        notes: null,
      })),
      sessions: planExtensionSessions,
    },
  ],
  target_keys: ["plan:end"],
  created_at: proposalAt(-2, "18:00:00"),
  updated_at: proposalAt(-2, "18:00:00"),
});
twinPlanAthlete(
  planHistoryUser,
  "dddddddd-dddd-4ddd-8ddd-888888888888",
  "8888",
);
twinPlanAthlete(watchUser, "dddddddd-dddd-4ddd-8ddd-abababababab", "abab");
tables.athlete_profiles.push({
  ...structuredClone(tables.athlete_profiles[0]),
  user_id: watchUser.id,
  watch_workouts_enabled: false,
  watch_workouts_synced_key: null,
  watch_workouts_synced_at: null,
});
tables.provider_workouts = [];
function nameMatcher(filter) {
  if (filter.startsWith("imatch.")) return new RegExp(filter.slice(7), "iu");
  const pattern = filter.slice(6).replaceAll("*", "%");
  let expression = "^";
  for (let index = 0; index < pattern.length; index++) {
    const character = pattern[index];
    if (character === "\\" && index + 1 < pattern.length) {
      expression += pattern[++index].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    } else if (character === "%") expression += ".*";
    else if (character === "_") expression += ".";
    else expression += character.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`${expression}$`, "isu");
}

function selectRows(table, params) {
  let rows = tables[table] ?? [];
  if (table.startsWith("provider_"))
    rows = rows.map((row) => ({ provider: "garmin", ...row }));
  if (
    params.get("user_id") === `eq.${recordsEmptyUser.id}` &&
    table.startsWith("provider_")
  )
    return { rows: [], total: 0 };
  const ownerId = params.get("user_id");
  if (ownerId)
    rows = rows.filter(
      (row) => !row.user_id || `eq.${row.user_id}` === ownerId,
    );
  for (const [key, filter] of params) {
    if (filter.startsWith("gte."))
      rows = rows.filter((row) => row[key] >= filter.slice(4));
    if (filter.startsWith("lte."))
      rows = rows.filter((row) => row[key] <= filter.slice(4));
    if (filter === "not.is.null")
      rows = rows.filter((row) => row[key] !== null && row[key] !== undefined);
    if (
      ["metric", "availability", "provider"].includes(key) &&
      filter.startsWith("eq.")
    )
      rows = rows.filter((row) => row[key] === filter.slice(3));
    if (
      ["metric", "availability", "provider"].includes(key) &&
      filter.startsWith("in.(")
    ) {
      const allowed = filter
        .slice(4, -1)
        .split(",")
        .map((item) => item.replace(/"/g, ""));
      rows = rows.filter((row) => allowed.includes(row[key]));
    }
  }
  const nameFilter = params.get("activity_name");
  if (nameFilter && /^(ilike|imatch)\./.test(nameFilter)) {
    const matcher = nameMatcher(nameFilter);
    rows = rows.filter(
      (row) =>
        typeof row.activity_name === "string" &&
        matcher.test(row.activity_name),
    );
  }
  for (const key of ["id", "provider_activity_id"]) {
    const listed = params.get(key)?.match(/^in\.\((.*)\)$/);
    if (listed) {
      const allowed = listed[1]
        .split(",")
        .map((item) => item.replace(/"/g, ""));
      rows = rows.filter((row) => allowed.includes(String(row[key])));
    }
  }
  const id = params.get("id");
  if (id?.startsWith("eq.")) rows = rows.filter((row) => `eq.${row.id}` === id);
  if (table.startsWith("plan_") || table === "session_activity_matches") {
    for (const key of ["plan_id", "version"]) {
      const filter = params.get(key);
      if (filter?.startsWith("eq."))
        rows = rows.filter((row) => String(row[key]) === filter.slice(3));
    }
  }
  if (table === "coach_sessions") {
    const status = params.get("status");
    if (status?.startsWith("eq."))
      rows = rows.filter((row) => row.status === status.slice(3));
  }
  const sessions = params.get("coach_session_id")?.match(/^in\.\((.*)\)$/);
  if (sessions) {
    const allowed = sessions[1]
      .split(",")
      .map((item) => item.replace(/"/g, ""));
    rows = rows.filter((row) => allowed.includes(row.coach_session_id));
  }
  if (table === "coach_thread_items") {
    const kind = params.get("kind");
    if (kind?.startsWith("eq."))
      rows = rows.filter((row) => row.kind === kind.slice(3));
    const threadId = params.get("coach_session_id");
    if (threadId?.startsWith("eq."))
      rows = rows.filter((row) => row.coach_session_id === threadId.slice(3));
    rows = [...rows].sort((a, b) =>
      params.get("order")?.startsWith("id.desc") ? b.id - a.id : a.id - b.id,
    );
  }
  if (table === "coach_sessions")
    rows = [...rows].sort((a, b) =>
      b.last_activity_at.localeCompare(a.last_activity_at),
    );
  if (table === "plan_proposals" || table === "plan_decisions") {
    for (const key of ["status"]) {
      const filter = params.get(key);
      if (filter?.startsWith("eq."))
        rows = rows.filter((row) => String(row[key]) === filter.slice(3));
    }
    const proposals = params.get("proposal_id")?.match(/^in\.\((.*)\)$/);
    if (proposals) {
      const allowed = proposals[1]
        .split(",")
        .map((item) => item.replace(/"/g, ""));
      rows = rows.filter((row) => allowed.includes(row.proposal_id));
    }
    rows = [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  const owner = params.get("activity_id");
  if (owner) rows = rows.filter((row) => `eq.${row.activity_id}` === owner);
  const types = params.get("activity_type")?.match(/^in\.\((.*)\)$/);
  if (types) {
    const allowed = types[1].split(",").map((type) => type.replace(/"/g, ""));
    rows = rows.filter((row) => allowed.includes(row.activity_type));
  }
  if (table === "provider_activities")
    rows = [...rows].sort((a, b) =>
      params.get("order")?.startsWith("max_heart_rate")
        ? (b.max_heart_rate ?? 0) - (a.max_heart_rate ?? 0)
        : params.get("order")?.startsWith("updated_at")
          ? (b.updated_at ?? "").localeCompare(a.updated_at ?? "")
          : b.started_at.localeCompare(a.started_at),
    );
  if (table === "provider_activity_segments")
    rows = [...rows].sort((a, b) => a.segment_index - b.segment_index);
  if (
    table === "provider_activity_tracks" &&
    params.get("select")?.includes("elapsed_s:series")
  )
    rows = rows.map((row) => ({
      ...row,
      elapsed_s: row.series?.elapsed_s ?? null,
      distance_m: row.series?.distance_m ?? null,
      elevation_m: row.series?.elevation_m ?? null,
    }));
  const total = rows.length;
  const offset = Number(params.get("offset")) || 0;
  const limit = Number(params.get("limit"));
  if (offset > 0 || limit > 0)
    rows = rows.slice(offset, limit > 0 ? offset + limit : undefined);
  return { rows, total };
}
const profileImages = new Map();
const events = [];
const links = new Map();
const challenges = new Map();
const requests = new Map();
const port = Number(process.env.PLAYWRIGHT_AUTH_PORT ?? 3200);
const planMatchesSnapshot = {
  matches: structuredClone(tables.session_activity_matches),
  marker: {
    matches_computed_at: tables.training_plans[0].matches_computed_at,
    matches_version: tables.training_plans[0].matches_version,
    matches_activities_through: null,
  },
};

const reviewTables = [...planTables, "plan_proposals", "plan_decisions"];
const planReviewSnapshot = structuredClone(
  Object.fromEntries(
    reviewTables.map((table) => [
      table,
      tables[table].filter((row) => row.user_id === planReviewUser.id),
    ]),
  ),
);
function currentPlanUser(request) {
  return recordsSessions.find(
    (item) => request.headers.authorization === `Bearer ${item.access_token}`,
  )?.user;
}
function decidePlanProposal(request, body, decision) {
  const owner = currentPlanUser(request);
  const proposal = tables.plan_proposals.find(
    (item) => item.id === body.p_proposal_id && item.user_id === owner?.id,
  );
  if (!proposal) return [404, { code: "PT404", message: "not_found" }];
  if (proposal.status !== "ready")
    return [409, { code: "PT409", message: "invalid_state" }];
  proposal.status = decision;
  proposal.updated_at = new Date().toISOString();
  tables.plan_decisions.push({
    id: randomUUID(),
    user_id: owner.id,
    proposal_id: proposal.id,
    decision,
    actor: "athlete",
    note: null,
    resulting_version: null,
    created_at: new Date().toISOString(),
  });
  return [200, proposal];
}
function applyPlanProposal(request, proposalId) {
  const owner = currentPlanUser(request);
  if (!owner) return [401, { code: "PT401", message: "not_authenticated" }];
  const proposal = tables.plan_proposals.find(
    (item) => item.id === proposalId && item.user_id === owner.id,
  );
  if (!proposal) return [404, { code: "PT404", message: "not_found" }];
  if (proposal.status !== "accepted")
    return [409, { code: "PT409", message: "invalid_state" }];
  if (proposal.scope === "new_plan") {
    proposal.status = "applied";
    proposal.applied_version = 1;
    tables.plan_decisions.push({
      id: randomUUID(),
      user_id: owner.id,
      proposal_id: proposal.id,
      decision: "applied",
      actor: "system",
      note: null,
      resulting_version: 1,
      created_at: new Date().toISOString(),
    });
    return [200, 1];
  }
  const plan = tables.training_plans.find(
    (item) => item.id === proposal.plan_id,
  );
  for (const operation of proposal.operations) {
    if (operation.op === "skip_session")
      tables.plan_sessions = tables.plan_sessions.filter(
        (session) =>
          session.plan_id !== plan.id ||
          session.session_key !== operation.sessionKey,
      );
    if (operation.op === "replace_session") {
      const session = tables.plan_sessions.find(
        (item) =>
          item.plan_id === plan.id && item.session_key === operation.sessionKey,
      );
      if (session) session.title = operation.content.title;
    }
  }
  const version = plan.active_version + 1;
  plan.active_version = version;
  plan.matches_version = version;
  tables.plan_versions.find((row) => row.plan_id === plan.id).version = version;
  proposal.status = "applied";
  proposal.applied_version = version;
  tables.plan_decisions.push({
    id: randomUUID(),
    user_id: owner.id,
    proposal_id: proposal.id,
    decision: "applied",
    actor: "system",
    note: null,
    resulting_version: version,
    created_at: new Date().toISOString(),
  });
  return [200, version];
}

createServer(async (request, response) => {
  const url = new URL(request.url, `http://127.0.0.1:${port}`);
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const rawBytes = Buffer.concat(chunks);
  const raw = rawBytes.toString();
  const body =
    raw && !url.pathname.startsWith("/storage/v1/object/")
      ? JSON.parse(raw)
      : {};
  response.setHeader("Content-Type", "application/json");
  const send = (status, value, headers = {}) => {
    response.writeHead(status, headers);
    response.end(JSON.stringify(value));
  };
  if (url.pathname.startsWith("/storage/v1/")) {
    if (
      request.headers.authorization !== `Bearer ${token}` &&
      !url.pathname.startsWith("/storage/v1/object/sign/")
    )
      return send(401, {});
    if (
      url.pathname.startsWith("/storage/v1/object/sign/") &&
      request.method === "POST"
    )
      return send(200, {
        signedURL: `${url.pathname.slice("/storage/v1".length)}?token=fixture`,
      });
    if (
      url.pathname.startsWith("/storage/v1/object/sign/") &&
      request.method === "GET"
    ) {
      const path = url.pathname.replace(
        "/storage/v1/object/sign/",
        "/storage/v1/object/",
      );
      response.writeHead(200, { "Content-Type": "image/png" });
      return response.end(profileImages.get(path));
    }
    if (request.method === "POST") {
      profileImages.set(url.pathname, rawBytes);
      return send(200, { Key: url.pathname });
    }
    if (request.method === "DELETE") return send(200, []);
  }
  if (url.pathname === "/__test__/events") return send(200, events);
  if (
    url.pathname === "/__test__/provider-workouts" &&
    request.method === "PUT"
  ) {
    tables.provider_workouts = tables.provider_workouts
      .filter((row) => row.user_id !== body.user_id)
      .concat(body.rows.map((row) => ({ ...row, user_id: body.user_id })));
    return send(200, { stored: body.rows.length });
  }
  if (
    url.pathname === "/__test__/watch-settings" &&
    request.method === "DELETE"
  ) {
    const profile = tables.athlete_profiles.find(
      (row) => row.user_id === watchUser.id,
    );
    Object.assign(profile, {
      watch_workouts_enabled: false,
      watch_workouts_synced_key: null,
      watch_workouts_synced_at: null,
    });
    tables.provider_workouts = tables.provider_workouts.filter(
      (row) => row.user_id !== watchUser.id,
    );
    return send(200, { reset: true });
  }
  if (url.pathname === "/__test__/link")
    return send(200, { url: links.get(url.searchParams.get("email")) });
  if (url.pathname === "/__test__/expired-session")
    return send(200, {
      ...session,
      access_token: accessToken(Math.floor(Date.now() / 1000) - 60),
      expires_at: Math.floor(Date.now() / 1000) - 60,
    });
  if (
    url.pathname === "/__test__/plan-proposals" &&
    request.method === "DELETE"
  ) {
    const snapshot = structuredClone(planReviewSnapshot);
    for (const table of reviewTables)
      tables[table] = tables[table]
        .filter((row) => row.user_id !== planReviewUser.id)
        .concat(snapshot[table]);
    return send(200, { reset: true });
  }
  if (
    url.pathname === "/__test__/athlete-settings" &&
    request.method === "DELETE"
  ) {
    const profile = tables.athlete_profiles[0];
    Object.assign(profile, structuredClone(profileSnapshot), {
      revision: profile.revision,
      updated_at: profile.updated_at,
    });
    tables.athlete_unavailability = tables.athlete_unavailability.filter(
      (row) => row.user_id !== user.id,
    );
    return send(200, { reset: true });
  }
  if (url.pathname === "/__test__/coach" && request.method === "DELETE") {
    const snapshot = structuredClone(coachSnapshot);
    for (const table of coachTables)
      tables[table] = tables[table]
        .filter((row) => row.user_id !== coachUser.id)
        .concat(snapshot[table]);
    return send(200, { reset: true });
  }
  if (url.pathname === "/__test__/coach-turn" && request.method === "POST") {
    const row = tables.coach_sessions.find(
      (session) => session.id === body.threadId,
    );
    if (!row) return send(404, {});
    Object.assign(row, body.session ?? {});
    for (const item of body.items ?? [])
      tables.coach_thread_items.push({
        id: ++coachItemId,
        user_id: row.user_id,
        coach_session_id: row.id,
        kind: item.kind,
        body: item.body,
        created_at: new Date().toISOString(),
      });
    return send(200, { ok: true });
  }
  if (url.pathname === "/__test__/plan-import" && request.method === "POST") {
    if (
      !tables.provider_activities.some(
        (row) => row.id === planImportedActivityId,
      )
    )
      tables.provider_activities.push({
        ...activity(5001, 0, {
          activity_name: "Footing importé",
          distance_meters: 8100,
          duration_seconds: 2760,
          average_heart_rate: 141,
        }),
        user_id: planUser.id,
        started_at: `${planMissedSession.scheduled_on}T05:40:00Z`,
        local_started_at: `${planMissedSession.scheduled_on} 07:40:00`,
        imported_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    return send(200, { sessionKey: planMissedSession.session_key });
  }
  if (url.pathname === "/__test__/plan-import" && request.method === "DELETE") {
    tables.provider_activities = tables.provider_activities.filter(
      (row) => row.id !== planImportedActivityId,
    );
    tables.session_activity_matches = structuredClone(
      planMatchesSnapshot.matches,
    );
    Object.assign(
      tables.training_plans.find((row) => row.id === planId),
      planMatchesSnapshot.marker,
    );
    return send(200, { reset: true });
  }
  if (
    ["/__test__/race-course", "/__test__/race-road"].includes(url.pathname) &&
    request.method === "POST"
  ) {
    const road = url.pathname === "/__test__/race-road";
    const race = tables.athlete_races[0];
    race.name = road ? "10 km de Paris" : "EcoTrail Paris 120K";
    race.race_kind = road ? "road" : "trail";
    race.distance_km = road ? 10 : 120;
    race.elevation_gain_m = road ? 25 : 1800;
    race.target_duration_seconds = road ? 39 * 60 : 21600;
    race.race_date = new Date(Date.now() + 2 * day).toISOString().slice(0, 10);
    tables.race_plans = [
      {
        race_id: race.id,
        user_id: user.id,
        start_time: "08:00:00",
        start_time_confirmed: true,
        ambitious_duration_seconds: road ? null : 19800,
        cautious_duration_seconds: road ? null : 25200,
        cutoff_duration_seconds: road ? null : 28800,
        labels: [],
        walk_grade_percent: 10,
        walk_pace_seconds_per_km: 690,
        aid_stop_seconds: 300,
        water_stop_seconds: 120,
        carbs_per_hour_g: 60,
        water_ml_per_hour: 450,
        sodium_mg_per_hour: 500,
        nutrition_alarm_minutes: 20,
        night_caffeine: true,
        roadbook_import: null,
        revision: 1,
      },
    ];
    tables.race_courses = [
      {
        race_id: race.id,
        user_id: user.id,
        source: "gpx",
        file_name: "parcours-test.gpx",
        source_activity_id: null,
        time_zone: "Europe/Paris",
        distance_m: road ? 10000 : 30000,
        elevation_gain_m: road ? 25 : 600,
        elevation_loss_m: road ? 20 : 580,
        step_m: 1000,
        points: Array.from({ length: road ? 11 : 31 }, (_, index) => [
          48.8 + index * 0.009,
          2.3 + Math.sin(index / 4) * 0.01,
          road
            ? 100 + index * 0.5 + Math.sin(index) * 2
            : 100 + index * 2 + Math.sin(index) * 20,
        ]),
        imported_at: new Date().toISOString(),
      },
    ];
    tables.race_waypoints = (
      road
        ? [
            ["start", "Départ", 0],
            ["finish", "Arrivée", 10000],
          ]
        : [
            ["start", "Départ", 0],
            ["aid", "Ravito du Bois", 10000],
            ["water", "Point d’eau", 20000],
            ["finish", "Arrivée", 30000],
          ]
    ).map(([kind, name, distance], index) => ({
      id: `cccccccc-cccc-4ccc-8ccc-${String(index + 1).padStart(12, "0")}`,
      race_id: race.id,
      user_id: user.id,
      kind,
      name,
      distance_m: distance,
      cutoff_time: null,
      services: kind === "aid" || kind === "water" ? ["water"] : [],
      watch_label: null,
      alert_distance_m: kind === "aid" || kind === "water" ? 500 : 0,
      voice_note: null,
      todo: null,
      nutrition_note: null,
      source: "course",
      needs_review: false,
      revision: 1,
    }));
    return send(200, { ready: true });
  }
  if (url.pathname === "/") return send(200, { ready: true });
  events.push({
    method: request.method,
    path: url.pathname,
    scope: url.searchParams.get("scope"),
    email: body.email,
    grant: url.searchParams.get("grant_type"),
  });
  if (url.pathname === "/auth/v1/token") {
    const grant = url.searchParams.get("grant_type");
    const recordsSession = recordsSessions.find(
      (item) => item.user.email === body.email,
    );
    if (
      grant === "password" &&
      recordsSession &&
      body.password === "TrailMiles2026!"
    )
      return send(200, recordsSession);
    if (
      grant === "password" &&
      body.email === "confirmation@example.com" &&
      body.password === "TrailMiles2026!"
    )
      return send(400, {
        error_code: "email_not_confirmed",
        msg: "Email not confirmed",
      });
    const challenge = challenges.get(body.auth_code);
    const valid =
      grant === "password"
        ? body.email === user.email && body.password === "TrailMiles2026!"
        : grant === "refresh_token"
          ? body.refresh_token === session.refresh_token
          : challenge &&
            typeof body.code_verifier === "string" &&
            createHash("sha256")
              .update(body.code_verifier)
              .digest("base64url") === challenge;
    if (valid && grant === "pkce") challenges.delete(body.auth_code);
    return valid
      ? send(200, session)
      : send(400, { code: "invalid_credentials", msg: "Invalid credentials" });
  }
  if (url.pathname === "/auth/v1/signup")
    return send(
      200,
      body.email === "confirmation@example.com"
        ? { user: { ...user, email: body.email }, session: null }
        : session,
    );
  if (url.pathname === "/auth/v1/resend") return send(200, {});
  if (["/auth/v1/otp", "/auth/v1/recover"].includes(url.pathname)) {
    if (body.email === "unavailable@example.com")
      return send(503, { code: "unexpected_failure", msg: "Unavailable" });
    const count = (requests.get(body.email) ?? 0) + 1;
    requests.set(body.email, count);
    if (body.email === "resend-failure@example.com" && count > 1)
      return send(429, {
        code: "over_email_send_rate_limit",
        msg: "Rate limited",
      });
    const code = randomUUID();
    challenges.set(code, body.code_challenge);
    const link = new URL(
      url.searchParams.get("redirect_to") ?? body.redirect_to,
    );
    link.searchParams.set("code", code);
    links.set(body.email, link.toString());
    return send(200, {});
  }
  if (url.pathname === "/auth/v1/verify")
    return body.token_hash === "valid-token"
      ? send(200, session)
      : send(403, { code: "otp_expired", msg: "Expired" });
  const recordsSession = recordsSessions.find(
    (item) => request.headers.authorization === `Bearer ${item.access_token}`,
  );
  if (url.pathname === "/auth/v1/user" && recordsSession)
    return send(200, recordsSession.user);
  if (url.pathname === "/auth/v1/user")
    return request.headers.authorization === `Bearer ${token}`
      ? send(200, user)
      : send(401, { msg: "Unauthorized" });
  if (url.pathname === "/auth/v1/logout") return send(204, undefined);
  if (url.pathname.startsWith("/rest/v1/")) {
    if (
      url.pathname === "/rest/v1/provider_activities" &&
      url.searchParams.get("activity_name")?.includes("loading-fixture")
    )
      await new Promise((resolve) => setTimeout(resolve, 6000));
    if (
      url.pathname === "/rest/v1/provider_activity_tracks" &&
      url.searchParams.get("activity_id") ===
        "eq.aaaaaaaa-aaaa-4aaa-8aaa-000000000168"
    )
      await new Promise((resolve) => setTimeout(resolve, 6000));
    if (request.headers.authorization !== `Bearer ${token}` && !recordsSession)
      return send(401, { message: "JWT required" });
    if (
      recordsSession?.user.id === recordsGoalFailureUser.id &&
      url.pathname === "/rest/v1/athlete_races"
    )
      return send(503, { message: "Records fixture goal read failure" });
    if (
      recordsSession?.user.id === recordsFailureUser.id &&
      url.pathname === "/rest/v1/provider_activity_tracks"
    )
      return send(503, { message: "Records fixture read failure" });
    if (
      request.method === "POST" &&
      [
        "/rest/v1/rpc/accept_plan_proposal",
        "/rest/v1/rpc/reject_plan_proposal",
      ].includes(url.pathname)
    ) {
      const [status, value] = decidePlanProposal(
        request,
        body,
        url.pathname.endsWith("accept_plan_proposal") ? "accepted" : "rejected",
      );
      return send(status, value);
    }
    if (
      request.method === "POST" &&
      url.pathname === "/rest/v1/rpc/apply_accepted_plan_proposal"
    ) {
      const [status, value] = applyPlanProposal(request, body.p_proposal_id);
      return send(status, value);
    }
    if (
      request.method === "POST" &&
      url.pathname === "/rest/v1/rpc/refresh_session_matches"
    ) {
      const plan = tables.training_plans.find(
        (item) =>
          item.id === body.p_plan_id &&
          item.user_id === (recordsSession?.user.id ?? user.id) &&
          item.status === "active",
      );
      if (!plan) return send(404, { code: "PT404", message: "not_found" });
      if (plan.active_version !== body.p_version)
        return send(409, { code: "PT409", message: "stale_version" });
      const athlete = tables.session_activity_matches.filter(
        (row) => row.plan_id === plan.id && row.method === "athlete",
      );
      const recorded = body.p_matches.filter(
        (match) =>
          !athlete.some(
            (row) =>
              row.session_key === match.sessionKey ||
              row.activity_id === match.activityId,
          ),
      );
      tables.session_activity_matches = tables.session_activity_matches
        .filter(
          (row) =>
            row.plan_id !== plan.id ||
            row.method !== "auto" ||
            !recorded.some(
              (match) =>
                match.sessionKey === row.session_key ||
                match.activityId === row.activity_id,
            ),
        )
        .concat(
          recorded.map((match) => ({
            user_id: plan.user_id,
            plan_id: plan.id,
            session_key: match.sessionKey,
            activity_id: match.activityId,
            method: "auto",
            status: match.status,
            confidence: match.confidence,
            compliance: match.compliance,
            algorithm_version: body.p_algorithm_version,
          })),
        );
      Object.assign(plan, {
        matches_computed_at: new Date().toISOString(),
        matches_version: plan.active_version,
        matches_activities_through: body.p_activities_through ?? null,
      });
      return send(200, recorded.length);
    }
    if (
      request.method === "PATCH" &&
      url.pathname === "/rest/v1/athlete_profiles"
    ) {
      if (
        Object.keys(body).every(
          (key) => key.endsWith("_face") || key.startsWith("watch_workouts_"),
        )
      ) {
        const owner = tables.athlete_profiles.find(
          (row) => url.searchParams.get("user_id") === `eq.${row.user_id}`,
        );
        if (owner) Object.assign(owner, body);
        return send(200, owner ? [{ user_id: owner.user_id }] : []);
      }
      const profile = tables.athlete_profiles[0];
      if (
        url.searchParams.get("user_id") !== `eq.${user.id}` ||
        url.searchParams.get("revision") !== `eq.${profile.revision}`
      )
        return send(200, []);
      Object.assign(profile, body, {
        revision: profile.revision + 1,
        updated_at: new Date().toISOString(),
      });
      return send(200, [profile]);
    }
    if (
      request.method === "PATCH" &&
      url.pathname === "/rest/v1/athlete_goals"
    ) {
      const goal = tables.athlete_goals[0];
      if (
        url.searchParams.get("user_id") !== `eq.${user.id}` ||
        url.searchParams.get("revision") !== `eq.${goal.revision}`
      )
        return send(200, []);
      Object.assign(goal, body, {
        revision: goal.revision + 1,
        updated_at: new Date().toISOString(),
      });
      return send(200, [goal]);
    }
    if (request.method === "PATCH" && url.pathname === "/rest/v1/race_plans") {
      const plan = tables.race_plans.find(
        (item) =>
          url.searchParams.get("race_id") === `eq.${item.race_id}` &&
          url.searchParams.get("user_id") === `eq.${item.user_id}` &&
          url.searchParams.get("revision") === `eq.${item.revision}`,
      );
      if (!plan) return send(200, []);
      Object.assign(plan, body, { revision: plan.revision + 1 });
      return send(200, [plan]);
    }
    if (
      request.method === "POST" &&
      url.pathname === "/rest/v1/athlete_wellness_checkins"
    ) {
      const existing = tables.athlete_wellness_checkins.find(
        (item) => item.checkin_date === body.checkin_date,
      );
      const checkin = {
        legs: null,
        soreness: null,
        stress: null,
        ...existing,
        ...body,
        updated_at: new Date().toISOString(),
      };
      tables.athlete_wellness_checkins = tables.athlete_wellness_checkins
        .filter((item) => item !== existing)
        .concat(checkin);
      return send(201, checkin);
    }
    if (url.pathname === "/rest/v1/athlete_unavailability") {
      if (request.method === "POST") {
        tables.athlete_unavailability.push({
          id: randomUUID(),
          kind: "other",
          reason: null,
          ...body,
          revision: 1,
        });
        return send(201, undefined);
      }
      if (request.method === "DELETE") {
        tables.athlete_unavailability = tables.athlete_unavailability.filter(
          (item) => url.searchParams.get("id") !== `eq.${item.id}`,
        );
        return send(204, undefined);
      }
    }
    if (
      url.pathname === "/rest/v1/coach_sessions" &&
      request.method === "DELETE"
    ) {
      const owner = url.searchParams.get("user_id");
      const id = url.searchParams.get("id");
      const deleted = tables.coach_sessions.filter(
        (row) => `eq.${row.user_id}` === owner && `eq.${row.id}` === id,
      );
      const ids = deleted.map((row) => row.id);
      tables.coach_sessions = tables.coach_sessions.filter(
        (row) => !ids.includes(row.id),
      );
      tables.coach_thread_items = tables.coach_thread_items.filter(
        (row) => !ids.includes(row.coach_session_id),
      );
      for (const proposal of tables.plan_proposals)
        if (ids.includes(proposal.coach_session_id))
          proposal.coach_session_id = null;
      return send(
        200,
        deleted.map((row) => ({ id: row.id })),
      );
    }
    if (url.pathname === "/rest/v1/athlete_races") {
      if (request.method === "POST") {
        const race = {
          id: randomUUID(),
          user_id: user.id,
          name: null,
          race_kind: "road",
          race_date: null,
          distance_km: null,
          elevation_gain_m: null,
          priority: "A",
          target_duration_seconds: null,
          ...body,
          revision: 1,
          updated_at: new Date().toISOString(),
        };
        tables.athlete_races.push(race);
        return send(201, [race]);
      }
      if (request.method === "PATCH") {
        const race = tables.athlete_races.find(
          (item) =>
            url.searchParams.get("id") === `eq.${item.id}` &&
            url.searchParams.get("revision") === `eq.${item.revision}`,
        );
        if (!race) return send(200, []);
        Object.assign(race, body, {
          revision: race.revision + 1,
          updated_at: new Date().toISOString(),
        });
        return send(200, [race]);
      }
      if (request.method === "DELETE") {
        const ids =
          url.searchParams
            .get("id")
            ?.match(/^in\.\((.+)\)$/)?.[1]
            .split(",") ?? [];
        tables.athlete_races = tables.athlete_races.filter(
          (item) => !ids.includes(item.id),
        );
        return send(204, undefined);
      }
    }
    if (
      url.pathname === "/rest/v1/activity_shoe_decisions" &&
      request.method === "POST"
    ) {
      const decision = Array.isArray(body) ? body[0] : body;
      tables.activity_shoe_decisions = tables.activity_shoe_decisions
        .filter(
          (item) =>
            item.user_id !== decision.user_id ||
            item.provider_activity_id !== decision.provider_activity_id,
        )
        .concat(decision);
      return send(201, undefined);
    }
    if (url.pathname === "/rest/v1/plan_session_shoe_choices") {
      const key = url.searchParams.get("session_key")?.slice(3);
      if (request.method === "POST") {
        const choice = Array.isArray(body) ? body[0] : body;
        tables.plan_session_shoe_choices = tables.plan_session_shoe_choices
          .filter(
            (item) =>
              item.user_id !== choice.user_id ||
              item.session_key !== choice.session_key,
          )
          .concat(choice);
        return send(201, undefined);
      }
      if (request.method === "DELETE") {
        tables.plan_session_shoe_choices =
          tables.plan_session_shoe_choices.filter(
            (item) =>
              `eq.${item.user_id}` !== url.searchParams.get("user_id") ||
              item.session_key !== key,
          );
        return send(204, undefined);
      }
    }
    const { rows, total } = selectRows(url.pathname.slice(9), url.searchParams);
    return send(200, rows, {
      "Content-Range": rows.length
        ? `0-${rows.length - 1}/${total}`
        : `*/${total}`,
    });
  }
  return send(404, { msg: "Unknown fixture endpoint" });
}).listen(port, "127.0.0.1");

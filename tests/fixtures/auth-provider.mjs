import { createServer } from "node:http";
import { createHmac, createHash, randomUUID } from "node:crypto";

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
const recordsSessions = [
  recordsEmptyUser,
  recordsFailureUser,
  recordsGoalFailureUser,
  planUser,
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
const tables = {
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
      .filter(({ date }) => date <= planRaceDay);
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
  started_at: new Date(planDoneStart).toISOString(),
  local_started_at: `${planDoneSession.scheduled_on} 19:12:00`,
});
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
const nextPlanSession = planSessions.find(
  (session) => session.scheduled_on > planToday && session.kind !== "race",
);
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
  plan_proposals: nextPlanSession
    ? [
        {
          id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
          user_id: planUser.id,
          plan_id: planId,
          status: "ready",
          title: "Raccourcir la séance",
          target_keys: [`session:${nextPlanSession.session_key}`],
          created_at: `${planToday}T06:00:00Z`,
        },
      ]
    : [],
});
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
  const id = params.get("id");
  if (id) rows = rows.filter((row) => `eq.${row.id}` === id);
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
      return send(200, { signedURL: url.pathname + "?token=fixture" });
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
  if (url.pathname === "/__test__/link")
    return send(200, { url: links.get(url.searchParams.get("email")) });
  if (url.pathname === "/__test__/expired-session")
    return send(200, {
      ...session,
      access_token: accessToken(Math.floor(Date.now() / 1000) - 60),
      expires_at: Math.floor(Date.now() / 1000) - 60,
    });
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
      request.method === "PATCH" &&
      url.pathname === "/rest/v1/athlete_profiles"
    ) {
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
    const { rows, total } = selectRows(url.pathname.slice(9), url.searchParams);
    return send(200, rows, {
      "Content-Range": rows.length
        ? `0-${rows.length - 1}/${total}`
        : `*/${total}`,
    });
  }
  return send(404, { msg: "Unknown fixture endpoint" });
}).listen(port, "127.0.0.1");

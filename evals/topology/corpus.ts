export type CorpusSection = {
  id: "periodization" | "race" | "health" | "fueling" | "sessions";
  title: string;
  summary: string;
  body: string;
};

export const corpus: CorpusSection[] = [
  {
    id: "periodization",
    title: "Periodization and load management",
    summary:
      "Phases, weekly volume progression, recovery weeks, long-run share, intensity distribution, taper.",
    body: `- Start from what the athlete already holds: the first planned week is close to the average of the last four weeks (within 10%), never above the highest recent week.
- Weekly running time rises by at most 10% per week; above 10% is a warning, above 30% is a strong warning.
- Every third or fourth week is a recovery week at 20-30% less time, without the hardest session.
- Phases: base (aerobic volume, strides), build (threshold and interval work added), specific (race-pace and race-terrain work), taper, race. Short plans compress base and build but keep a taper.
- No single session exceeds 1.1 times the longest run of the last 30 days; 1.3 times is a strong warning. Grow the long run by 10-15 minutes per week at most.
- The long run is at most 35% of weekly running time when the athlete runs four or more times a week.
- About 80% of running time is easy; hard time (threshold, interval, repetition) stays under 25% of the week. At most two quality sessions a week, or one for novices and athletes returning from a break.
- Taper: the last two weeks before a race of 10 km or more cut volume by 40-60% from the peak while keeping short race-pace touches; no quality in the two days before the race.
- Peak volume must stay achievable from the current level within the available weeks; if the target needs more, lower the ambition and say so instead of overloading.`,
  },
  {
    id: "race",
    title: "Race and terrain specificity",
    summary:
      "Road 10 km to marathon specifics, trail and ultra demands, elevation, back-to-back runs, preparation races, target realism.",
    body: `- 10 km: VO2max intervals (3-5 min at 5 km pace) and threshold work; specific blocks at 10 km pace in the last four weeks.
- Half marathon: threshold blocks (2-3 x 10-15 min), half-pace segments inside long runs in the specific phase.
- Marathon: long runs up to 2 h 45-3 h, marathon-pace segments growing to 12-16 km inside long runs; fueling practised on every long run over 90 minutes.
- Trail: weekly elevation grows by at most 15% per week; hill repeats, uphill hiking with poles for steep races, technical descents practised; prescribe long runs in time and elevation, not pace.
- Ultra (above 42.2 km): back-to-back long runs on the weekend in the specific phase, night or race-terrain rehearsal, long runs reaching about 70% of the expected race duration only when the history supports it; above 60 km the plan carries a low-confidence note. After an ultra, three days without running.
- Preparation races: a B or C race two to four weeks before the A race is a hard workout with a two- or three-day mini-taper and two easy days after; it never replaces the A-race taper.
- Target realism: compare the target with recent results (Riegel-style equivalence). If the target needs more than about 5% improvement per three months of training, or the history is shorter than eight weeks, do not plan for it: plan for a realistic target, state it, and explain why.`,
  },
  {
    id: "health",
    title: "Health and recovery",
    summary:
      "Pain and illness reports, stop and referral rules, readiness, spacing of hard sessions, recovery placement.",
    body: `- Pain with severity 7 or more out of 10, worsening pain, systemic symptoms or a red flag: no running for at least seven days, advise a consultation with a doctor or physiotherapist, and plan only rest, mobility or cross-training without impact until the athlete reports improvement. The plan resumes with easy running only, then reintroduces quality progressively.
- Pain with severity 4 to 6 that is stable: no quality sessions for three days, reduce volume, monitor.
- A red readiness day means no quality that day.
- Leave at least 48 hours between two hard sessions; never schedule quality the day after the long run or the day before it.
- After a race or a peak week, plan easy days before the next quality.
- Novices and athletes returning from a break need more recovery: one quality session a week at most, run-walk if continuous running is not yet easy.
- Strength and mobility twice a week reduce injury risk; keep them on easy days or after easy runs.`,
  },
  {
    id: "fueling",
    title: "Fueling and hydration",
    summary:
      "Carbohydrate intake on long runs and races, hydration, gut training, weight guidance.",
    body: `- Sessions over 90 minutes: practise 30-60 g of carbohydrate per hour; ultra preparation trains the gut towards 60-90 g per hour.
- Rehearse the race-day fueling and drinking plan on the last two or three long runs.
- Drink to thirst, about 400-800 ml per hour depending on heat; add sodium on long or hot sessions.
- Never prescribe a race-weight or weight-loss target; low energy availability harms health and performance (RED-S).
- Plan race-week carbohydrate loading only for races over 90 minutes.`,
  },
  {
    id: "sessions",
    title: "Session design and training paces",
    summary:
      "Intensity zones from threshold pace and heart rate, structured steps, warm-up and cool-down, novices and missing calibration.",
    body: `- Zones from the threshold pace (T) and lactate-threshold heart rate (LTHR): recovery slower than T + 90 s/km or under 75% LTHR; easy T + 60-90 s/km or 75-85% LTHR; marathon T + 15-25 s/km; threshold T to T + 5 s/km or 95-100% LTHR; interval about T - 15 to T - 25 s/km; repetition faster, short with full recovery.
- Every quality session has a warm-up of 10-20 minutes, structured work with a target per work step, recoveries, and a cool-down.
- Easy and long runs carry a heart-rate range or an easy pace range; trail long runs carry a heart-rate or RPE target because pace is not meaningful on climbs.
- Without a threshold calibration, use RPE (easy 3-4, threshold 6-7, interval 8) and conservative pace ranges from recent results.
- Novices: easy runs by time with RPE, strides for speed, run-walk when needed.
- Keep sessions within the athlete's available days and maximum weekday duration; put the long run on the day with the most time.`,
  },
];

export function corpusSection(id: CorpusSection["id"]) {
  const section = corpus.find((candidate) => candidate.id === id);
  if (!section) throw new Error(`Unknown corpus section ${id}`);
  return `## ${section.title}\n${section.body}`;
}

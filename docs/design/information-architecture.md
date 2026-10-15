# Product information architecture

- Status: Proposed for discovery
- Inputs: [Product brief](../product/brief.md), [draft PRD](../product/prd.md), and [design system direction](design-system.md)

## Navigation recommendation

Use a small set of athlete jobs as the primary navigation. Do not expose every data domain or AI specialist as a top-level destination.

| Destination | Athlete question                             | Candidate contents                                                       |
| ----------- | -------------------------------------------- | ------------------------------------------------------------------------ |
| Today       | What matters for my next training decision?  | Next session, concise context, readiness caveats, and a route into Coach |
| Plan        | What am I training toward, and what is next? | Weekly plan, goal event, schedule, and reviewed plan changes             |
| Activities  | What have I done?                            | Road and trail history, activity details, and sync freshness             |
| Progress    | How is my training changing over time?       | Fitness, recovery, health and records from documented, tested measures   |
| Coach       | What should I understand or discuss?         | Context-aware conversation and explainable proposals                     |

A destination appears in the application navigation only once it is backed by real data; there are no placeholder entries. Activities and Courses are available to onboarded athletes. Until Today exists, athletes land on `/activities`. Activity list and detail show only stored Garmin values with their provenance; the selected preview reuses the full-detail route map, altitude profile and recorded pace/heart-rate charts. Desktop automatically previews the newest result; mobile shows the list first and opens the selected preview separately. Plan compliance, coach analysis, natural-language search and the race filter remain unavailable because their source capabilities do not exist. Sync times and the athlete's current day use the Europe/Paris time zone.

On desktop the application shell is fixed to the viewport height and the page itself never scrolls. Each pane scrolls on its own: the Activities list keeps its title, search and filters fixed with sticky period headers, and the detail keeps its header fixed while its content scrolls. The list shows 50 activities at a time with a count and a load-more action, and remembers its scroll position when an activity is opened. Selection, type filter, literal imported-name search and the loaded window live in the URL and survive full-detail navigation and return. Name search runs before counting and pagination, ignores case and treats wildcards and punctuation literally; submitting a new search resets the loaded window. Empty results retain the search and type controls.

`/activities/[id]/details` is the full-page detail reached from the activity panel. It shows the kicker, headline measures, a laps table from stored `lap` rows (falling back to `split` rows, shown only with at least two segments) and an effort panel with only the stored measures, each marked with its Garmin provenance. The detail also shows the route map and profile, recorded charts, estimated time in zones and imported perceived effort when available. Coach analysis, prescribed targets and compliance are omitted because no source data supports them. The preview leads with three available distance/time/heart-rate measures, falls back to other recorded measures, and shows factual effort without presenting it as coach advice. Missing GPS has an explicit message while available heart-rate samples remain inspectable. On narrow screens the table keeps time, distance, pace and heart rate.

Account, data connections, permissions, and preferences belong in a secondary profile/settings area. Courses is a dedicated destination for the preparation of an athlete's goal races. `/races` lists the athlete's races: an upcoming, past and all filter kept in the URL, a season timeline with indicative phases, the featured race (highest priority, then nearest date) with its countdown, profile, preparation checklist and next step, the other upcoming races, and past races. Every figure comes from stored race data or the computed course; there are no invented results or coach advice. A dashed slot suggests a B race when the featured race is an A race and none is planned. Race workspaces live under `/races/<id>`. Athletes choose road or trail when creating a race and can change it later. Road races focus on the course, target pace, concise weather and race-week preparation. Trail races also expose Roadbook, Nutrition, Équipement, walking and night analysis, and a waypoint editor. A course import is available from the race header for both. The sidebar lists the athlete's races under Objectifs. Course-derived measures, simulations and weather carry their source or an explicit empty state when unavailable.

Plan shows the athlete's active stored plan. `/plan` is the Programme complet: one tab per race of the plan (a secondary race attached to blocks opens its own program with `?race=`), the weekly volume chart with a selectable week (kept in `?week=`, ← → on desktop), the selected week's days and progress, and milestones derived from the plan. The sidebar lists blocks and weeks while Plan is open. Plan is a single page: there is no separate week list or session page. Opening a session shows it in a side panel on desktop and a bottom sheet on mobile, with previous and next sessions of the week, ← → and Échap; the session is kept in `?seance=<key>` next to `?race=` and `?week=`, so loading that URL directly opens Plan with the same panel, and an unknown key shows Plan without a panel. A completed session compares planned and completed values from the matched Garmin activity. Accepting proposals, moving or replacing sessions, sending to the watch, changing the matched activity and coach comments wait for their capabilities.

Progression is a destination between Activités and Courses. While it is open, the sidebar lists its sections under Progression. `/progress` is the Forme section: a period selector (6 weeks, 12 weeks, 6 months, 1 year, kept in the URL), the Garmin condition/fatigue/freshness chart, measure rows with sparklines, race predictions, weekly hours and records. Headline, summary and coach note are deterministic statements from computed facts. Measures without enough data show an explicit unavailable state; consistency waits for training plans. `/progress/recovery` is the Récupération section: Garmin readiness with each signal's gap to its baseline, sleep, nightly HRV and resting heart rate cards, a daily check-in (legs, soreness, stress) saved by the athlete, and HRV recovery after past races. Plan changes wait for training plans. `/progress/health` is the Santé section with Jour, Semaine and Mois views: a deterministic reading, six daily indicators, then sleep, HRV and resting HR, energy, and load panels. Coach questions and plan actions from the reference wait for their capabilities. Definitions are in [Progress measures](../architecture/progress.md).

`/progress/records` completes the Progression sections. It shows a deterministic reading, inspectable record chronology, six expandable road effort histories, six endurance cards, an explicit unavailable completed-race section and factual comparisons with upcoming goals. The URL preserves `filter=all|road|trail`. Mobile keeps the reading and chronology first, road disclosures inline and endurance cards in two columns; desktop uses three endurance columns. Values disclose Garmin provenance and Stride estimation, with linked source activities. Import failures remain distinct from an empty history.

The race profile keeps passage labels short so nearby waypoints remain readable. Hovering or focusing a waypoint badge reveals its full name and passage details in a row below the chart. Inspecting the elevation line uses the same row, leaving the plotted data visible.

The secondary `/settings` area now links from the account menu and contains the overview, profile, training availability, goals and races, Garmin connection status, and data/privacy pages. Profile and training edits reuse the onboarding records and preserve Garmin provenance on unchanged values. Goal and race edits use the same persisted records and revision checks. Connection pages show observed integration status and stored counts; they do not offer manual sync, reconnect or disconnect until the Garmin service exposes those operations. Data/privacy provides an authenticated JSON copy of profile, goal and race records. Coach preferences, notifications, athlete-model percentages, Garmin activity export and deletion controls await their underlying capabilities.

## Primary navigation paths

1. First session: Today explains the next step and guides the athlete to complete only the context needed to get value.
2. Training review: Today or Plan opens a weekly proposal; a decision links to the evidence and Coach for questions.
3. Activity review: Activities opens an individual run, then offers relevant trends or a coaching question.
4. Event preparation: Courses opens the next priority race and its course, passage plan, nutrition, equipment and preparation checklists.

## Information hierarchy

- Lead with the next decision, not a grid of all available metrics.
- Keep source, freshness, and uncertainty next to the data they qualify.
- Put detailed calculations and activity fields behind a clear drill-down.
- Keep Coach available from relevant contexts and pass only authorized context to it.
- Use the same activity concepts for road and trail while allowing terrain-specific detail where it changes interpretation.

## Open UX questions

- Does an athlete think first in terms of a weekly plan or a daily recommendation?
- Should Coach be a persistent destination, a contextual action, or both?
- Which metrics are understandable and useful to the initial athlete segment?

Validate these choices with the selected athlete journey before designing a full screen inventory.

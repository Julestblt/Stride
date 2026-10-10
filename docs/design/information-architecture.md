# Product information architecture

- Status: Proposed for discovery
- Inputs: [Product brief](../product/brief.md), [draft PRD](../product/prd.md), and [design system direction](design-system.md)

## Navigation recommendation

Use a small set of athlete jobs as the primary navigation. Do not expose every data domain or AI specialist as a top-level destination.

| Destination | Athlete question                             | Candidate contents                                                                      |
| ----------- | -------------------------------------------- | --------------------------------------------------------------------------------------- |
| Today       | What matters for my next training decision?  | Next session, concise context, readiness caveats, and a route into Coach                |
| Plan        | What am I training toward, and what is next? | Weekly plan, goal event, schedule, and reviewed plan changes                            |
| Activities  | What have I done?                            | Road and trail history, activity details, and sync freshness                            |
| Progress    | How is my training changing over time?       | Fitness and training trends, introduced only when the underlying measures are validated |
| Coach       | What should I understand or discuss?         | Context-aware conversation and explainable proposals                                    |

A destination appears in the application navigation only once it is backed by real data; there are no placeholder entries. Activities is the first implemented destination, so onboarded athletes land on `/activities` until Today exists. Activity list and detail show only stored Garmin values with their provenance; plan compliance, coach analysis, charts, laps, natural-language search and the race filter from the references arrive with the capabilities they depend on. Sync times and the athlete's current day use the Europe/Paris time zone.

On desktop the application shell is fixed to the viewport height and the page itself never scrolls. Each pane scrolls on its own: the Activities list keeps its title, search and filters fixed with sticky period headers, and the detail keeps its header fixed while its content scrolls. The list shows 50 activities at a time with a count and a load-more action, and remembers its scroll position when an activity is opened. Selection and the loaded window live in the URL.

`/activities/[id]/details` is the full-page detail reached from the activity panel. It shows the kicker, headline measures, a laps table from stored `lap` rows (falling back to `split` rows, shown only with at least two segments) and an effort panel with only the stored measures, each marked with its Garmin provenance. The reference's coach analysis, plan targets, charts, time in zone, route map and perceived effort are omitted until their data exists. On narrow screens the table keeps time, distance, pace and heart rate.

Account, data connections, permissions, and preferences belong in a secondary profile/settings area. Race planning should appear within Plan when a goal race exists; a dedicated Races destination should be added only if race tasks form a frequent, distinct journey.

## Primary navigation paths

1. First session: Today explains the next step and guides the athlete to complete only the context needed to get value.
2. Training review: Today or Plan opens a weekly proposal; a decision links to the evidence and Coach for questions.
3. Activity review: Activities opens an individual run, then offers relevant trends or a coaching question.
4. Event preparation: Plan opens the goal event and its preparation milestones; detailed course and race strategy can arrive later.

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
- Does a race need its own workspace before the product supports course analysis?

Validate these choices with the selected athlete journey before designing a full screen inventory.

# Product information architecture

- Status: Proposed for discovery
- Inputs: [Product brief](../product/brief.md), [draft PRD](../product/prd.md), and [design system direction](design-system.md)

## Approved navigation direction

Use the six athlete destinations shown in the approved system reference. Do not expose every data domain or AI specialist as a top-level destination.

| Destination | Athlete question                             | Candidate contents                                                               |
| ----------- | -------------------------------------------- | -------------------------------------------------------------------------------- |
| Today       | What matters for my next training decision?  | Next session, concise context, readiness caveats, and recent run                 |
| Coach       | What should I understand or discuss?         | Context-aware conversation, open decisions, and explainable proposals            |
| Plan        | What am I training toward, and what is next? | Weekly plan, goal event, schedule, and reviewed plan changes                     |
| Activities  | What have I done?                            | Road and trail history, activity details, plan versus actual, and sync freshness |
| Progress    | How is my training changing over time?       | Validated fitness, recovery, prediction, and record views                        |
| Races       | How am I preparing for an event?             | Goal races, course strategy, roadbook, and fueling                               |

Account, data connections, permissions, and preferences belong behind the profile/settings area. Keep destination-specific context in the sidebar group so navigation answers what is relevant around the current work. The global navigation must not duplicate that context.

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

## Responsive navigation

On desktop, the sidebar scopes the athlete's current goal and exposes contextual navigation; the center inset holds the work, and an optional coach panel explains who is helping. On mobile, navigation becomes a sheet and four primary destinations remain thumb-reachable, with Ask in the center. Preserve the destination model and contextual hierarchy rather than shrinking the desktop sidebar.

## Open UX questions

- Does an athlete think first in terms of a weekly plan or a daily recommendation?
- Should Coach be a persistent destination, a contextual action, or both?
- Which metrics are understandable and useful to the initial athlete segment?
- Does a race need its own workspace before the product supports course analysis?

Validate these choices with the selected athlete journey before designing a full screen inventory.

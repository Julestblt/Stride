---
name: season-calendar
description: Season calendar for a running athlete. Race roles, recovery and taper windows by km-effort, spacing rules, feasibility of a new objective and progression towards a longer race. Use when a race is added, removed or reprioritized, two races are close, or the athlete asks what to target next.
---

# Season calendar

## Two kinds of requests

- « Quel objectif ensuite ? »: summarize in two lines where the athlete stands (biggest distance and D+ completed, last race, proven weekly volume, open health reports). Propose a realistic next step: a moderate progression in distance or D+ from what was actually completed, never a jump. Say how many weeks of preparation it needs. Offer two options when sensible: « consolider » or « monter d'une marche ».
- « Est-ce que je peux faire cette course ? »: feasibility for this athlete before anything else. If the gap between the race and what the history supports by its date is too large to bridge safely, say it in the first sentence (« 80 km en juin, pour toi, je te le déconseille »), with the facts that justify it and the horizon at which it becomes realistic. Then re-target: a shorter format of the same event, or a progression path with intermediate races. The re-targeted format passes the same check on distance and D+ per km; say which part is the hard one (often the D+, not the distance).
- Challenge numbers that look off once, briefly (for example 80 km with 1 500 m D+ is about 19 m D+ per km, very runnable for a trail).

## Roles

- **Objectif principal**: the race the whole plan is built for. Full preparation and a taper. One per season block.
- **Préparation**: serves the main objective (terrain, duration, fueling rehearsal, a first bib). Run seriously, without a full taper, never inside the main objective's taper.
- **Plaisir**: fun, social or a long run in race atmosphere, run below race effort; it replaces a session of the week.

## Provisional project rules

`read_season_calendar` applies them and returns the table it used; quote the number you applied as « règle provisoire du projet ». Never make up another threshold.

- km-effort = distance in km + D+ in m / 100; D+ counts as 0 on road.
- Recovery after a race before another race run hard, and taper before a main objective, by km-effort: up to 15 → 2 weeks and 10 days; 15–30 → 3 and 2 weeks; 30–60 → 4 and 2 weeks; over 60 → 6 and 3 weeks.
- No race at all inside the main objective's taper, Plaisir included.
- A Préparation race has its full recovery done before the main objective's taper begins.
- A Plaisir race needs one week before the next race run hard, and may follow a race once half that race's recovery has passed.
- A new main objective after a previous one needs the previous recovery plus enough preparation weeks for the step up.
- Respect the athlete's declared unavailability.

## Conflicts

A conflict is never hidden. Show it and propose the nearest alternative: another date, a shorter format of the same event, or downgrading the race to Plaisir. Health beats ambition: an open pain report or a Medical limit always wins over the calendar.

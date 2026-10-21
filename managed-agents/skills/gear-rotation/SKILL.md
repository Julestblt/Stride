---
name: gear-rotation
description: Running shoes. Which pair for a session, why Stride picked it, rotation between pairs, wear and replacement, and the race pair's break-in. Use when the athlete asks which shoes to wear, why a pair was chosen, how worn a pair is, or whether the race pair is ready.
---

# Shoes and rotation

## Source of truth

`read_gear` is the only source. Stride picks a pair for every running session with deterministic rules and the athlete may override it in the app; you explain that choice, you never make a new one.

- Name only pairs listed in `pairs`. With no pair, say the athlete has not added shoes yet and point to the Matériel page.
- For a session, the pair is `pairName`. `choice` tells whether Stride recommended it or the athlete chose it. Quote or rephrase `sentence`; the reason codes and `reasonCodes` explain it.
- Describe a pair only by its type, terrain and `description`. Never claim a pair suits a foot, a gait or an injury, and never invent stack, drop, weight or grip.
- It is a suggestion, never an order: « je mettrais les Zegama », never « tu dois porter ».

## Rules Stride applies

1. Terrain: trail sessions use trail or mixed pairs; road and track use road or mixed pairs; treadmill takes any pair.
2. Session kind: easy runs on daily pairs, recovery on recovery pairs, tempo, threshold and intervals on tempo pairs, races and key sessions on race pairs.
3. Long or hilly sessions (long run, 18 km or more, 1 h 30 or more, 400 m D+ or more) favour cushioned and trail pairs.
4. Wear: a pair at or over its lifespan is no longer proposed. Say « durée de vie atteinte » plainly when `worn` is true, never hide it.
5. Rotation: avoid the same pair two days in a row when another one fits.
6. Race pair: a race-category pair is kept for its next race. Before that race it only serves key sessions and its break-in.
7. The athlete's own choices for a kind of session count for the next ones.

## Wear and replacement

Kilometres are the starting km plus what Garmin counts, treadmill included. Quote `totalKm`, `lifespanKm`, `remainingKm` and `replacementOn` as given. When `wearPercent` is 90 or more, say so in one line; otherwise say nothing about wear unless asked.

## Race pair and break-in

Each upcoming race in `races` has its race pair: linked by the athlete on the race gear list (`source: checklist`), else the race pair reserved for it (`source: reserved`). Without a pair, say no pair is linked yet and suggest linking one in the race's Équipement tab.

`breakIn` gives the pair's total km and longest run in the last year:

- `new`: under 30 km. Plan easy runs in it, then a long run.
- `breaking_in`: 30 to 50 km. Keep going; the next step is a long run close to race conditions.
- `broken_in`: 50 km or more.

The 30–50 km budget is an approximation used by the project, not a published standard: say so if the athlete asks for a source. For a long trail or an ultra, a broken-in pair still needs a long run close to race conditions; compare `longestRunKm` with the race distance and say what is missing. Nothing new on race day: an untested pair is a risk to name.

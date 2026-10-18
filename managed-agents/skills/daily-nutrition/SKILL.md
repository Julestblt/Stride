---
name: daily-nutrition
description: Daily nutrition for an endurance athlete. How Stride computes energy, carbohydrate, protein and fat targets by training day, meal timing, race-week loading and the light-deficit guards. Use when the athlete asks what to eat, how much, or when, around training or before a race.
---

# Daily nutrition

## How Stride computes the targets

`read_nutrition_targets` returns every number; explain them, never recompute them.

- Resting energy: Mifflin-St Jeor from age, sex, height and weight.
- Activity outside training (NEAT): a default estimate until Garmin daily calories are available. Say it is an estimate.
- Training energy: from the planned sessions, about 1 kcal per kg per km of running plus a climbing term.
- Daily target = resting energy × 1.1 (digestion) + NEAT + training energy, shown rounded (« environ 2 300 kcal »).
- Carbohydrates by day: 3–5 g/kg on rest and easy days, 5–7 g/kg on moderate days, 6–10 g/kg on long or hard days, 8–12 g/kg in the 36–48 hours before a race over 90 minutes.
- Protein: 1.6–2.0 g/kg per day in 4–5 intakes of 0.3–0.4 g/kg, one within two hours after a hard or long session.
- Fat: the remainder, at least 0.8 g/kg per day.
- During sessions over 90 minutes: 30–60 g of carbohydrate per hour; 60–90 g per hour in ultras.

## Timing

- Before a key or long session: a carbohydrate-rich meal 2–3 hours before, or a light snack 30–60 minutes before.
- After a hard or long session: carbohydrate and protein within two hours.
- Race week: loading only for races over 90 minutes, in the last 36–48 hours, with familiar, low-fibre foods.

## Light deficit

Only when the athlete asks for it: at most 10–15 % below the target (about 300–500 kcal). Never on long or hard days, the day before or of a race, in taper or race weeks, and never with open health signals (pain, illness, fatigue, poor readiness). The result says when it is refused and why.

## Never

- A weight or race-weight target, supplements, or a medical diet.
- A number that is not in the result.
- Ignoring signs of low energy availability (RED-S): repeated fatigue, poor recovery, lost appetite; tell the coach so Medical can look at them.

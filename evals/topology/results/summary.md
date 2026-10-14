# Topology benchmark results

Plans: 34. Generator: Claude Sonnet 5.5 through `claude -p`. Cost is the API-equivalent reported by the CLI.

## Deterministic measures

| Arm | Plans | Invalid after repair | Valid first attempt | Warnings / plan | S6 quality sessions | Calls / plan | Input tokens / plan | Output tokens / plan | Cost / plan (USD) | Minutes / plan |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| A | 12 | 0 | 9 | 2.8 | 0 | 1.3 | 8152 | 33309 | 0.35 | 3.4 |
| B | 11 | 1 | 4 | 3.7 | 0 | 6.9 | 33547 | 41659 | 0.53 | 4.5 |
| C | 11 | 0 | 4 | 2.5 | 0 | 2.6 | 16290 | 32441 | 0.38 | 3.2 |

## Judge calibration

| Judge | Seeded defects detected | Missed | Counts for the decision |
| --- | ---: | --- | --- |
| gpt | 3/4 | missing_taper | yes |
| qwen | 1/1 | – | no |
| deepseek | 4/4 | – | yes |

## Judged quality

Judging was not run, so no quality comparison or decision is reported.

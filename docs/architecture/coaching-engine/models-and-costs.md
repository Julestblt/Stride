# Models, token budgets and costs

- Status: Accepted (RFC #86, amended by decisions D1, D4, D6 and D7 in #94)
- Decision record: [ADR 0011](../../adr/0011-model-access-and-routing.md)
- Prices below were read from the providers' own pages on 2026-10-12. Token counts, call graphs and latencies are **design estimates**, not measurements; the first evaluation runs must replace them.

## Recommendation

- Use Claude models through the official Anthropic API with dedicated, spend-limited API keys behind the `ModelGateway` port.
- Route by task: **Opus 5.5** (effort high) for plan design and multi-race revisions; **Sonnet 5.5** for conversation, adaptations, weekly reviews and specialist consults; **Haiku 5.5** for routing, extraction and phrasing, including the existing single-shot skills (D7).
- Any task may escalate one tier when its output fails validation.
- Use prompt caching on every workflow and the Batch API for non-urgent weekly reviews.
- Do not use consumer subscriptions or CLI logins in production.
- Keep the provider swappable; adopt a second provider only after it passes the same evaluation suite.
- Decision D1 selects the first-party Anthropic API without an EU-residency requirement. A second, OpenAI-compatible adapter stays possible behind the same port.

## Verified prices

### Anthropic (first-party API, USD per million tokens)

| Model                             | Input | 5-min cache write | 1-hour cache write | Cache hit | Output | Batch input / output |
| --------------------------------- | ----- | ----------------- | ------------------ | --------- | ------ | -------------------- |
| Claude Fable 5.1                  | 10.00 | 12.50             | 20.00              | 0.25      | 50.00  | —                    |
| Claude Opus 5.5                   | 4.00  | 5.00              | 8.00               | 0.20      | 20.00  | 2.00 / 10.00         |
| Claude Sonnet 5.5                 | 2.00  | 2.50              | 4.00               | 0.10      | 10.00  | 1.00 / 5.00          |
| Claude Haiku 5.5 (prompts ≤ 100K) | 0.10  | 0.125             | 0.20               | 0.01      | 0.50   | 0.05 / 0.25          |

Source: [Anthropic pricing](https://platform.claude.com/docs/en/about-claude/pricing). Batch and caching discounts stack. US-only inference (`inference_geo: "us"`) costs 1.1× on every category.

### Other providers (USD per million tokens, standard tier)

| Provider and model                     | Input     | Cached input | Output    | Notes                                                                                                          |
| -------------------------------------- | --------- | ------------ | --------- | -------------------------------------------------------------------------------------------------------------- |
| OpenAI gpt-6.1-sol                     | 2.00      | 0.10         | 10.00     | Batch 50%; regional processing endpoints +10% ([pricing](https://developers.openai.com/api/docs/pricing))      |
| OpenAI gpt-6-luna                      | 0.10      | 0.01         | 0.50      | Small tier                                                                                                     |
| Google Gemini 3.1 Pro Preview (≤ 200K) | 2.00      | 0.20         | 12.00     | Plus cache storage per hour ([pricing](https://ai.google.dev/gemini-api/docs/pricing), updated 2026-10-09)     |
| Google Gemini 3.8 Flash                | 0.75      | 0.075        | 3.75      | Doubles on 2027-01-01                                                                                          |
| Mistral Large                          | 0.50      | —            | 1.50      | From the [pricing page](https://mistral.ai/pricing); Medium and Small prices not listed there                  |
| DeepSeek V4.1 Flash                    | 0.15–0.30 | 0.003–0.006  | 0.60–1.20 | Off-peak/peak; no processing-location statement ([pricing](https://api-docs.deepseek.com/quick_start/pricing)) |

Prices are close between leading providers; the decisive factors are measured quality on Stride's scenarios, data handling and residency, caching economics, and how much tuning a switch would cost. Public benchmarks are not accepted as proof of coaching quality.

## Provider data handling

| Option                                 | What applies                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Fit                                                              |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Anthropic first-party API              | Prompts and outputs are not retained by default except for Covered Models (Fable 5.1 and Mythos), which require 30-day retention; retained data is never used for training without permission; flagged content may be kept up to 2 years; inference geography `us` or `global`, workspace storage geography `us` only ([retention](https://platform.claude.com/docs/en/manage-claude/api-and-data-retention), [residency](https://platform.claude.com/docs/en/manage-claude/data-residency)) | Selected (D1)                                                    |
| Claude on Amazon Bedrock, EU geography | AWS is the processor; the `eu.` inference profile keeps processing in EU regions including Paris; for Sonnet 5.5 the model card lists structured outputs and Batch as not supported ([model card](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-anthropic-claude-sonnet-5-5.html))                                                                                                                                                                                         | Not needed (D1); kept as a portability reference                 |
| Claude on Google Vertex AI             | EU availability for the 5.5 models could not be confirmed from primary documentation                                                                                                                                                                                                                                                                                                                                                                                                         | To verify if chosen                                              |
| OpenAI with EU data residency          | Europe-region projects with zero data retention for eligible customers ([announcement](https://openai.com/index/introducing-data-residency-in-europe/))                                                                                                                                                                                                                                                                                                                                      | Possible second adapter; adopted only after the evaluation suite |
| DeepSeek or OpenCode Go                | No processing-location statement; OpenCode Go terms for application traffic unconfirmed ([ADR 0006](../../adr/0006-import-insights-phrasing.md))                                                                                                                                                                                                                                                                                                                                             | Not recommended for health data                                  |

Fable 5.1 is excluded for athlete data because its 30-day retention requirement conflicts with minimizing health data at the provider, and its price is 2.5× Opus 5.5. To stay portable across providers and platforms, structured results come back through strict tool calls validated with Zod, which works on every platform, rather than depending on platform-specific structured-output modes.

## Routing and effort

| Task                                                                             | Model                  | Effort         | Why                                                         |
| -------------------------------------------------------------------------------- | ---------------------- | -------------- | ----------------------------------------------------------- |
| Intent routing, extraction (symptoms, races, facts), phrasing with numeric guard | Haiku 5.5              | low            | High volume, narrow output, deterministic checks downstream |
| Questions, explanations                                                          | Sonnet 5.5             | low            | Conversational quality; short outputs                       |
| Session and week adaptations                                                     | Sonnet 5.5             | medium         | Tool use and trade-offs within validated options            |
| Weekly review with flags                                                         | Sonnet 5.5 (Batch API) | medium         | Non-urgent; half price                                      |
| Specialist consults                                                              | Sonnet 5.5             | medium or high | Bounded single calls                                        |
| Plan design and multi-race revisions                                             | Opus 5.5               | high           | Highest-stakes reasoning; rare                              |
| Existing skills: insights phrasing, roadbook extraction (D7)                     | Haiku 5.5              | low            | Narrow outputs already guarded by deterministic fallbacks   |

Escalation: when a model output fails schema or validator checks, the step may retry once on the next tier (Haiku 5.5 → Sonnet 5.5 → Opus 5.5) before the workflow's deterministic fallback. Plan design repairs stay on Opus 5.5. Every escalation is recorded on the step.

Downgrade experiments run first: plan design on Sonnet 5.5 at high effort costs about $0.40 instead of $0.73 per initial plan in the expected scenario, and becomes the default if it matches Opus on the evaluation suite.

Fallbacks: SDK retries handle 429 and 5xx; a run step retries twice with backoff; plan workflows wait and resume rather than switching providers mid-run. Opus unavailable for more than 15 minutes falls back to Sonnet 5.5 at high effort for plan design, which is recorded on the run. Conversation turns degrade to a deterministic answer ("Le coach est momentanément indisponible") rather than a weaker unevaluated model. Refusals are handled explicitly and never retried with relaxed instructions.

## Context and caching

- The cached prefix is the agent's system prompt, workflow skill modules and tool schemas (about 4–7K tokens), placed in a fixed order so it is byte-stable. The context packet (under 5K tokens) follows with a second cache breakpoint for multi-call runs.
- The 5-minute cache TTL fits conversation bursts and plan workflows whose calls are minutes apart; 1-hour writes cost 2× and are not needed.
- Conversations reset each local day (as in the Coach design reference), so threads stay short; long-term continuity comes from structured memory facts, decisions and plan history, not from replaying transcripts.
- Tool results are capped and summarized; raw provider payloads never enter the context. Compaction is not needed at these sizes.

## Token and cost estimates

Call graphs per scenario (expected case shown; low and high cases vary the number of calls, repairs and consults):

| Workflow              | Expected call graph                                                                                                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Initial plan          | Sports Director consult (Sonnet) → plan design of every week (Opus, ~15K in, ~20K out including thinking) → one repair (Opus, cached prefix) → rationale (Sonnet) → fact extraction (Haiku) |
| Single workout change | Routing (Haiku) → three Coach calls with tools (Sonnet, cached prefix, ~2.5K out in total)                                                                                                  |
| Weekly review         | Flags present: one Sonnet review through the Batch API + Haiku phrasing; nothing flagged: no model call or a single Haiku phrasing                                                          |
| Multi-race revision   | Sports Director consult (Sonnet) → block revision design (Opus) → one repair (Opus) → rationale (Sonnet)                                                                                    |
| Brief question        | Two Sonnet calls with one tool call                                                                                                                                                         |

| Workflow              | Scenario | Model calls | Input tokens (cached) | Output tokens | Cost (USD)   | Model time (s) |
| --------------------- | -------- | ----------- | --------------------- | ------------- | ------------ | -------------- |
| Initial plan          | low      | 3           | 24,000 (0)            | 17,700        | 0.38         | ~240           |
|                       | expected | 5           | 56,500 (15,000)       | 32,100        | 0.73         | ~550           |
|                       | high     | 8           | 152,000 (50,000)      | 62,500        | 1.50         | ~1,530         |
| Single workout change | low      | 2           | 20,000 (8,500)        | 1,400         | 0.04         | ~13            |
|                       | expected | 4           | 35,500 (26,500)       | 2,550         | 0.04         | ~34            |
|                       | high     | 7           | 86,500 (58,000)       | 7,050         | 0.13         | ~140           |
| Weekly review         | low      | 1           | 3,000 (0)             | 500           | 0.001        | ~2             |
|                       | expected | 2           | 8,500 (0)             | 3,000         | 0.02 (Batch) | batch          |
|                       | high     | 4           | 25,000 (0)            | 9,100         | 0.13         | ~160           |
| Multi-race revision   | low      | 3           | 23,500 (8,000)        | 5,100         | 0.07         | ~40            |
|                       | expected | 4           | 63,000 (18,000)       | 19,000        | 0.49         | ~320           |
|                       | high     | 6           | 152,000 (52,000)      | 39,000        | 1.09         | ~1,070         |
| Brief question        | low      | 1           | 7,500 (6,000)         | 300           | 0.007        | ~3             |
|                       | expected | 2           | 18,000 (14,500)       | 900           | 0.02         | ~14            |
|                       | high     | 3           | 36,000 (22,000)       | 2,100         | 0.05         | ~47            |

Assumptions behind the model time column: output throughput of 35–80 tokens per second for Opus, 60–130 for Sonnet and 120–250 for Haiku, plus 0.5–8 seconds to first token, with calls in sequence. These are planning figures to be measured. Deterministic steps add seconds, not minutes. Thinking tokens are billed as output and are included.

What this means for the athlete experience:

- Decision D6 makes the plan design output larger: the model chooses and progresses the key sessions of every week instead of the next two, while code still fills the remaining sessions and computes every number. Compared with a two-week horizon, the expected initial plan rises from $0.53 to $0.73 and from about 6 to about 9 minutes; the weekly review no longer re-details weeks and its cost is unchanged.
- An initial plan takes several minutes in the expected case and up to about twenty-five minutes in the worst case, so it runs in the background with streamed progress and a notification in the app when ready.
- A workout change answers in under a minute with progress lines while tools run; the target for the median is under 30 seconds.

### Monthly cost per athlete

| Profile (per month)                                                           | Low   | Expected | High  |
| ----------------------------------------------------------------------------- | ----- | -------- | ----- |
| Light: 0.2 plans, 1 change, 4.3 reviews, 0.05 race revisions, 4 questions     | $0.15 | $0.36    | $1.26 |
| Typical: 0.3 plans, 4 changes, 4.3 reviews, 0.15 race revisions, 20 questions | $0.43 | $0.89    | $2.79 |
| Heavy: 1 plan, 12 changes, 4.3 reviews, 0.5 race revisions, 60 questions      | $1.31 | $2.60    | $7.44 |

For the owner and one or two relatives, the expected total stays under a few dollars per month in model usage. Retries are included in the high scenarios.

Every assumed call is listed in the [appendix](#appendix-per-call-assumptions), so the figures can be recomputed from the price table. The first evaluation runs should replace these assumptions with measured token counts per workflow.

## Run caps and timeouts

Per-run hard caps (enforced by the runtime; values are starting points). They protect against runaway loops; they are not athlete quotas:

| Workflow                      | Model calls | Tool calls | Input tokens | Output tokens | Cost  | Wall clock                 |
| ----------------------------- | ----------- | ---------- | ------------ | ------------- | ----- | -------------------------- |
| Question or explanation       | 3           | 6          | 40,000       | 3,000         | $0.10 | 60 s                       |
| Session or week change        | 5           | 10         | 80,000       | 6,000         | $0.25 | 120 s                      |
| Weekly review                 | 3           | 6          | 40,000       | 6,000         | $0.20 | 10 min (24 h when batched) |
| Initial plan or plan revision | 8           | 20         | 200,000      | 80,000        | $2.00 | 30 min                     |

Decision D4: no per-athlete quotas or monthly budgets for now. Usage and cost are recorded per call so real consumption can be observed first; quotas are added only if that data shows a need. The product rule of at most one monitor-triggered adaptation per athlete per day stays, because it limits approval fatigue rather than cost.

Fleet guards: a spend limit on the provider account and a kill switch that pauses all coaching runs while deterministic features keep working.

Timeouts: model calls stream, with an idle timeout of 60 seconds and a per-call ceiling of 10 minutes; tools time out after 5 seconds; a run step retries at most twice; a run is attempted at most three times with 1, 5 and 15 minute backoff.

## Consumer subscriptions are not an option

- Anthropic: "Unless previously approved, Anthropic does not allow third party developers to offer claude.ai login or rate limits for their products, including agents built on the Claude Agent SDK" ([Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview)). Free, Pro and Max plans are also outside the API's zero-data-retention arrangements.
- OpenAI: ChatGPT Plus does not include API usage, which is billed separately ([help center](https://help.openai.com/en/articles/6950777)).
- Consumer plans are personal: their limits are per person, their terms do not cover serving other people, and they come with no data-processing agreement for athletes' health data. CLI logins (Claude Code, Codex) are fine for developers' own work, never for serving athletes.
- Production uses API organizations with separate workspaces and keys for development, staging and production, spend limits, and usage reporting.

## Infrastructure costs

| Item                   | Estimate                                                                                                                                |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Coach worker container | Runs on the existing Dokploy host; mostly waiting on network calls; a few hundred MB of memory; no new paid service                     |
| Supabase               | Within the Pro plan; storage grows about 5–10 MB per active athlete per year without purges ([data model](data-model.md#size-estimate)) |
| Observability          | Postgres tables and structured logs; no new service                                                                                     |
| Model usage            | See above; the dominant variable cost                                                                                                   |

## Appendix: per-call assumptions

Estimates, not measurements. Thinking tokens are counted as output. Prices from the verified table above; Batch applies a 50% discount.

| Workflow              | Scenario | Call | Model      | Uncached input | Cache write | Cache read | Output | Batch | Cost (USD) |
| --------------------- | -------- | ---- | ---------- | -------------- | ----------- | ---------- | ------ | ----- | ---------- |
| Initial plan          | low      | 1    | Sonnet 5.5 | 7,000          | 0           | 0          | 1,500  |       | 0.0290     |
|                       |          | 2    | Opus 5.5   | 6,000          | 6,000       | 0          | 15,000 |       | 0.3540     |
|                       |          | 3    | Haiku 5.5  | 3,000          | 2,000       | 0          | 1,200  |       | 0.0011     |
|                       | expected | 1    | Sonnet 5.5 | 4,000          | 4,000       | 0          | 2,500  |       | 0.0430     |
|                       |          | 2    | Opus 5.5   | 8,000          | 7,000       | 0          | 20,000 |       | 0.4670     |
|                       |          | 3    | Opus 5.5   | 9,000          | 0           | 15,000     | 7,000  |       | 0.1790     |
|                       |          | 4    | Sonnet 5.5 | 4,000          | 3,000       | 0          | 2,000  |       | 0.0355     |
|                       |          | 5    | Haiku 5.5  | 2,500          | 0           | 0          | 600    |       | 0.0006     |
|                       | high     | 1    | Sonnet 5.5 | 6,000          | 5,000       | 0          | 4,000  |       | 0.0645     |
|                       |          | 2    | Sonnet 5.5 | 5,000          | 0           | 4,000      | 2,500  |       | 0.0354     |
|                       |          | 3    | Opus 5.5   | 12,000         | 9,000       | 0          | 28,000 |       | 0.6530     |
|                       |          | 4    | Opus 5.5   | 12,000         | 0           | 21,000     | 10,000 |       | 0.2522     |
|                       |          | 5    | Opus 5.5   | 10,000         | 0           | 25,000     | 9,000  |       | 0.2250     |
|                       |          | 6    | Opus 5.5   | 30,000         | 0           | 0          | 5,000  |       | 0.2200     |
|                       |          | 7    | Sonnet 5.5 | 6,000          | 3,000       | 0          | 3,000  |       | 0.0495     |
|                       |          | 8    | Haiku 5.5  | 4,000          | 0           | 0          | 1,000  |       | 0.0009     |
| Single workout change | low      | 1    | Sonnet 5.5 | 2,500          | 6,000       | 0          | 500    |       | 0.0250     |
|                       |          | 2    | Sonnet 5.5 | 3,000          | 0           | 8,500      | 900    |       | 0.0158     |
|                       | expected | 1    | Haiku 5.5  | 1,500          | 0           | 0          | 150    |       | 0.0002     |
|                       |          | 2    | Sonnet 5.5 | 3,000          | 0           | 6,000      | 600    |       | 0.0126     |
|                       |          | 3    | Sonnet 5.5 | 2,500          | 0           | 9,000      | 600    |       | 0.0119     |
|                       |          | 4    | Sonnet 5.5 | 2,000          | 0           | 11,500     | 1,200  |       | 0.0171     |
|                       | high     | 1    | Haiku 5.5  | 1,500          | 0           | 0          | 150    |       | 0.0002     |
|                       |          | 2    | Sonnet 5.5 | 4,000          | 6,000       | 0          | 900    |       | 0.0320     |
|                       |          | 3    | Sonnet 5.5 | 3,000          | 0           | 10,000     | 900    |       | 0.0160     |
|                       |          | 4    | Sonnet 5.5 | 3,000          | 0           | 13,000     | 900    |       | 0.0163     |
|                       |          | 5    | Sonnet 5.5 | 3,000          | 0           | 16,000     | 900    |       | 0.0166     |
|                       |          | 6    | Sonnet 5.5 | 5,000          | 0           | 0          | 1,500  |       | 0.0250     |
|                       |          | 7    | Sonnet 5.5 | 3,000          | 0           | 19,000     | 1,800  |       | 0.0259     |
| Weekly review         | low      | 1    | Haiku 5.5  | 3,000          | 0           | 0          | 500    |       | 0.0006     |
|                       | expected | 1    | Sonnet 5.5 | 6,000          | 0           | 0          | 2,500  | yes   | 0.0185     |
|                       |          | 2    | Haiku 5.5  | 2,500          | 0           | 0          | 500    | yes   | 0.0003     |
|                       | high     | 1    | Sonnet 5.5 | 9,000          | 0           | 0          | 4,000  |       | 0.0580     |
|                       |          | 2    | Sonnet 5.5 | 6,000          | 0           | 0          | 2,000  |       | 0.0320     |
|                       |          | 3    | Sonnet 5.5 | 7,000          | 0           | 0          | 2,500  |       | 0.0390     |
|                       |          | 4    | Haiku 5.5  | 3,000          | 0           | 0          | 600    |       | 0.0006     |
| Multi-race revision   | low      | 1    | Sonnet 5.5 | 5,000          | 4,000       | 0          | 2,000  |       | 0.0400     |
|                       |          | 2    | Sonnet 5.5 | 4,000          | 0           | 8,000      | 2,500  |       | 0.0338     |
|                       |          | 3    | Haiku 5.5  | 2,500          | 0           | 0          | 600    |       | 0.0006     |
|                       | expected | 1    | Sonnet 5.5 | 6,000          | 5,000       | 0          | 3,000  |       | 0.0545     |
|                       |          | 2    | Opus 5.5   | 10,000         | 8,000       | 0          | 10,000 |       | 0.2800     |
|                       |          | 3    | Opus 5.5   | 9,000          | 0           | 18,000     | 4,000  |       | 0.1196     |
|                       |          | 4    | Sonnet 5.5 | 4,000          | 3,000       | 0          | 2,000  |       | 0.0355     |
|                       | high     | 1    | Sonnet 5.5 | 8,000          | 5,000       | 0          | 4,000  |       | 0.0685     |
|                       |          | 2    | Opus 5.5   | 14,000         | 10,000      | 0          | 16,000 |       | 0.4260     |
|                       |          | 3    | Opus 5.5   | 12,000         | 0           | 24,000     | 6,000  |       | 0.1728     |
|                       |          | 4    | Opus 5.5   | 12,000         | 0           | 28,000     | 5,000  |       | 0.1536     |
|                       |          | 5    | Opus 5.5   | 30,000         | 0           | 0          | 5,000  |       | 0.2200     |
|                       |          | 6    | Sonnet 5.5 | 6,000          | 3,000       | 0          | 3,000  |       | 0.0495     |
| Brief question        | low      | 1    | Sonnet 5.5 | 1,500          | 0           | 6,000      | 300    |       | 0.0066     |
|                       | expected | 1    | Sonnet 5.5 | 2,000          | 0           | 6,000      | 400    |       | 0.0086     |
|                       |          | 2    | Sonnet 5.5 | 1,500          | 0           | 8,500      | 500    |       | 0.0089     |
|                       | high     | 1    | Sonnet 5.5 | 3,000          | 6,000       | 0          | 600    |       | 0.0270     |
|                       |          | 2    | Sonnet 5.5 | 2,500          | 0           | 9,500      | 600    |       | 0.0120     |
|                       |          | 3    | Sonnet 5.5 | 2,500          | 0           | 12,500     | 900    |       | 0.0152     |

# Product epics

These documents define capability boundaries and expected outcomes. They do not track execution status. GitHub Issues are the sole record of actionable work, assignment, dependencies, and status.

| Epic                                                                                  | Capability                                                           | Depends on                                                           |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------- |
| [E-00 Product discovery and first-release definition](E-00-product-discovery.md)      | Validate audience, highest-value journey, and first-release boundary | Existing product vision                                              |
| [E-01 Athlete context and consent](E-01-athlete-context.md)                           | Trustworthy athlete profile and data permissions                     | Product discovery                                                    |
| [E-02 Garmin integration](E-02-garmin-integration.md)                                 | Provider integration and normalized activity data                    | E-01                                                                 |
| [E-03 Training history and insights](E-03-training-insights.md)                       | Useful road and trail activity history and deterministic measures    | E-01, E-02                                                           |
| [E-04 Training plans and adaptation](E-04-training-plans.md)                          | Athlete-reviewed weekly training proposals                           | E-01, E-03                                                           |
| [E-05 Stride Coach](E-05-stride-coach.md)                                             | Context-aware, structured coaching interaction                       | E-01, E-03; E-04 for plan changes                                    |
| [E-06 Race intelligence](E-06-race-intelligence.md)                                   | Course-aware preparation and race strategy                           | E-01, E-03, and relevant parts of E-04/E-05                          |
| [E-07 Athlete identity and first-run onboarding](E-07-athlete-identity-onboarding.md) | Secure account, durable athlete context, and resumable setup         | Theme foundation; discovery of consent and athlete data requirements |

Epic order is a dependency suggestion, not a release commitment. Discovery may split, reorder, or drop epics. Each epic should receive an epic-level GitHub Issue only when it is approved for execution; story-sized work is represented by child issues or linked issues.

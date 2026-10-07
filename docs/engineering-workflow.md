# Engineering workflow

GitHub Issues and Pull Requests are the project source of truth. GitHub Projects may provide a human-readable board; no separate task tracker is used.

## Delivery path

Discovery and product brief lead to a scoped issue. Higher-level work may include a PRD, architecture decision, and epic. Implementation issues should state acceptance criteria and verification. Work proceeds on a feature branch through implementation, tests, review, and pull request.

Use the branch patterns in `AGENTS.md` and Conventional Commit prefixes. Keep changes small, inspect staged diffs before commits, and use pull requests for review. Do not merge your own pull requests in automated workflows.

## Suggested labels

- Status: `status:ready`, `status:in-progress`, `status:review`, `status:blocked`
- Type: `type:feature`, `type:bug`, `type:architecture`, `type:research`
- Area: `area:frontend`, `area:ai`, `area:garmin`, `area:data`, `area:training`, `area:design`

Labels can be created when repository maintainers configure the project. No remote GitHub configuration is part of this foundation.

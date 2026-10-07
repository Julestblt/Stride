# Engineering workflow

GitHub Issues and Pull Requests are the project source of truth. GitHub Projects may provide a human-readable view over Issues; no separate task tracker is used. Product planning and artifact ownership are described in the [BMAD planning workflow](planning-workflow.md).

## Delivery path

Discovery and product brief lead to a reviewed PRD, UX and architecture decisions, and capability epics where the scope warrants them. Epics are defined in BMAD/product documents; approved execution work is created only as GitHub Issues. Implementation issues should state acceptance criteria, dependencies, and verification. Work proceeds on a feature branch through implementation, tests, review, and pull request.

Use the branch patterns in `AGENTS.md` and Conventional Commit prefixes. Keep changes small, inspect staged diffs before commits, and use pull requests for review. Do not merge your own pull requests in automated workflows.

## Suggested labels

- Status: `status:ready`, `status:in-progress`, `status:review`, `status:blocked`
- Type: `type:feature`, `type:bug`, `type:architecture`, `type:research`, `type:design`, `type:chore`
- Area: `area:frontend`, `area:ai`, `area:garmin`, `area:data`, `area:training`, `area:design`, `area:platform`

Use one status, one type, and only the relevant area labels. Priority labels are deferred until there is a demonstrated triage need. Maintainers can create these labels in GitHub; this repository does not duplicate issue status locally.

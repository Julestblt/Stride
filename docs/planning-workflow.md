# Product planning and delivery with BMAD

Stride uses the official [BMAD Method](https://github.com/bmad-code-org/BMAD-METHOD) for product discovery and product/technical artifacts. GitHub Issues remain the only execution tracker. This document maps BMAD outputs to Stride's existing documentation and issue workflow; it does not define a replacement method.

## Installed tooling

The official BMAD Skills CLI installs selected skills for Codex under `.agents/skills`. The version lock is `skills-lock.json`. The official setup creates `_bmad/` for module metadata and scripts. The BMAD hub is available as the `bmad` skill; ask it for setup, status, or routing guidance. The installed planning skills include brainstorming, idea validation, research, product brief, PRD, UX, architecture, epic specification, build, review, and retrospective workflows.

The installed modules are core-tools and method, currently at 6.13.0-next. BMAD setup and scripts require Node.js, Git, and Astral uv. Update the project skills with npx skills update -p -y, then ask bmad to run setup and report any changed or newly recommended skills. The copied upstream skill files are vendor-managed and are excluded from project formatting; do not edit them directly.

The official setup uses `_bmad-output` as its workspace. Use that workspace for in-progress BMAD session material and supporting notes. Accepted product and architecture decisions belong in the canonical docs linked below. Promote accepted outcomes into those canonical files instead of keeping parallel final versions.

The existing AGENTS.md is the maintained project context. BMAD's project-context workflow is unnecessary unless these instructions become stale.

## Planning path

Scale planning to uncertainty and impact. A small, clear issue can go directly to issue-driven implementation. For product-level or multi-epic work, follow this path:

1. **Discovery:** read the existing [vision](product/vision.md), [principles](product/principles.md), [roadmap](product/roadmap.md), product brief, PRD, architecture overview, ADRs, and the live codebase. Use BMAD brainstorming, idea validation, or research only to answer real unknowns.
2. **Product brief:** use the official product-brief workflow. The maintained brief is [docs/product/brief.md](product/brief.md). Mark inferred claims as assumptions and carry unresolved discovery questions forward.
3. **PRD:** use the official PRD workflow to create or update [docs/product/prd.md](product/prd.md). The PRD owns product requirements. Each requirement should have stable identifiers and a testable or reviewable outcome.
4. **UX and information architecture:** start from [the proposed IA](design/information-architecture.md) and [design-system direction](design/design-system.md). Use the official UX workflow when journeys, navigation, or interaction patterns need decisions. Accepted UX documents live in docs/design.
5. **Architecture:** use the official architecture workflow when multiple epics need shared technical decisions. Start from docs/architecture and docs/adr; record durable choices in the existing architecture documents or a new ADR. Do not restate settled architecture without a reason.
6. **Epics:** maintain capability boundaries in [docs/epics](epics/README.md). Epic documents define objective, scope, dependencies, value, risks, and completion criteria. They contain no execution status.
7. **BMAD spec:** for significant implementation slices, use the official spec workflow to turn the approved epic and product requirements into a focused implementation spec. Skip this ceremony for clear, small issues.
8. **GitHub Issues:** after an epic is approved, create one parent issue when useful and break the work into small independently deliverable issues. Every child issue links its epic, source requirements, and BMAD spec when applicable. Issue descriptions carry implementation context and acceptance criteria.
9. **Implementation:** start from a GitHub Issue, use the official BMAD build skill when the work benefits from it, write a focused implementation plan in the issue or its discussion, then use a feature branch, small Conventional Commits, validation, and a pull request with independent review.

## Canonical artifact map

| Artifact                        | Canonical location                                      | Purpose                                                                                       |
| ------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Vision and principles           | docs/product/vision.md, docs/product/principles.md      | Stable product intent and guardrails                                                          |
| Product brief                   | docs/product/brief.md                                   | Target problem, audience hypotheses, value, candidate first release, and discovery gaps       |
| PRD                             | docs/product/prd.md                                     | Goals, journeys, functional and non-functional requirements, measures, constraints, and scope |
| UX and information architecture | docs/design/information-architecture.md and docs/design | Navigation and accepted experience decisions                                                  |
| Architecture                    | docs/architecture and docs/adr                          | Shared technical boundaries and durable decisions                                             |
| Epics                           | docs/epics                                              | Capability contracts and dependency rationale, without status                                 |
| BMAD implementation specs       | docs/specs                                              | Focused contracts linked from GitHub Issues                                                   |
| Execution work and status       | GitHub Issues and Pull Requests                         | Assignment, acceptance, dependencies, implementation, review, and state                       |

When a BMAD workflow creates a working draft or memlog in _bmad-output, use it to reach a reviewed decision and promote accepted content into the canonical artifact. Focused implementation specs live in docs/specs and are linked by their GitHub Issue. Do not use a local backlog, ticket tree, TODO file, or BMAD status file to mirror GitHub execution state.

## Skill loading policy

OpenCode registers the vendor-managed skills in `.agents/skills` through the project configuration in `.opencode/opencode.jsonc`, which also denies the `bmod-*` module-metadata skills. `AGENTS.md` remains the only always-on context source because OpenCode V2 accepts but does not load the `instructions` configuration array.

Installed skills are not universal context. Start with `AGENTS.md`; load only skills that the current task needs. Use BMAD for planning, specification, architecture, and implementation workflow. Load shadcn for UI component work. Load Ponytail for a targeted simplicity check before abstractions, dependencies, refactors, or architecture reviews. Load future specialist skills only when an active issue directly requires them. Avoid overlapping skill stacks and do not copy full skill instructions into `AGENTS.md`.

| Layer                                                                         | Use                                                                       |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `AGENTS.md`                                                                   | Always-applicable repository rules                                        |
| BMAD                                                                          | Planning, specification, architecture, and scoped implementation workflow |
| [Official shadcn skill](https://github.com/shadcn/ui/tree/main/skills/shadcn) | UI component implementation and registries                                |
| [Ponytail](https://github.com/jorgeasaurus/agent-skills/tree/main/ponytail)   | Targeted simplicity and accidental-complexity checks                      |
| Future specialist skills                                                      | Load just in time when an active issue requires them                      |

Skills provide task guidance but do not override Stride's required boundaries: AI runtime isolation, Garmin integration, domain separation, Supabase security, structured validation, accessibility, or testing. Ponytail reduces accidental complexity; it cannot remove those requirements. Its suggestion to add source comments for simplifications does not apply because Stride prohibits code comments. Shadcn supplies low-level UI primitives; the Stride design system remains the product identity.

## Epics to GitHub Issues

An epic is a planning container, not a second board or a giant implementation pull request. Keep its stable key (E-01, E-02, and so on) in `docs/epics`. When approved for implementation, decompose it into multiple small GitHub Issues. Use parent/sub-issues if available; otherwise reference the epic key in each issue and use a milestone only when it helps grouping. Each issue gets one focused branch and pull request. An epic is complete when all required child issues are complete. Do not create long-lived epic branches or use GitFlow; development is trunk-oriented around `main`.

Each implementation issue should state:

- Why the work exists and which product requirement or epic it advances
- The desired outcome and explicit in-scope and out-of-scope work
- Acceptance criteria that can be checked
- Relevant architecture constraints and source documents
- Dependencies and testing expectations

Do not copy issue status into epic documents or BMAD output. Update status and labels in GitHub only. A BMAD spec may refine an epic's requirements, but once work is issued, the GitHub issue is the implementation handoff.

## GitHub source of truth

- Issues are the record of actionable engineering work and its status.
- Pull Requests and commits record implementation and review history.
- GitHub Projects may visualize these Issues but must not hold a separate task list.
- Milestones may group approved Issues; they are optional.
- No remote labels or board settings are changed by this repository workflow. Issue templates do not assume labels already exist; maintainers can create the documented labels in GitHub and apply them to new issues.

Suggested labels:

| Group  | Labels                                                                                    |
| ------ | ----------------------------------------------------------------------------------------- |
| Status | status:ready, status:in-progress, status:review, status:blocked                           |
| Type   | type:feature, type:bug, type:architecture, type:research, type:design, type:chore         |
| Area   | area:frontend, area:ai, area:garmin, area:data, area:training, area:design, area:platform |

Use one status, one type, and the smallest useful set of area labels. Do not add priority labels until they answer a real triage need.

## Issue, branch, pull request, and closure lifecycle

GitHub is the only execution tracker. The lifecycle is Planned → Ready → In Progress → In Review → Done. Planned means an open issue awaiting refinement or prioritization; Ready uses `status:ready`. GitHub issue state and status labels are authoritative; do not record issue status in BMAD artifacts, epic documents, or local files. Use exactly one of `status:ready`, `status:in-progress`, `status:review`, or `status:blocked` where configured, moving the status label as work advances. Done means closed after the completing pull request has merged into `main`.

After BMAD defines or refines a requirement, create a GitHub Issue with context, objective, scope, explicit non-goals, acceptance criteria, references (epic, PRD requirement IDs, architecture/ADR, and BMAD spec where applicable), dependencies, and testing expectations. Keep the issue self-contained for an implementation agent who has no prior conversation context. Create issues for near-term work, not speculative distant backlog.

One issue normally maps to one branch and one focused pull request. Branch from up-to-date `main` using `feat/<issue>-<name>`, `fix/<issue>-<name>`, `refactor/<issue>-<name>`, `docs/<issue>-<name>`, or `chore/<issue>-<name>`. Do not combine unrelated work.

1. Read the issue, linked epic and requirements, relevant architecture/ADRs, and current code patterns. Claim it in GitHub, replace its existing status label with `status:in-progress`, and leave it open.
2. Write the implementation plan into the GitHub issue before code when the work needs a plan; keep the issue as durable handoff context.
3. Branch from current `main` using the required issue branch pattern.
4. Implement only the scoped outcome, add relevant tests, and make small atomic Conventional Commits.
5. Run relevant validation and open a PR linked to the issue. Include purpose, scope, material decisions, validation, visual verification results for UI changes, limitations, and review notes. Replace the status label with `status:review`.
6. Request independent review; use the installed `bmad-code-review` skill for meaningful PRs. A lighter review is suitable for trivial changes. Never skip review for authentication, Supabase RLS, Garmin authentication or ingestion, athlete data, AI orchestration, plan adaptation, migrations, or security changes. The implementation agent does not approve or merge its own PR.
7. When the PR fully completes its issue, include GitHub's native closing keyword such as `Closes #123`. For partial work, use `Related to #123` instead. GitHub closes the issue when the PR is merged into the repository's default branch. Do not add custom auto-close automation. Verify closure after merge when a GitHub connector is available; explicitly close only if native closure did not occur. Never close before merge.

GitHub Issues, PRs, labels, optional milestones, GitHub Actions, and optional GitHub Projects are the workflow. Projects are only a visualization over Issues. Do not create local TODO trackers, BMAD execution boards, mirrored task state, Trello boards, or parallel backlog files. For commit policy and label guidance, see [engineering workflow](engineering-workflow.md).

## Initial use

The current product brief and PRD are drafts based on the supplied product vision, not user research or approved MVP commitments. The first execution issue is [#1](https://github.com/Julestblt/Stride/issues/1), which tracks discovery for E-00. Before the first BMAD workflow run, ask `bmad` to create and activate the Stride product initiative. The next product BMAD step is discovery to validate the primary athlete segment and the candidate first-release boundary. The explicitly approved Night Track frontend foundation can proceed independently under Issue #3. Do not create implementation issues from speculative roadmap items before those decisions are reviewed.

Temporary screenshots for visual validation must remain untracked in `test-results/` or outside the repository. Reference images under `design/references/**` are read-only inputs, never application assets or generated evidence.

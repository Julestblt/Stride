# Product planning and delivery with BMAD

Stride uses the official [BMAD Method](https://github.com/bmad-code-org/BMAD-METHOD) for product discovery and product/technical artifacts. GitHub Issues remain the only execution tracker. This document maps BMAD outputs to Stride's existing documentation and issue workflow; it does not define a replacement method.

## Installed tooling

The official BMAD Skills CLI installs selected skills for Codex under .agents/skills. The version lock is skills-lock.json. The official setup creates _bmad/ for module metadata and scripts. The BMAD hub is available as the bmad skill; ask it for setup, status, or routing guidance. The installed planning skills include brainstorming, idea validation, research, product brief, PRD, UX, architecture, epic specification, build, review, and retrospective workflows.

The installed modules are core-tools and method, currently at 6.13.0-next. BMAD setup and scripts require Node.js, Git, and Astral uv. Update the project skills with npx skills update -p -y, then ask bmad to run setup and report any changed or newly recommended skills. The copied upstream skill files are vendor-managed and are excluded from project formatting; do not edit them directly.

The official setup uses _bmad-output as its workspace. Use that workspace for in-progress BMAD session material and supporting notes. Accepted product and architecture decisions belong in the canonical docs linked below. Promote accepted outcomes into those canonical files instead of keeping parallel final versions.

The existing AGENTS.md is the maintained project context. BMAD's project-context workflow is unnecessary unless these instructions become stale.

## Planning path

Scale planning to uncertainty and impact. A small, clear issue can go directly to issue-driven implementation. For product-level or multi-epic work, follow this path:

1. **Discovery:** read the existing [vision](product/vision.md), [principles](product/principles.md), [roadmap](product/roadmap.md), product brief, PRD, architecture overview, ADRs, and the live codebase. Use BMAD brainstorming, idea validation, or research only to answer real unknowns.
2. **Product brief:** use the official product-brief workflow. The maintained brief is [docs/product/brief.md](product/brief.md). Mark inferred claims as assumptions and carry unresolved discovery questions forward.
3. **PRD:** use the official PRD workflow to create or update [docs/product/prd.md](product/prd.md). The PRD owns product requirements. Each requirement should have stable identifiers and a testable or reviewable outcome.
4. **UX and information architecture:** start from [the proposed IA](design/information-architecture.md) and [design-system direction](design/design-system.md). Use the official UX workflow when journeys, navigation, or interaction patterns need decisions. Accepted UX documents live in docs/design.
5. **Architecture:** use the official architecture workflow when multiple epics need shared technical decisions. Start from docs/architecture and docs/adr; record durable choices in the existing architecture documents or a new ADR. Do not restate settled architecture without a reason.
6. **Epics:** maintain capability boundaries in [docs/epics](epics/README.md). Epic documents define objective, scope, dependencies, value, risks, and completion criteria. They contain no execution status.
7. **GitHub Issues:** after an epic is approved, create one parent issue when useful and break the work into small independently deliverable issues. Every child issue links its epic and source requirements. Issue descriptions carry implementation context and acceptance criteria.
8. **Implementation:** start from a GitHub Issue, use the official BMAD build skill when the work benefits from it, write a focused implementation plan in the issue or its discussion, then use a feature branch, small Conventional Commits, validation, and a pull request with independent review.

## Canonical artifact map

| Artifact                        | Canonical location                                      | Purpose                                                                                       |
| ------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Vision and principles           | docs/product/vision.md, docs/product/principles.md      | Stable product intent and guardrails                                                          |
| Product brief                   | docs/product/brief.md                                   | Target problem, audience hypotheses, value, candidate first release, and discovery gaps       |
| PRD                             | docs/product/prd.md                                     | Goals, journeys, functional and non-functional requirements, measures, constraints, and scope |
| UX and information architecture | docs/design/information-architecture.md and docs/design | Navigation and accepted experience decisions                                                  |
| Architecture                    | docs/architecture and docs/adr                          | Shared technical boundaries and durable decisions                                             |
| Epics                           | docs/epics                                              | Capability contracts and dependency rationale, without status                                 |
| Execution work and status       | GitHub Issues and Pull Requests                         | Assignment, acceptance, dependencies, implementation, review, and state                       |

When a BMAD workflow creates a working draft or memlog in _bmad-output, use it to reach a reviewed decision and promote accepted content into the canonical artifact. Do not use a local backlog, ticket tree, TODO file, or BMAD status file to mirror GitHub execution state.

## Epics to GitHub Issues

An epic is a product planning boundary, not a second board. Keep its stable key (E-01, E-02, and so on) in docs/epics. When approved for implementation, create a GitHub parent issue if parent/sub-issues are available; otherwise reference the epic key in each issue and use a milestone only when it helps grouping. Child issues should fit one focused branch and pull request.

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

## Issue to pull request

1. Read the issue, linked epic and requirements, relevant architecture/ADRs, and current code patterns.
2. Write the implementation plan into the GitHub issue before code when the work needs a plan; keep the issue as durable handoff context.
3. Branch using feat/<issue>-<name>, fix/<issue>-<name>, refactor/<issue>-<name>, docs/<issue>-<name>, or chore/<issue>-<name>.
4. Implement only the scoped outcome, add relevant tests, and make small atomic Conventional Commits.
5. Run relevant validation and open a PR linked to the issue. Include scope, validation, and review notes.
6. Request independent review. The implementation agent does not merge its own PR.

## Initial use

The current product brief and PRD are drafts based on the supplied product vision, not user research or approved MVP commitments. The first execution issue is [#1](https://github.com/Julestblt/Stride/issues/1), which tracks discovery for E-00. Before the first BMAD workflow run, ask bmad to create and activate the Stride product initiative. The next BMAD step is discovery to validate the primary athlete segment and the candidate first-release boundary. Do not create implementation issues from speculative roadmap items before those decisions are reviewed.

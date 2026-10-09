---
title: "Implement the French responsive 404 page"
type: "feature"
ticket: ""
created: "2026-10-09"
status: "built"
baseline_revision: "f2b86c85e36aa27cf2f8a455e653d19052968b5c"
route: "oneshot"
route_source: "auto"
risk: "low"
review: "quick"
review_source: "pinned"
lenses_ran: ["quick", "quick"]
review_loop_iteration: 0
context:
  - "docs/design/design-system.md"
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Unknown URLs currently have no branded Stride not-found experience, so athletes do not get the French recovery path shown in the approved v1 designs.

**Approach:** Implement the root Next.js not-found screen to match the supplied desktop and mobile references, including the route illustration and working home, browser-back, and sign-in actions.

</frozen-after-approval>

## Implementation Notes

This fits the oneshot route because it is one isolated screen, needs no domain or data changes, and should touch only the root not-found component and a small client-side history button.

Implementation uses the root `not-found.tsx` convention, `Button`, `MonoLabel`, and `StrideMark`; the trail artwork is inline decorative SVG. The French language is scoped to this screen, and browser history is isolated in a small client component.

Validation passed: `npm run lint`, `npm run typecheck`, and Prettier check for both implementation files. No automated or browser tests were added or run.

Quick review found that history navigation needed a direct-entry fallback and that the mobile 404 number was undersized. The back action now returns home when no prior history entry exists, and the number uses the reference scale at mobile and desktop breakpoints.

The final quick review found no remaining issues.

## Review Triage Log

- `low` — History back could do nothing on a directly opened 404; added a home fallback when browser history has no earlier entry.
- `low` — The mobile 404 number was smaller than the reference; increased it to 112px and set the desktop breakpoint to 128px.

## Verification

**Commands:**

- `npm run lint` -- expected: no lint errors.
- `npm run typecheck` -- expected: no TypeScript errors.

**Manual checks:**

- Compare the rendered page to desktop and mobile references; confirm home, browser-back, and sign-in actions.

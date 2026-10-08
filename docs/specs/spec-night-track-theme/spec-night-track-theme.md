---
id: SPEC-night-track-theme
companions:
  - ../../design/design-system.md
  - ../../../design/references/system/product-system/screenshots/board.png
  - ../../../design/references/system/reusable-patterns/screenshots/board.png
sources: []
---

# Night Track theme and design tokens

## Why

Stride needs a reusable visual foundation before its first authentication screens. The supplied Night Track references establish a calm graphite interface with precise provenance and restrained Volt emphasis. This slice lets the existing application express that direction without prematurely building product screens.

## Capabilities

- **CAP-1: Apply the Night Track visual language.** The application can apply consistent color, typography, surface, border, and state tokens. **Success:** the foundation page renders with semantic Night Track tokens, and components do not need scattered palette values.
- **CAP-2: Provide usable global interaction states.** Keyboard focus, disabled, invalid, and reduced-motion defaults are available globally; loading skeletons use shadcn when needed. **Success:** focus and validation remain visible, and reduced-motion preference removes nonessential movement.

## Constraints

- Treat the supplied system PNGs as the visual source of truth.
- Use the repository's Tailwind CSS v4, Next.js font loading, and accessible React patterns.
- Use semantic CSS variables and Tailwind theme names.
- Keep the current page a small foundation surface. Do not add an application shell, dashboard, authentication UI, or unrelated dependency. Initialize shadcn as the accessible primitive foundation without adding unused components.
- Keep the design predominantly graphite and chalk; reserve Volt for meaningful emphasis.

## Non-goals

- Authentication, onboarding, application navigation, data visualization, or product behavior.
- Recreating reference screens as markup or adding a component catalog.
- Decorative animation or a new motion library.

## Success signal

At desktop and mobile viewports, the foundation page uses the approved Night Track palette and font roles, communicates focus and validation states, and respects reduced motion. Formatting, lint, typecheck, unit, browser, and production build checks pass.

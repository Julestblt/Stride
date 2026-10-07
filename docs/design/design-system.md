# Stride design system

Stride's approved visual direction is **Night Track**. The PNGs in [`design/references/system`](../../design/references/system/) are the visual source of truth. Production code should match their intent as closely as practical while using Stride architecture, Tailwind, accessible React patterns, and shadcn primitives where useful. The images define intent, not implementation technology; do not copy mockup code.

## Color

| Token       | Value     | Use                                                                                   |
| ----------- | --------- | ------------------------------------------------------------------------------------- |
| Shell       | `#080907` | Global page background                                                                |
| Inset       | `#0C0D0B` | Content inset and deepest panel                                                       |
| Surface     | `#131411` | Cards and grouped content                                                             |
| Raised      | `#1A1B18` | Selected rows and raised controls                                                     |
| Hairline    | `#262722` | Subtle separators and restrained borders                                              |
| Chalk       | `#EDECE6` | Primary text and high-contrast content                                                |
| Secondary   | `#B3B2AA` | Body support text                                                                     |
| Muted       | `#8A8981` | Metadata and quiet supporting text                                                    |
| Volt        | `#D5FF3F` | Coach presence, primary action, selection, progress, and meaningful positive emphasis |
| Garmin      | `#5E8FB8` | Provider provenance                                                                   |
| Investigate | `#FF6A3D` | Failed or investigate state                                                           |

Use Volt sparingly. Success, warning, danger, provider, and training-zone states need distinct semantic tokens; do not conflate status meaning with the brand accent. Do not scatter raw color values through components. Add or adjust semantic tokens only when a reference or actual state requires them.

## Typography

- **Instrument Sans** is the UI, body, and coach voice.
- **Barlow Condensed** is for prominent numerical values and race-bib-style metrics.
- **IBM Plex Mono** is for compact labels, provenance, dates, units, and technical metadata.

Load fonts with `next/font` from the root layout so they are self-hosted and avoid runtime font requests and layout shift. Use semantic Tailwind font tokens rather than repeating font stacks. Keep labels legible and avoid using condensed type for paragraphs.

## Surfaces and shape

Establish hierarchy with graphite surfaces and insets first. Prefer a one-pixel hairline over a decorative shadow. Use roughly 6px control radii and 8px surface radii; reserve stronger rounding for small chips where it aids recognition. Avoid glass effects, glow, startup gradients, and default-dashboard styling.

## Spacing and density

Use Tailwind's 4px spacing rhythm. Keep data surfaces compact but breathable: align labels, values, units, status, and provenance; use dividers to separate rows instead of boxing every value. Important metrics should show units and context. A number without a verdict or useful interpretation should not lead a screen.

## Accent, state, and provenance

Volt belongs to a small set of meaningful signals: Stride Coach presence, the primary action, the selected destination, progress, and important positive emphasis. Do not make every interactive element green.

Use inline, compact provenance labels such as `GARMIN · UPDATED TODAY`, `ENTERED MANUALLY`, and `STRIDE ESTIMATE · MODERATE`. Keep origin, freshness, and confidence adjacent to the value they qualify. A user override must be distinguishable from provider data. State also needs a shape or label so color is never the only cue.

## Components and shadcn

Use shadcn as the accessible primitive layer: inspect installed components and project configuration, search official components or registries before recreating an interaction, and compose primitives when appropriate. Apply Stride's semantic tokens to their surfaces, borders, focus, and states. Do not initialize or add components solely to make the repository look complete. Radix bones, Stride skin.

## Loading and motion

Prefer React Server Components and stable content. Use local skeletons only for independently loading content; their geometry should match the final content and their contrast should stay subtle. Long imports and synchronization need explicit progress and states such as partial, delayed, retrying, or reconnect required, not a full-page spinner or skeleton pretending to be progress.

Motion explains state and hierarchy. Keep transitions restrained; reference timings are starting points, not required animations. Respect `prefers-reduced-motion` by resolving transitions and animations to their end state. Do not animate for decoration.

## Responsive behavior

Preserve information hierarchy from desktop to mobile. The references show a desktop contextual sidebar and inset work area; on mobile, navigation becomes a sheet with four thumb-reachable destinations and a central Ask action. Keep status and provenance visible at narrow widths. Screen-specific references belong below `design/references/<screen>/`; keep system references in `design/references/system/`. PNGs remain the visual source of truth. Optional HTML can explain structure but must not be copied into production.

## Reference use

Before styling a screen, inspect its matching PNG at the target viewport and the system references. Compare implementation screenshots at the same viewport, iterate on material differences, and retain accessible focus, contrast, and reduced-motion behavior. System patterns include the contextual sidebar, recommendation anatomy, decision ledger, provenance rows, sync-state banners, onboarding stepper, verdict rows, and restrained coach activity indicator; reuse these where the screen needs them rather than creating new visual idioms.

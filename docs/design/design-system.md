# Stride design system

Stride's approved visual direction is **Night Track**. The PNGs in [`design/references/system`](../../design/references/system/) are the visual source of truth. Production code should match their intent as closely as practical while using Stride architecture, Tailwind, accessible React patterns, and shadcn primitives where useful. The images define intent, not implementation technology; do not copy mockup code.

## Color

| Token       | Utility root                        | Value     | Use                                                                                   |
| ----------- | ----------------------------------- | --------- | ------------------------------------------------------------------------------------- |
| Shell       | `background`                        | `#080907` | Global page background and sidebar                                                    |
| Inset       | `surface-inset`                     | `#0C0D0B` | Content inset and deepest panel                                                       |
| Surface     | `surface`                           | `#131411` | Cards, fields, menus and grouped content                                              |
| Raised      | `surface-raised`                    | `#1A1B18` | Selected rows, hover and raised controls                                              |
| Hairline    | `border`                            | `#262722` | Separators and restrained frames                                                      |
| Strong line | `border-strong`, `input`            | `#34352F` | Field and outline-control borders, tags, chips                                        |
| Subtle line | `border-subtle`                     | `#1F201C` | Inner dividers and progress tracks                                                    |
| Chalk       | `foreground`                        | `#EDECE6` | Primary text and selected choice fill                                                 |
| Secondary   | `muted`                             | `#B3B2AA` | Body support text                                                                     |
| Muted       | `muted-foreground`                  | `#8A8981` | Metadata and quiet supporting text                                                    |
| Dim         | `dim`                               | `#4A4B45` | Declined, removed and inactive marks                                                  |
| Volt        | `accent`                            | `#D5FF3F` | Coach presence, primary action, selection, progress, and meaningful positive emphasis |
| Success     | `success` (+ `-surface`, `-border`) | `#7FD4A0` | Done, accepted, improving, up to date                                                 |
| Warning     | `warning` (+ `-border`)             | `#FFB547` | Needs you, watch, partial, retrying                                                   |
| Investigate | `danger` (+ `-surface`, `-border`)  | `#FF6A3D` | Failed, expired or investigate state                                                  |
| Garmin      | `provider`                          | `#5E8FB8` | Provider provenance                                                                   |
| Zones       | `zone-1` … `zone-5`                 | see CSS   | Training intensity; zone 2 is the provider blue and zone 5 the danger orange          |

Values live once in `src/app/globals.css` and are exposed through `@theme inline`. Use Volt sparingly. Success, warning, danger, provider, and training-zone states have distinct semantic tokens; do not conflate status meaning with the brand accent. Do not scatter raw color values through components. Add or adjust semantic tokens only when a reference or actual state requires them.

## Typography

- **Instrument Sans** is the UI, body, and coach voice.
- **Barlow Condensed** is for prominent numerical values and race-bib-style metrics.
- **IBM Plex Mono** is for compact labels, provenance, dates, units, and technical metadata.

Load fonts with `next/font` from the root layout so they are self-hosted and avoid runtime font requests and layout shift. Use semantic Tailwind font tokens rather than repeating font stacks. Keep labels legible and avoid using condensed type for paragraphs.

The type scale is tokenized as Tailwind font-size utilities with their own line height and tracking: `text-display` (52px), `text-headline` (26px), `text-title` (22px), `text-lead` (17px), `text-body` (15px), `text-meta` (13px), and the mono label sizes `text-label` (11px), `text-micro` (10px), and `text-nano` (9px). Tailwind's `text-xs`, `text-sm`, and `text-xl` cover 12, 14, and 20px. Metrics use `text-metric-sm`, `text-metric`, `text-metric-lg`, and `text-metric-hero`, normally through the `Metric` component. Mono labels are always uppercase; use `MonoLabel` instead of repeating the font, size, case, and tone classes.

`cn` in `src/lib/utils.ts` is configured with these size and radius scales so that class merging keeps a Stride size next to a text color and lets a later radius override an earlier one. Extend that configuration when adding a font-size or radius token.

## Surfaces and shape

Establish hierarchy with graphite surfaces and insets first. Prefer a one-pixel hairline over a decorative shadow; overlays use a dimmed shell and a strong hairline, never blur or glass. Radii are semantic: `rounded-mark` (2px) for bars and segments, `rounded-tag` (5px) for tags and keys, `rounded-control` (6px) for compact buttons, chips and rows, `rounded-surface` (8px) for fields, full-size buttons, choices and menus, `rounded-card` (12px) for cards, banners and ledger entries, and `rounded-panel` (14px) for the inset work area. Reserve full rounding for status dots, steps, and day toggles. Avoid glass effects, glow, startup gradients, and default-dashboard styling.

## Spacing and density

Use Tailwind's 4px spacing rhythm. Keep data surfaces compact but breathable: align labels, values, units, status, and provenance; use dividers to separate rows instead of boxing every value. Important metrics should show units and context. A number without a verdict or useful interpretation should not lead a screen.

## Accent, state, and provenance

Volt belongs to a small set of meaningful signals: Stride Coach presence, the primary action, the selected destination, progress, and important positive emphasis. Do not make every interactive element green.

Use inline, compact provenance labels such as `GARMIN · UPDATED TODAY`, `ENTERED MANUALLY`, and `STRIDE ESTIMATE · MODERATE`. Keep origin, freshness, and confidence adjacent to the value they qualify. A user override must be distinguishable from provider data. State also needs a shape or label so color is never the only cue.

## Components and shadcn

Stride's UI has three layers:

1. **Primitives** in `src/components/ui`: shadcn/Radix components installed with the official CLI and restyled to Night Track. They own accessibility and behavior and know nothing about running.
2. **Stride patterns** in `src/components/stride`: reusable product compositions from the system references, built on the primitives. They take content and state through props and contain no data fetching or domain decisions.
3. **Screens and features** in `src/app` and `src/features`: compose patterns and primitives. They do not recreate low-level styles.

Installed primitives: Alert, AlertDialog, Badge, Button, Checkbox, Collapsible, DropdownMenu, Field, Input, InputGroup, Kbd, Label, Progress, Separator, Sheet, Sidebar, Skeleton, Tabs, Textarea, Toggle, ToggleGroup, and Tooltip. Night Track specifics:

- `Button` variants are `default` (Volt), `outline`, `secondary`, `ghost`, `destructive`, and `link`; size `default`/`lg` is the full-size form action, `md` the compact 38px action used in cards, and `sm`/`xs` the inline actions.
- `Badge` is the mono status tag (`outline`, `accent`, `success`, `warning`, `danger`). Counts and readiness values in navigation use `NavBadge`.
- `ToggleGroup` variants are `choice` (chalk fill when selected), `day` (round, Volt ring), and `segment` (connected range control). `Tabs` are underline tabs with a Volt indicator.
- `Sidebar` is configured for 264px expanded, a 56px icon rail with tooltips, and an off-canvas sheet below 768px. Use `variant="inset"` and `collapsible="icon"`.
- The product is dark-only: primitives do not use `dark:` variants, which would follow the operating system rather than Stride.

Stride patterns: `MonoLabel`, `SectionHeader`, `Metric`, `StrideMark`, status marks (`TrendMark`, `TrendLabel`, `DirectionMark`, `SourceMark`, `DecisionMark`, `DoneMark`, `PulseDot`), `VerdictList`/`VerdictRow`, `ProvenanceLabel`, `SignalList`/`SignalRow`, `ProviderValueInput`, `SignalChip`, `ConfidenceMeter`, `Sparkline`, `Recommendation` and its parts, `LedgerEntry`/`DecisionLegend`, `CoachActivity`, `CoachNote`, `SyncStatus`, `Stepper`/`StepperItem`/`StepperSegments`, `SessionShape`, the sidebar parts (`NavGoalSwitcher`, `NavItem`, `NavBadge`, `NavDayRow`, `NavUser`), and `MobileTabBar`/`MobileTab`/`MobileAskAction`.

Tailwind utilities inside React components own layout, responsive behavior, typography, and component appearance. Reserve `globals.css` for tokens, base styles, and global accessibility defaults. Standard shadcn color aliases map to Night Track roles: card → surface, popover → surface, secondary → raised surface, primary → accent, destructive → danger, input → strong line, and ring → focus. Adapt registry styles before use: Stride's `muted` means supporting text, so replace registry `bg-muted` surfaces with `bg-surface-raised`, and registry `bg-accent` hover states with `bg-surface-raised`, because Stride's accent is Volt.

### Reuse rule

Before creating a new component or local style:

1. Check the installed shadcn primitives in `src/components/ui` and the official registry.
2. Check the Stride patterns in `src/components/stride` and the design system gallery.
3. Reuse or extend them, adding a variant or prop when the reference shows a genuine variation.
4. Create a new abstraction only when the pattern is genuinely new, and put it in the right layer.

Auth, onboarding, and application screens must compose this system rather than recreate local variants.

### Validation gallery

`/design-system` renders every token, primitive, pattern, and state, and `/design-system/shell` renders the application shell with the expanded sidebar, the icon rail, and the mobile sheet and tabs. Both routes are development-only: they return 404 in production builds. Use them to compare against `design/references/system` at the same viewport before and after changing the system. Browser tests in `tests/e2e/design-system.spec.ts` cover keyboard behavior, state exposure, reduced motion, and responsive fit.

## Loading and motion

Prefer React Server Components and stable content. Use local skeletons only for independently loading content; their geometry should match the final content and their contrast should stay subtle. Long imports and synchronization need explicit progress and states such as partial, delayed, retrying, or reconnect required, not a full-page spinner or skeleton pretending to be progress.

Motion explains state and hierarchy. Keep transitions restrained; reference timings are starting points, not required animations. Respect `prefers-reduced-motion` by resolving transitions and animations to their end state. Do not animate for decoration.

Motion tokens: `ease-stride` (`cubic-bezier(0.4, 0, 0.2, 1)`), `animate-rise` (320ms rise 8px and fade for recommendations and findings), `animate-trace` (1.6s coach reading sweep), `animate-sheen` (1.8s import lane), and `animate-breathe` (2.4s sync dot). The sidebar collapses in 220ms. Apply looping animations with `motion-safe:` so reduced motion shows the static end state.

## Responsive behavior

Preserve information hierarchy from desktop to mobile. The references show a desktop contextual sidebar and inset work area; on mobile, navigation becomes a sheet with four thumb-reachable destinations and a central Ask action. Keep status and provenance visible at narrow widths. Screen-specific references belong below `design/references/<area>/<screen>/` as described in [`design/references/README.md`](../../design/references/README.md); keep system references in `design/references/system/`. PNGs remain the visual source of truth. Optional HTML can explain structure but must not be copied into production.

## Reference use

Before styling a screen, inspect its matching PNG at the target viewport and the system references. Compare implementation screenshots at the same viewport, iterate on material differences, and retain accessible focus, contrast, and reduced-motion behavior. System patterns include the contextual sidebar, recommendation anatomy, decision ledger, provenance rows, sync-state banners, onboarding stepper, verdict rows, and restrained coach activity indicator; reuse these where the screen needs them rather than creating new visual idioms.

Reference images are read-only inputs, never application assets. Do not modify, recreate, transform, or derive production assets from them without explicit instruction. Keep temporary comparison screenshots untracked in `test-results/` or outside the repository; do not commit visual validation evidence by default.

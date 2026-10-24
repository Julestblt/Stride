# Stride design system

Stride's approved visual direction is **Night Track**. The `Foundations` artboards of the [design board](design-board.md) are the visual source of truth. Production code should match their intent as closely as practical while using Stride architecture, Tailwind, accessible React patterns, and shadcn primitives where useful. The artboards define intent, not implementation technology; do not copy mockup code.

## Color

| Token       | Utility root                        | Value     | Use                                                                                   |
| ----------- | ----------------------------------- | --------- | ------------------------------------------------------------------------------------- |
| Shell       | `background`                        | `#080907` | Global page background and sidebar                                                    |
| Inset       | `surface-inset`                     | `#0C0D0B` | Content inset and deepest panel                                                       |
| Surface     | `surface`                           | `#131411` | Cards, fields, menus and grouped content                                              |
| Raised      | `surface-raised`                    | `#1A1B18` | Selected rows, hover and raised controls                                              |
| Panel       | `surface-panel`                     | `#0F100E` | Chart panels and past day cards                                                       |
| Current     | `surface-current`                   | `#161714` | Today's day card                                                                      |
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
| Garmin      | `provider` (+ `-muted`)             | `#5E8FB8` | Provider provenance and easy volume; `provider-muted` is past or light volume         |
| Zones       | `zone-1` … `zone-5`                 | see CSS   | Training intensity; zone 2 is the provider blue and zone 5 the danger orange          |
| Medical     | `staff-medical`                     | `#62D2C8` | Medical specialist identity on the staff team page and its role marks                 |

Values live once in `src/app/globals.css` and are exposed through `@theme inline`. Use Volt sparingly. Success, warning, danger, provider, and training-zone states have distinct semantic tokens; do not conflate status meaning with the brand accent. Do not scatter raw color values through components. Add or adjust semantic tokens only when a reference or actual state requires them.

### Light theme

Night Track is dark by default. Athletes can switch to Clair, Sombre, or Système from the header theme menu (`src/features/theme`). The choice is stored per browser under `stride-theme`, and an inline script sets `data-theme` on `<html>` before first paint. `:root[data-theme="light"]` in `globals.css` redefines every color token, so components keep using semantic utilities and need no `dark:` variants. In light, Volt becomes a deep olive (`#4D6B00`) to stay readable on white. Maps switch between the CARTO Dark Matter and Positron styles. The light palette is on the board artboard `Foundations · Theme · Light palette`.

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

Installed primitives: Alert, AlertDialog, Badge, Button, Checkbox, Collapsible, DropdownMenu, Field, Input, InputGroup, Kbd, Label, Popover (the desktop notification panel: 14px radius, strong hairline), Progress, Separator, Sheet, Sidebar, Skeleton, Sonner (`Toaster`), Tabs, Textarea, Toggle, ToggleGroup, and Tooltip. Night Track specifics:

- `Button` variants are `default` (Volt), `outline`, `secondary`, `neutral` (chalk fill for draft application), `ghost`, `destructive`, and `link`; size `default`/`lg` is the full-size form action, `md` the compact 38px action used in cards, and `sm`/`xs` the inline actions.
- `Badge` is the mono status tag (`outline`, `accent`, `success`, `warning`, `danger`). Counts and readiness values in navigation use `NavBadge`.
- `ToggleGroup` variants are `choice` (chalk fill when selected), `day` (round, Volt ring), and `segment` (connected range control). `Tabs` are underline tabs with a Volt indicator.
- `Sidebar` is configured for 264px expanded, a 56px icon rail with tooltips, and an off-canvas sheet below 768px. Use `variant="inset"` and `collapsible="icon"`.
- The product is dark-only: primitives do not use `dark:` variants, which would follow the operating system rather than Stride.

Stride patterns: `MonoLabel`, `SectionHeader`, `Metric`, `StrideMark`, status marks (`TrendMark`, `TrendLabel`, `DirectionMark`, `SourceMark`, `DecisionMark`, `DoneMark`, `PulseDot`), `VerdictList`/`VerdictRow`, `ProvenanceLabel`, `SignalList`/`SignalRow`, `ProviderValueInput`, `SignalChip`, `ContextChip`/`ContextChipLink` (an item attached to a Coach message: icon, title and mono date; the removable chip sits in the composer with a remove button that is 44px below `md`, the link chip sits on the sent message and opens the record), `SuggestedReplies` (a group of short French replies above the Coach composer; outline pills of 44px that scroll horizontally below `md`, 32px buttons that wrap from `md`; a tap sends the reply), `ConfidenceMeter`, `Sparkline`, `Recommendation` and its parts, `LedgerEntry`/`DecisionLegend`, `CoachActivity`, `CoachNote`, `SyncStatus`, `Stepper`/`StepperItem`/`StepperSegments`, `SessionShape`, `SessionKindTile` (session family tile in four sizes, with rest and race states), the sidebar parts (`NavGoalSwitcher`, `NavItem`, `NavBadge`, `NavDayRow`, `NavUser`), and `MobileTabBar`/`MobileTab`/`MobileAskAction` (the central Coach action takes an active state and a count badge).

Tailwind utilities inside React components own layout, responsive behavior, typography, and component appearance. Reserve `globals.css` for tokens, base styles, and global accessibility defaults. Standard shadcn color aliases map to Night Track roles: card → surface, popover → surface, secondary → raised surface, primary → accent, destructive → danger, input → strong line, and ring → focus. Adapt registry styles before use: Stride's `muted` means supporting text, so replace registry `bg-muted` surfaces with `bg-surface-raised`, and registry `bg-accent` hover states with `bg-surface-raised`, because Stride's accent is Volt.

### Reuse rule

Before creating a new component or local style:

1. Check the installed shadcn primitives in `src/components/ui` and the official registry.
2. Check the Stride patterns in `src/components/stride` and the design system gallery.
3. Reuse or extend them, adding a variant or prop when the reference shows a genuine variation.
4. Create a new abstraction only when the pattern is genuinely new, and put it in the right layer.

Auth, onboarding, and application screens must compose this system rather than recreate local variants.

### Feedback messages

The outcome of an action is a sonner toast: `toast.success` after every successful mutation, upload, copy or sync request, and `toast.error` when an action, a mutation or a Coach turn fails. The `Toaster` is mounted once in the root layout with the Night Track surface, a close button and a single 6-second duration. Toasts carry one short French sentence; secondary detail goes in `description`. Pass an `id` when the same action can repeat, so a new toast replaces the previous one. Server actions that redirect report their result through a `?status=` parameter read by a client notice such as `SettingsNotice`, which shows the toast and clears the parameter.

A notification records something that happened in the background, such as a proposal ready for review or a staff reply, and waits in the notification center until the athlete reads it. It never repeats a toast: the athlete's own actions get a toast, and when such an action settles a notification, for example applying or rejecting a proposal or answering a question, the notification is resolved and read instead of a new one being created.

Keep a message inline when it belongs to the page rather than to the action: field and step validation, form validation summaries, form-level sign-in, sign-up, recovery and reset errors, Garmin credential and code notices, actionable conflicts, autosave indicators, persistent connection and review banners, empty states, loading states and error boundaries.

### Validation gallery

`/design-system` renders every token, primitive, pattern, and state, and `/design-system/shell` renders the application shell with the expanded sidebar, the icon rail, and the mobile sheet and tabs. Both routes are development-only: they return 404 in production builds. Use them to compare against the board's `Foundations` artboards at the same viewport before and after changing the system. Browser tests in `tests/e2e/design-system.spec.ts` cover keyboard behavior, state exposure, reduced motion, and responsive fit.

## Loading and motion

Server reads, revalidation after mutations, prefetching and programmatic navigation follow [frontend data loading](../architecture/frontend-data-loading.md).

### Garmin data activity

The authenticated shell owns one data activity controller. Its read-only panel shows the four normalized Garmin categories, their actual state, last success and verified activity count. The application status endpoint is independent of onboarding and validates responses without exposing provider credentials. The athlete can request a sync with "Synchroniser maintenant" in the panel or in Garmin settings, or with a pull-to-sync gesture (64 px) at the top of a mobile screen. The request goes through `requestGarminSync`, which calls garmin_mcp `POST /v1/connections/garmin/sync`. While its activities and recovery jobs run, the status line reads `Garmin · n sur 2 · famille` and the thread fills instead of sweeping. When they settle, the page refreshes without the "Afficher" pill. garmin_mcp accepts one request every five minutes, so the controls stay disabled until `manual_sync_available_at` and say when a sync becomes possible. Background syncs keep the quiet behavior and the pill.

Polling is serialized, pauses while hidden or offline, aborts on unmount and stops after four consecutive failures. A valid observation is retained during outages. Active imports use provider blue, with a single thread delayed by 300ms and visible for at least 600ms. Once shown, it waits 250ms before hiding so back-to-back signals keep one continuous thread instead of restarting. A screen change has one feedback only: when a route loading boundary mounts its fallback, the fallback replaces navigation feedback and a navigation thread hides at once. Supported Next Link pending state and focused router transitions show the thread only while no fallback is mounted, for example in-place filter, search or period changes and routes without a loading boundary, while existing content remains readable. Synchronization and data refreshes still show the thread over a fallback. Fallback registration follows mount and unmount. Prefetched instant transitions and modified clicks do not register navigation activity. Page loading never changes the synchronization status into a page-loading claim. Each screen header owns the thread at its actual bottom border. Activities show it in the list header on mobile list screens and in the preview toolbar on desktop and mobile detail screens, with exactly one visible thread. Activity fallbacks reuse the real split frame and headers. During preview suspension, the latest resolved list snapshot keeps matching filter, search and pagination content readable and restores its saved scroll position; only the preview shows placeholders. Initial list loads and previews without a matching snapshot show list placeholders. The snapshot lives only within the activities routes, and resolved server data replaces it, including after explicit Garmin fresh-data application. Server list reads and revalidation remain unchanged. Full-detail loading uses content placeholders. Known header titles remain readable text. Screen scroll containers reserve a stable scrollbar gutter so a short fallback and the taller resolved content keep the same width. Race workspace fallbacks cover content only because their layouts already own the headers, and they show no thread. The races list uses a route group layout that owns the header, so its fallback keeps the real title and filter, which stay readable while only the dependent content is skeletonized. Every page under `(app)` and `settings` has a route loading boundary, so a screen change shows the destination skeleton at once, following the board's `Foundations · Loading states` rules: known titles, breadcrumbs, section tabs and filters stay real, data-dependent content becomes simple shapes at the final geometry, and the skeleton registers through `LoadingScope` with a French `Chargement de …` label. A route whose child routes need their own skeleton keeps its page in a route group, such as `coach/(list)`, `gear/(list)`, `gear/[id]/(detail)`, `progress/(fitness)`, `settings/(overview)` and `settings/connections/(overview)`, so a parent fallback never stands in for a child screen. Activity list loading is isolated in the `(list)` group. The race detail layout awaits owner-scoped data, so it sits in a `(detail)` route group whose loading boundary renders the full entry skeleton: the race header, breadcrumb and tabs placeholders. The `[id]` loading boundary still covers race tab switches. Activity routes have no data-awaiting layout: each page resolves its own activity, so `activities/[id]/loading.tsx` renders the preview skeleton with the retained list snapshot at once, in a single phase, and `[id]/details` has its own full-detail skeleton. A list row whose activity is already displayed in the detail pane does not navigate, and the route map rebuilds only when its route changes, not when a refresh delivers an equal view. Because the fallback starts the stream, an unknown or foreign race, activity, pair or conversation streams the not-found screen with status 200 and a `noindex` robots meta tag, as documented for Next streaming; ownership checks are unchanged and no data from another athlete is rendered. Initial direct SSR still waits for authentication in the root layouts before streaming. The app and settings layouts then await only the athlete identity (profile and goals), so the name, staff portraits, goal and race links render with the frame. Navigation badges, the plan blocks group, coach attention and the notification feed stream behind `<Suspense>`: nav items render without their badge, the plan group shows label and placeholder rows on plan routes, and the bell links to `/notifications` until the feed arrives. The shell never reads Garmin on the server: the data activity provider starts in a `checking` state, shown as a status placeholder announced as "Chargement de l’état Garmin", until its first poll resolves; the reconnect banner and the Connexions sync age follow that poll. Slow blocks stream inside a ready screen. The Corps day view renders its header, day navigator and seven-night strip from stored data, then streams the live Garmin day (KPIs, timeline, reading, night and moments) behind `HealthDayLoading`, keyed by day so a day change shows that skeleton under the navigator. On the race course tab, the Open-Meteo weather streams: until it resolves, the cards render without weather and a `Météo du jour J` skeleton with the real start and finish pills holds the weather card position. Synchronization labels such as `Synchronisé 06:12` on Corps come from the client data activity observation, so no page reads Garmin on the server for a label. The root page and the `(app)`, `settings`, `onboarding` and `coach-spike` layouts keep `force-dynamic`: without Supabase environment variables, as in CI builds, the Supabase client throws before `cookies()` is read, so Next would otherwise try to prerender those routes.

Background observations never refresh the screen. New category success timestamps or increasing activity counts offer an explicit **Afficher** action; applying or navigating acknowledges that observation. Poll timestamps alone do not count as fresh data. Status and notification overlays preserve screen geometry. Offline stops the thread and keeps readable content. Garmin reconnect stops synchronization activity only; pending stored-data page navigation still shows its thread.

The backend reports categories rather than individual metric freshness. Existing activity and health values can therefore be scoped to activities and recovery only; the UI must not invent per-metric import states. Category-scoped metric values dim during actual imports while labels remain readable. Unrelated race content remains unchanged.

Prefer React Server Components and stable content. Use local skeletons only for independently loading content; their geometry should match the final content and their contrast should stay subtle. Long imports and synchronization need explicit progress and states such as partial, delayed, retrying, or reconnect required, not a full-page spinner or skeleton pretending to be progress.

Motion explains state and hierarchy. Keep transitions restrained; reference timings are starting points, not required animations. Respect `prefers-reduced-motion` by resolving transitions and animations to their end state. Do not animate for decoration.

Motion tokens: `ease-stride` (`cubic-bezier(0.4, 0, 0.2, 1)`), `animate-rise` (320ms rise 8px and fade for recommendations and findings), `animate-trace` (1.6s coach reading sweep), `animate-sheen` (1.8s import lane), and `animate-breathe` (2.4s sync dot). The sidebar collapses in 220ms. Apply looping animations with `motion-safe:` so reduced motion shows the static end state.

## Errors and missing items

Errors and missing items stay inside the app shell, following the board's `System · In-app error` and `System · In-app not found` artboards. The sidebar, header and mobile tab bar remain usable, and no technical detail reaches the athlete; server errors are still logged by Next.

- `(app)/error.tsx` and `settings/error.tsx` render `RouteError` (`src/features/app-shell/components/route-state.tsx`): an `alert` with "Cette page n’a pas pu se charger.", a **Réessayer** button wired to the boundary's `retry()`, and a link back to Aujourd’hui. In `(app)`, the header names the current section from the URL.
- `notFound()` resolves to the nearest segment `not-found.tsx`, which renders `RouteNotFound` with item-specific French copy from `missingItems` (`src/features/app-shell/route-state.ts`): activity (`activities/[id]`), race (`races/(detail)`, because the race layout calls `notFound()`), pair (`gear/[id]`), conversation (`coach/[thread]`), and a generic page fallback at `(app)/not-found.tsx`. Each offers its list and Aujourd’hui.
- Outside the shell, `app/error.tsx` (for example when the app layout cannot read the athlete identity) and `app/global-error.tsx` (root layout failure) reuse the standalone 404 layout (`StandalonePage`) with the same error copy. `global-error` brings its own document, fonts, global styles and theme script. Unknown URLs still use the standalone root `not-found.tsx`.

## Responsive behavior

Preserve information hierarchy from desktop to mobile. The references show a desktop contextual sidebar and inset work area; below `md`, the sidebar becomes a sheet and `AppShell` renders the mobile tab bar at the bottom of the inset, in flow: Aujourd’hui, Plan, the central Coach action with the pending-attention badge, Activités and Progression. The bar is hidden in conversations (`/coach/new`, `/coach/<thread>`), where the composer takes the bottom, and the fresh-data pill sits above it. Keep status and provenance visible at narrow widths. Each screen has desktop and mobile artboards on the [design board](design-board.md). Artboard HTML explains structure and exact values but must not be copied into production.

## Reference use

Before styling a screen, read its matching artboard for the target device and the `Foundations` artboards, as described in [design-board.md](design-board.md). Compare implementation screenshots at the same viewport, iterate on material differences, and retain accessible focus, contrast, and reduced-motion behavior. System patterns include the contextual sidebar, recommendation anatomy, decision ledger, provenance rows, sync-state banners, onboarding stepper, verdict rows, and restrained coach activity indicator; reuse these where the screen needs them rather than creating new visual idioms.

The design board is a read-only input, never a source of application assets. Do not export, recreate, transform, or derive production assets from it without explicit instruction. Keep temporary comparison screenshots untracked in `test-results/` or outside the repository; do not commit visual validation evidence by default.

## Profile settings editing

All settings screens share the inset graphite background. Profile settings use a centered 1000px content container, 180px labels and 320px controls on desktop; mobile groups use inset surfaces and stacked provenance. Other settings screens retain their full-width composition. Heart-rate editing expands within the desktop metric row and uses the existing focus-trapping Sheet primitive on mobile. Applying an editor stages the value; the dirty save bar persists the full draft, and cancel restores the saved snapshot. Maximum editing contains only a bpm input. Threshold editing records an explicit lab, field-test or known-value source, without claiming unsupported threshold estimates, confidence, changed zones or adjusted sessions. The VFC row identifies the latest recorded night rather than an unimplemented 28-day baseline.

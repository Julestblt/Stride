# Frontend data loading

How Stride screens read, refresh and navigate. Loading skeletons, the navigation thread and Garmin data activity are described in [the design system](../design/design-system.md#loading-and-motion).

## Reads

- Pages and layouts are React Server Components that read through `src/server` modules with the request's `OnboardingContext`. `requireAthlete()` is cached per request, so every caller in one render shares the same context object.
- A read that the shell, a layout and a page (or several blocks of one page) can each call is wrapped in React `cache()`: `listRaces`, `loadPlanOverview`, `readActivePlan`, `readPlanRaces`, `readGoals`, `readActivity`, `readActivityDetail`, `listActivities`, `loadHeartRateZones`, `loadGear` and `loadWatchView`. Calls with the same arguments in one render run their queries once. Arguments are compared by identity, so pass the shared context and primitive filters; a fresh `Date` per call is a different key.
- `cache()` only deduplicates within one server render. Server Actions and route handlers run outside a render, where it is a passthrough, so a read after a write inside an action always sees the write.
- Stride has no server-side data cache: no `"use cache"`, `unstable_cache` or cache tags. Every navigation and refresh reads Supabase again.
- `tests/unit/server-render` runs Vitest with the `react-server` condition and renders a server component through Flight to prove each wrapped read queries once per render. Add a read there when you wrap it.

## Mutations

- A Server Action revalidates on success, inside the action, with `revalidatePath` for the narrowest route that shows the changed data. The current route and its layouts (the shell, badges and notification feed included) re-render in the action response anyway, and `revalidatePath` also clears the client prefetch cache.
- The client does not call `router.refresh()` after a successful action: the response already carries the new screen, and a second refresh renders it twice. Toasts, optimistic state and rollbacks on failure stay in the client.
- To land on another page after a mutation, the action calls `redirect()` after revalidating, which returns the destination in one render. Route-handler uploads cannot refresh the client, so `course-import` calls `showImportedRace` after a successful upload, or after importing the course from a Garmin activity, to revalidate the race and redirect to its page.
- `router.refresh()` remains only where the server cannot refresh the client: applying fresh Garmin data in the data activity provider, Coach polling and the refresh after a streamed turn, and route-handler uploads that stay on the page (the waypoint roadbook upload).

## Navigation

- Use `DataActivityLink` (imported as `Link`) for in-app navigation so the navigation thread follows `useLinkStatus`. Use `useDataActivityNavigation` for programmatic navigation outside a transition.
- Wrap programmatic `router.push` in a transition. After an `await` inside an async transition, call `startTransition(() => router.push(href))` again so the navigation stays pending with the action.
- Long lists set `prefetch={false}` on their per-item links (activities, races, plan history) so a scroll does not start server work for every visible row. Single destinations, tabs and filters keep the default prefetch.
- File downloads use a plain `<a href download>`, never `Link`, so the router does not fetch the file as a page.

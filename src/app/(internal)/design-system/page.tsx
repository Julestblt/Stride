import Link from "next/link";
import {
  LoaderCircleIcon,
  LogOutIcon,
  PlusIcon,
  SettingsIcon,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CoachActivity } from "@/components/stride/coach-activity";
import { CoachNote } from "@/components/stride/coach-note";
import { ConfidenceMeter } from "@/components/stride/confidence-meter";
import { DecisionLegend, LedgerEntry } from "@/components/stride/ledger-entry";
import { TrendLabel } from "@/components/stride/marks";
import { Metric } from "@/components/stride/metric";
import { MonoLabel } from "@/components/stride/mono-label";
import {
  ProvenanceLabel,
  SignalList,
  SignalRow,
} from "@/components/stride/provenance";
import { ProviderValueInput } from "@/components/stride/provider-value-input";
import {
  Recommendation,
  RecommendationActions,
  RecommendationBody,
  RecommendationDiff,
  RecommendationHeader,
  RecommendationSignals,
  RecommendationTitle,
} from "@/components/stride/recommendation";
import {
  SessionKindTile,
  type SessionTileKind,
} from "@/components/stride/session-kind-tile";
import { SessionShape } from "@/components/stride/session-shape";
import { SignalChip } from "@/components/stride/signal-chip";
import {
  Stepper,
  StepperItem,
  StepperSegments,
} from "@/components/stride/stepper";
import { StrideMark } from "@/components/stride/stride-mark";
import { SyncStatus } from "@/components/stride/sync-status";
import { VerdictList, VerdictRow } from "@/components/stride/verdict-row";
import { ContextChipsExample } from "./_components/context-chips";
import { GallerySection, Specimen } from "./_components/specimen";

const sessionTileKinds: SessionTileKind[] = [
  "easy",
  "long",
  "long_trail",
  "tempo",
  "threshold",
  "intervals",
  "hills",
  "race_specific",
  "strength",
  "mobility",
  "cross",
  "race",
  "rest",
];

const surfaces = [
  ["Shell", "bg-background", "background"],
  ["Inset", "bg-surface-inset", "surface-inset"],
  ["Surface", "bg-surface", "surface"],
  ["Raised", "bg-surface-raised", "surface-raised"],
  ["Panel", "bg-surface-panel", "surface-panel"],
  ["Current", "bg-surface-current", "surface-current"],
  ["Chalk", "bg-foreground", "foreground"],
  ["Volt", "bg-accent", "accent"],
] as const;

const states = [
  ["Success", "bg-success", "success"],
  ["Warning", "bg-warning", "warning"],
  ["Danger", "bg-danger", "danger"],
  ["Provider", "bg-provider", "provider"],
  ["Provider past", "bg-provider-muted", "provider-muted"],
  ["Dim", "bg-dim", "dim"],
] as const;

const lines = [
  ["Hairline", "border-border", "border"],
  ["Strong", "border-border-strong", "border-strong"],
  ["Subtle", "border-border-subtle", "border-subtle"],
] as const;

const zones = [
  ["Z1", "bg-zone-1"],
  ["Z2 · Garmin", "bg-zone-2"],
  ["Z3", "bg-zone-3"],
  ["Z4", "bg-zone-4"],
  ["Z5 · Error", "bg-zone-5"],
] as const;

const typeScale = [
  ["display", "text-display font-semibold", "A coach that thinks out loud."],
  [
    "headline",
    "text-headline font-semibold",
    "Run the threshold, but shorter.",
  ],
  [
    "title",
    "text-title font-semibold",
    "Reduce today's threshold to 4 × 6 min.",
  ],
  [
    "heading",
    "text-xl font-semibold tracking-tight",
    "Fitness, fatigue & form",
  ],
  [
    "lead",
    "text-lead text-muted",
    "Garmin provides the signals. Stride builds the athlete model.",
  ],
  [
    "body",
    "text-body",
    "Material changes wait for you; small ones apply with a 48 h undo.",
  ],
  ["ui", "text-sm", "Readiness, session, proposals, last run"],
  [
    "meta",
    "text-meta text-muted",
    "Proposed by Training · accepted by you · Mon 5",
  ],
  [
    "caption",
    "text-xs text-muted-foreground",
    "Composition shown in Settings · refined daily",
  ],
] as const;

const radii = [
  ["mark", "rounded-mark", "2px"],
  ["tag", "rounded-tag", "5px"],
  ["control", "rounded-control", "6px"],
  ["surface", "rounded-surface", "8px"],
  ["card", "rounded-card", "12px"],
  ["panel", "rounded-panel", "14px"],
] as const;

const motion = [
  ["Coach reading — trace sweep", "animate-trace", "1.6 s loop"],
  ["Recommendation — rise 8 px + fade", "animate-rise", "320 ms"],
  ["Import lane — sheen sweeps the bar", "animate-sheen", "1.8 s loop"],
  ["Sidebar ⌘B — width 264 → 56", "duration-220", "220 ms"],
  ["Sync — dot breathes", "animate-breathe", "2.4 s"],
] as const;

const session = [
  { minutes: 15, zone: 2 },
  { minutes: 6, zone: 4 },
  { minutes: 2, zone: 1 },
  { minutes: 6, zone: 4 },
  { minutes: 2, zone: 1 },
  { minutes: 6, zone: 4 },
  { minutes: 8, zone: 4, removed: true },
  { minutes: 10, zone: 2 },
] as const;

export default function DesignSystemPage() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-16 px-5 py-12 sm:px-10 lg:px-20 lg:py-18">
      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 font-metric text-2xl font-bold tracking-wider italic">
            <StrideMark className="size-5" strokeWidth="2.4" />
            STRIDE
          </span>
          <MonoLabel>Design system · internal</MonoLabel>
        </div>
        <h1 className="max-w-4xl text-display font-semibold text-balance">
          Radix bones, Stride skin.
        </h1>
        <p className="max-w-3xl text-lead text-pretty text-muted">
          Night Track tokens, shadcn primitives restyled for Stride, and the
          reusable product patterns from the approved system references. This
          surface exists for validation only and is not available in production.
        </p>
        <nav
          aria-label="Gallery sections"
          className="flex flex-wrap gap-x-5 gap-y-2 text-sm"
        >
          {[
            ["#tokens", "Tokens"],
            ["#type", "Typography"],
            ["#controls", "Controls"],
            ["#overlays", "Overlays"],
            ["#patterns", "Patterns"],
            ["#states", "States"],
          ].map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="text-muted hover:text-foreground"
            >
              {label}
            </a>
          ))}
          <Link
            href="/design-system/shell"
            className="text-accent hover:text-foreground"
          >
            App shell →
          </Link>
        </nav>
      </header>

      <GallerySection
        id="tokens"
        index="01 · Tokens"
        title="Graphite surfaces, hairlines, one signal colour"
        description="Volt is reserved for the coach's voice and the next action. Status, provider and zone meaning use their own tokens."
      >
        <div className="grid gap-10 lg:grid-cols-2">
          <Specimen title="Surfaces" meta="bg-*">
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {surfaces.map(([name, fill, token]) => (
                <li key={token} className="flex flex-col gap-1.5">
                  <span
                    className={`h-11 rounded-control border border-border ${fill}`}
                  />
                  <span className="text-xs">{name}</span>
                  <MonoLabel size="nano">{token}</MonoLabel>
                </li>
              ))}
            </ul>
          </Specimen>
          <Specimen title="State and provenance" meta="text-* · bg-*">
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {states.map(([name, fill, token]) => (
                <li key={token} className="flex flex-col gap-1.5">
                  <span className={`h-11 rounded-control ${fill}`} />
                  <span className="text-xs">{name}</span>
                  <MonoLabel size="nano">{token}</MonoLabel>
                </li>
              ))}
            </ul>
          </Specimen>
          <Specimen title="Training zones" meta="bg-zone-1…5">
            <ul className="grid grid-cols-5 gap-2">
              {zones.map(([name, fill]) => (
                <li key={name} className="flex flex-col gap-1.25">
                  <span className={`h-5 rounded-tag ${fill}`} />
                  <MonoLabel size="nano">{name}</MonoLabel>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs">
              <TrendLabel trend="improving" />
              <TrendLabel trend="stable" />
              <TrendLabel trend="watch">Watch · needs you</TrendLabel>
              <TrendLabel trend="investigate">Investigate · failed</TrendLabel>
            </div>
          </Specimen>
          <Specimen title="Lines and radii" meta="border-* · rounded-*">
            <div className="flex flex-wrap gap-2">
              {lines.map(([name, line, token]) => (
                <span
                  key={token}
                  className={`flex h-11 flex-1 items-center justify-center rounded-control border ${line} text-xs text-muted`}
                >
                  {name}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {radii.map(([name, radius, size]) => (
                <span
                  key={name}
                  className={`flex h-14 flex-col items-center justify-center border border-border-strong bg-surface ${radius}`}
                >
                  <span className="text-xs">{name}</span>
                  <MonoLabel size="nano">{size}</MonoLabel>
                </span>
              ))}
            </div>
          </Specimen>
          <Specimen
            title="Motion"
            meta="explains, never decorates"
            className="lg:col-span-2"
          >
            <ul className="grid border-t border-border text-sm sm:grid-cols-[minmax(0,1fr)_auto]">
              {motion.map(([label, token, timing]) => (
                <li
                  key={token}
                  className="col-span-full grid grid-cols-subgrid items-center gap-x-4 border-b border-border py-2.5"
                >
                  <span>{label}</span>
                  <MonoLabel>
                    {token} · {timing}
                  </MonoLabel>
                </li>
              ))}
            </ul>
            <p className="text-meta text-muted-foreground">
              Reduced motion: everything resolves to its end state.
            </p>
          </Specimen>
        </div>
      </GallerySection>

      <GallerySection
        id="type"
        index="02 · Typography"
        title="Three voices"
        description="Instrument Sans for UI and the coach's voice, Barlow Condensed for race-bib numerals, IBM Plex Mono for labels and provenance."
      >
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <ul className="flex flex-col border-t border-border">
            {typeScale.map(([token, style, sample]) => (
              <li
                key={token}
                className="grid gap-1 border-b border-border py-3 sm:grid-cols-[6rem_minmax(0,1fr)] sm:items-baseline sm:gap-4"
              >
                <MonoLabel>{token}</MonoLabel>
                <span className={style}>{sample}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-6">
            <div className="flex items-end justify-between gap-4 border-b border-border pb-4">
              <Metric size="hero" value="4:38" unit="/km" />
              <MonoLabel className="text-right">metric-hero</MonoLabel>
            </div>
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2 border-b border-border pb-4">
              <Metric size="lg" value="18h10" />
              <Metric size="md" value="5:31" />
              <Metric size="sm" value="48" unit="bpm" />
            </div>
            <div className="flex flex-col gap-2">
              <MonoLabel tone="secondary">
                HRV 58 ms · Garmin · 28-day
              </MonoLabel>
              <MonoLabel tone="accent">07 · Reusable patterns</MonoLabel>
              <MonoLabel size="micro">Via Recovery + Training</MonoLabel>
              <MonoLabel size="nano">Training</MonoLabel>
            </div>
          </div>
        </div>
      </GallerySection>

      <GallerySection
        id="controls"
        index="03 · Controls"
        title="shadcn primitives in Night Track"
        description="Every control keeps its Radix behaviour: keyboard support, focus management and ARIA state."
      >
        <div className="grid gap-12 lg:grid-cols-2">
          <Specimen title="Buttons" meta="Button">
            <div className="flex flex-wrap items-center gap-2.5">
              <Button size="md">Accept</Button>
              <Button size="md" variant="neutral">
                Appliquer le brouillon
              </Button>
              <Button size="md" variant="outline">
                Keep 5 × 6
              </Button>
              <Button size="md" variant="ghost">
                Revert
              </Button>
              <Button size="md" variant="destructive">
                Disconnect Garmin
              </Button>
              <Button size="md" variant="link">
                Ask why
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <Button size="lg">Continue</Button>
              <Button size="sm" variant="outline">
                Keep original
              </Button>
              <Button size="xs">Reconnect</Button>
              <Button size="icon-sm" variant="outline" aria-label="Add">
                <PlusIcon />
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <Button size="md" disabled>
                Disabled
              </Button>
              <Button size="md" disabled aria-busy="true">
                <LoaderCircleIcon
                  className="motion-safe:animate-spin"
                  aria-hidden="true"
                />
                Saving…
              </Button>
              <Button size="md" variant="outline" disabled>
                Unavailable
              </Button>
            </div>
          </Specimen>

          <Specimen title="Badges and keys" meta="Badge · Kbd">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>Moderate</Badge>
              <Badge variant="warning">Needs approval</Badge>
              <Badge variant="warning">Change proposed</Badge>
              <Badge variant="accent">Your call · recorded</Badge>
              <Badge variant="success">Accepted</Badge>
              <Badge variant="danger">Sign-in expired</Badge>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-meta text-muted">
              <span className="inline-flex items-center gap-1.5">
                <Kbd>⌘B</Kbd> collapse sidebar
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Kbd>⌘J</Kbd> coach panel
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Kbd>⌘K</Kbd> ask or command
              </span>
            </div>
          </Specimen>

          <Specimen title="Fields" meta="Field · Input · Textarea">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="ds-name">First name</FieldLabel>
                <Input id="ds-name" defaultValue="Jules" />
              </Field>
              <Field data-invalid="true">
                <FieldLabel htmlFor="ds-email">Email</FieldLabel>
                <Input
                  id="ds-email"
                  defaultValue="jules@"
                  aria-invalid="true"
                  aria-describedby="ds-email-error"
                />
                <FieldError id="ds-email-error">
                  Enter a complete email address.
                </FieldError>
              </Field>
              <Field>
                <FieldLabel htmlFor="ds-weight">Weight</FieldLabel>
                <ProviderValueInput
                  id="ds-weight"
                  providerValue="68"
                  unit="kg"
                  inputMode="decimal"
                  provenance="From Garmin · 3 days ago"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="ds-locked">Account email</FieldLabel>
                <Input
                  id="ds-locked"
                  defaultValue="jules@example.com"
                  disabled
                />
                <FieldDescription>
                  Disabled while a change is pending.
                </FieldDescription>
              </Field>
              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="ds-notes">Anything else?</FieldLabel>
                <Textarea
                  id="ds-notes"
                  placeholder="Old injuries, terrain you avoid…"
                />
              </Field>
              <div className="flex items-center gap-2.5">
                <Checkbox id="ds-terms" defaultChecked />
                <Label htmlFor="ds-terms">Keep me signed in</Label>
              </div>
            </div>
          </Specimen>

          <Specimen title="Choices" meta="ToggleGroup">
            <div className="flex flex-col gap-2">
              <span id="ds-surface-label" className="text-sm">
                Mostly…
              </span>
              <ToggleGroup
                type="single"
                defaultValue="trail"
                aria-labelledby="ds-surface-label"
                className="grid grid-cols-3"
              >
                <ToggleGroupItem value="road">Road</ToggleGroupItem>
                <ToggleGroupItem value="trail">Trail</ToggleGroupItem>
                <ToggleGroupItem value="both">Both equally</ToggleGroupItem>
              </ToggleGroup>
            </div>
            <div className="flex flex-col gap-2">
              <span id="ds-days-label" className="text-sm">
                Days you can run
              </span>
              <ToggleGroup
                type="multiple"
                variant="day"
                defaultValue={["tue", "wed", "thu", "sat", "sun"]}
                aria-labelledby="ds-days-label"
              >
                {[
                  ["mon", "M", "Monday"],
                  ["tue", "T", "Tuesday"],
                  ["wed", "W", "Wednesday"],
                  ["thu", "T", "Thursday"],
                  ["fri", "F", "Friday"],
                  ["sat", "S", "Saturday"],
                  ["sun", "S", "Sunday"],
                ].map(([value, short, name]) => (
                  <ToggleGroupItem key={value} value={value} aria-label={name}>
                    {short}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
            <div className="flex flex-col gap-2">
              <span id="ds-access-label" className="text-sm">
                You have access to
              </span>
              <ToggleGroup
                type="multiple"
                defaultValue={["hills", "gym"]}
                aria-labelledby="ds-access-label"
              >
                <ToggleGroupItem value="hills">Hills nearby</ToggleGroupItem>
                <ToggleGroupItem value="treadmill">
                  Treadmill with incline
                </ToggleGroupItem>
                <ToggleGroupItem value="gym">Gym / strength</ToggleGroupItem>
                <ToggleGroupItem value="track" disabled>
                  Track
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
            <ToggleGroup
              type="single"
              variant="segment"
              defaultValue="6mo"
              aria-label="Chart range"
            >
              <ToggleGroupItem value="6wk">6 wk</ToggleGroupItem>
              <ToggleGroupItem value="12wk">12 wk</ToggleGroupItem>
              <ToggleGroupItem value="6mo">6 mo</ToggleGroupItem>
              <ToggleGroupItem value="1yr">1 yr</ToggleGroupItem>
            </ToggleGroup>
          </Specimen>

          <Specimen title="Tabs" meta="Tabs · underline">
            <Tabs defaultValue="fitness">
              <TabsList aria-label="Progress sections">
                <TabsTrigger value="fitness">Fitness</TabsTrigger>
                <TabsTrigger value="recovery">Recovery</TabsTrigger>
                <TabsTrigger value="records">Records</TabsTrigger>
              </TabsList>
              <TabsContent value="fitness" className="text-muted">
                Your engine is growing faster than your top end.
              </TabsContent>
              <TabsContent value="recovery" className="text-muted">
                Sleep has been short three nights running.
              </TabsContent>
              <TabsContent value="records" className="text-muted">
                Half marathon 1:39:58 · Mar 2025.
              </TabsContent>
            </Tabs>
          </Specimen>

          <Specimen title="Progress and loading" meta="Progress · Skeleton">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-meta">
                <span id="ds-import-label">Importing from Garmin</span>
                <MonoLabel>71%</MonoLabel>
              </div>
              <Progress value={71} aria-labelledby="ds-import-label" />
            </div>
            <div
              className="flex flex-col gap-2 rounded-card border border-border p-4"
              aria-busy="true"
              aria-label="Loading session"
            >
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-6 w-3/5" />
              <Skeleton className="h-9 w-full" />
            </div>
          </Specimen>
        </div>
      </GallerySection>

      <GallerySection
        id="overlays"
        index="04 · Overlays"
        title="Menus, dialogs and sheets"
        description="Overlays sit on a dimmed shell with hairline frames. No glass, no shadows."
      >
        <div className="flex flex-wrap items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="md" variant="outline">
                Account menu
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="start">
              <DropdownMenuLabel>Jules · Profile 72%</DropdownMenuLabel>
              <DropdownMenuItem>
                <SettingsIcon />
                Settings
                <DropdownMenuShortcut>⌘,</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem>Answer 2 questions</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive">
                <LogOutIcon />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="md" variant="destructive">
                Disconnect Garmin
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Disconnect Garmin?</AlertDialogTitle>
                <AlertDialogDescription>
                  New activities, sleep and HRV stop arriving. Your athlete
                  model and plan ledger stay as they are.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep connected</AlertDialogCancel>
                <AlertDialogAction variant="destructive">
                  Disconnect
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Sheet>
            <SheetTrigger asChild>
              <Button size="md" variant="outline">
                Approval sheet
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="mx-auto max-w-xl">
              <SheetHeader>
                <SheetTitle>Approve change</SheetTitle>
                <SheetDescription>
                  Same recommendation anatomy as Today and Coach.
                </SheetDescription>
              </SheetHeader>
              <div className="px-4 pb-6">
                <ExampleRecommendation />
              </div>
            </SheetContent>
          </Sheet>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="outline"
                aria-label="Toggle coach panel"
              >
                <StrideMark />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Coach panel <Kbd>⌘J</Kbd>
            </TooltipContent>
          </Tooltip>
        </div>
      </GallerySection>

      <GallerySection
        id="patterns"
        index="05 · Patterns"
        title="Stride patterns"
        description="Product-level compositions built on the primitives. Screens compose these instead of recreating local variants."
      >
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
          <Specimen title="Verdict row" meta="replaces the tile">
            <VerdictList>
              <VerdictRow
                label="Aerobic efficiency"
                value="5:31"
                trend="improving"
              />
              <VerdictRow label="Threshold pace" value="4:38" trend="stable" />
              <VerdictRow label="HR drift" value="7.8%" trend="investigate" />
            </VerdictList>
            <SessionShape blocks={session} className="mt-2" />
            <p className="text-xs text-muted-foreground">
              Session shape: intensity × time, removed rep dashed.
            </p>
          </Specimen>
          <Specimen title="Session kind tile" meta="SessionKindTile">
            <ul className="flex flex-wrap gap-2">
              {sessionTileKinds.map((kind) => (
                <li key={kind}>
                  <SessionKindTile kind={kind} label={kind} size="md" />
                </li>
              ))}
            </ul>
            <div className="flex items-end gap-3">
              {(["xs", "sm", "md", "lg"] as const).map((size) => (
                <span key={size} className="flex flex-col items-center gap-1.5">
                  <SessionKindTile kind="threshold" size={size} />
                  <MonoLabel size="nano">{size}</MonoLabel>
                </span>
              ))}
              <SessionKindTile kind="rest" size="lg" />
              <SessionKindTile kind="race" size="lg" />
            </div>
            <p className="text-xs text-muted-foreground">
              Easy and long on provider blue, quality on zone 4, hills and trail
              on zone 3, support work muted, race in Volt, rest dashed.
            </p>
          </Specimen>
          <Specimen title="Recommendation" meta="Card · Badge · Button">
            <ExampleRecommendation />
            <p className="text-meta text-muted-foreground">
              Fixed anatomy: who · what · diff · why · confidence · decision.
            </p>
          </Specimen>
          <Specimen title="Provenance" meta="inline · subtle">
            <SignalList>
              <SignalRow
                label="Height"
                value="178"
                unit="cm"
                source="manual"
                provenance="Entered manually"
              />
              <SignalRow
                label="Resting HR"
                value="48"
                unit="bpm"
                source="provider"
                provenance="Garmin · updated today"
              />
              <SignalRow
                label="Threshold pace"
                value="4:38"
                source="estimate"
                provenance="Stride estimate · moderate"
              />
              <SignalRow
                label="VO2 max"
                value="52"
                source="provider"
                provenance="Garmin · today"
                provenanceVariant="mono"
              />
            </SignalList>
          </Specimen>
          <Specimen title="Ledger entry" meta="timeline">
            <LedgerEntry
              status="accepted"
              title="Long run Sat → Sun"
              attribution="Proposed by Training · accepted by you · Mon 5"
              action={
                <Button
                  variant="link"
                  size="xs"
                  className="h-auto px-0 text-muted"
                >
                  Revert
                </Button>
              }
            >
              You blocked Saturday. Volume unchanged.
            </LedgerEntry>
            <LedgerEntry
              status="open"
              title="Threshold 5 × 6 → 4 × 6"
              attribution="Proposed by Recovery · waiting for you"
            >
              Sleep and HRV are both down.
            </LedgerEntry>
            <DecisionLegend />
          </Specimen>
          <Specimen title="Coach presence" meta="no sparkles">
            <dl className="grid grid-cols-[5.625rem_minmax(0,1fr)] border-t border-border">
              {(
                [
                  ["idle", "Ask about today…"],
                  ["reading", "Reading last 6 threshold sessions"],
                  ["watching", "Training · 2 proposals"],
                  ["noticing", "Findings rise in one by one during import"],
                  ["changed", "Moved by coach · see ledger"],
                ] as const
              ).map(([state, text]) => (
                <div
                  key={state}
                  className="col-span-full grid grid-cols-subgrid items-center gap-3 border-b border-border py-3"
                >
                  <dt>
                    <MonoLabel>{state}</MonoLabel>
                  </dt>
                  <dd>
                    <CoachActivity state={state}>{text}</CoachActivity>
                  </dd>
                </div>
              ))}
            </dl>
          </Specimen>
          <Specimen title="Context chips" meta="ContextChip · ContextChipLink">
            <ContextChipsExample />
            <p className="text-xs text-muted-foreground">
              Removable chip for an item attached in the composer, and the link
              chip on the sent message. 44px targets below md.
            </p>
          </Specimen>
          <Specimen title="Signals and notes" meta="SignalChip · CoachNote">
            <div className="flex flex-wrap gap-1.5">
              <SignalChip label="Sleep" value="5h52" direction="down" />
              <SignalChip label="HRV" value="46 ms" direction="down" />
              <SignalChip label="Load" value="1.24" direction="up" />
              <SignalChip
                label="Legs"
                value="Fresh"
                direction="flat"
                tone="muted"
              />
            </div>
            <CoachNote
              action={
                <Button
                  variant="link"
                  size="xs"
                  className="h-auto px-0 text-meta"
                >
                  Ask why
                </Button>
              }
            >
              HR drift rose on 4 of 5 long runs since August, all above 22°C.
              I&apos;d like to test fuelling earlier on Sunday before calling it
              a fitness issue.
            </CoachNote>
            <div className="flex items-end gap-3">
              <Metric size="hero" value="58" />
              <div className="flex flex-col gap-1 pb-2">
                <TrendLabel trend="watch" className="text-lead">
                  Moderate readiness
                </TrendLabel>
                <span className="text-meta text-muted">
                  14-day avg 69 · mostly sleep
                </span>
              </div>
            </div>
          </Specimen>
        </div>
      </GallerySection>

      <GallerySection
        id="states"
        index="06 · States"
        title="Sync, onboarding progress and messages"
        description="One component per state machine. Every state carries a shape or label so colour is never the only cue."
      >
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.8fr)_minmax(0,1fr)]">
          <Specimen title="Sync status" meta="one component, five states">
            <div className="flex flex-col gap-3">
              <SyncStatus state="importing" progress={58}>
                Importing history — now at 2021
              </SyncStatus>
              <SyncStatus state="current">Up to date · 12 min ago</SyncStatus>
              <SyncStatus state="partial">
                Partial · no HRV before 2023
              </SyncStatus>
              <SyncStatus state="retrying">
                Garmin not responding · retrying
              </SyncStatus>
              <SyncStatus
                state="expired"
                action={<Button size="xs">Reconnect</Button>}
              >
                Sign-in expired
              </SyncStatus>
            </div>
          </Specimen>
          <Specimen title="Stepper" meta="onboarding">
            <Stepper aria-label="Onboarding steps">
              <StepperItem index={1} status="done" label="Welcome" />
              <StepperItem index={2} status="done" label="Connect Garmin" />
              <StepperItem
                index={3}
                status="background"
                label="Import history"
                detail="Still reading · 71%"
              />
              <StepperItem
                index={4}
                status="current"
                label="About you"
                detail="Only what Garmin can't tell"
              />
              <StepperItem index={5} status="upcoming" label="Goals" />
              <StepperItem
                index={6}
                status="upcoming"
                label="Your athlete profile"
              />
            </Stepper>
            <StepperSegments
              statuses={[
                "done",
                "done",
                "background",
                "current",
                "upcoming",
                "upcoming",
              ]}
              currentProgress={0.6}
            />
            <p className="text-meta text-muted-foreground">
              Desktop: in the sidebar. Mobile: segments across the top.
            </p>
          </Specimen>
          <Specimen title="Messages" meta="Alert · empty">
            <Alert>
              <AlertTitle>No activities yet</AlertTitle>
              <AlertDescription>
                Your first Garmin sync usually lands within a few minutes.
              </AlertDescription>
            </Alert>
            <Alert variant="destructive">
              <AlertTitle>That code wasn&apos;t accepted</AlertTitle>
              <AlertDescription>
                Request a new one from Garmin and try again.
              </AlertDescription>
            </Alert>
            <ProvenanceLabel source="provider">
              Garmin synced 06:12
            </ProvenanceLabel>
            <div className="flex flex-col items-start gap-3 rounded-card border border-dashed border-border-strong p-5">
              <MonoLabel>Empty · races</MonoLabel>
              <p className="text-sm text-muted">
                No goal race yet. Stride plans around your availability until
                you add one.
              </p>
              <Button size="sm" variant="outline">
                Add a race
              </Button>
            </div>
          </Specimen>
        </div>
      </GallerySection>
    </main>
  );
}

function ExampleRecommendation() {
  return (
    <Recommendation>
      <RecommendationHeader
        source="via Recovery + Training"
        status={<Badge variant="warning">Needs approval</Badge>}
      />
      <RecommendationBody>
        <RecommendationTitle>
          Reduce today&apos;s threshold to 4 × 6 min.
        </RecommendationTitle>
        <RecommendationDiff from="5 × 6 min · 62'" to="4 × 6 min · 52'" />
        <RecommendationSignals>
          <SignalChip label="Sleep" value="5h52" direction="down" />
          <SignalChip label="HRV" value="46 ms" direction="down" />
          <SignalChip label="Load" value="1.24" direction="up" />
        </RecommendationSignals>
        <RecommendationActions
          confidence={<ConfidenceMeter level="moderate" />}
        >
          <Button size="md">Accept</Button>
          <Button size="md" variant="outline">
            Keep 5 × 6
          </Button>
        </RecommendationActions>
      </RecommendationBody>
    </Recommendation>
  );
}

import {
  validateNewPlan,
  validatePlanChange,
  type DeterministicPlanInput,
} from "../detailing/build";
import { daysBetween, mondayOf } from "../model/dates";
import type { PlanSession, PlanState, SessionContent } from "../model/plan";
import { applyOperations, type OperationError } from "../operations/apply";
import {
  planOperationsSchema,
  type PlanOperation,
} from "../operations/operations";
import { sessionDistance } from "../validation/input";
import type { RuleId, ValidationReport } from "../validation/report";
import {
  formatDistance,
  formatDuration,
  formatElevation,
} from "../view/format";
import { formatClock } from "@/features/progress/format";
import {
  coach,
  consultedStaff,
  formatPlainDay,
  formatPlanDay,
  formatStamp,
  originLine,
  reasonText,
  staffMember,
  verdictLabel,
  verdictTone,
  type ProposalRecord,
  type StaffMember,
} from "./proposal";

export type ReviewRace = {
  id: string;
  name: string;
  date: string | null;
  priority: "A" | "B" | "C" | null;
  targetSeconds: number | null;
};

export type ReviewInput = {
  proposal: ProposalRecord;
  plan: { state: PlanState; version: number; activeVersion: number } | null;
  today: string;
  timeZone: string;
  matchedSessionKeys: ReadonlySet<string>;
  planning: DeterministicPlanInput | null;
  races: ReviewRace[];
  planReplaced?: boolean;
};

export type ReviewTone = "warning" | "success" | "muted" | "danger";

export type ReviewSide = { title: string; meta: string | null };

export type ReviewOperation = {
  label: string;
  context: string;
  before: ReviewSide | null;
  after: ReviewSide | null;
};

export type ReviewWeekTotal = {
  label: string;
  duration: { before: string; after: string; delta: string | null };
  elevation: { before: string; after: string } | null;
};

export type ReviewNewPlan = {
  weeks: number;
  sessions: number;
  peakWeek: string;
  startsOn: string;
  phases: { key: string; name: string; weeks: number; kind: string }[];
  races: { id: string; name: string; letter: string; detail: string }[];
  replacesActive: boolean;
};

export type ReviewOpinion = StaffMember & {
  label: string;
  text: string;
  verdict: { label: string; tone: "success" | "warning" } | null;
  lead: boolean;
};

export type ReviewCheck = { tone: "pass" | "warn" | "block"; text: string };

export type ReviewBanner = { tone: ReviewTone; title: string; body: string };

export type ProposalReview = {
  id: string;
  title: string;
  summary: string | null;
  kind: "change" | "new_plan";
  kicker: string;
  subkicker: string;
  status: { label: string; tone: ReviewTone };
  origin: {
    line: string;
    detail: string;
    staff: StaffMember[];
    coachSessionId: string | null;
  };
  operations: ReviewOperation[];
  weekTotals: ReviewWeekTotal[];
  newPlan: ReviewNewPlan | null;
  opinions: ReviewOpinion[];
  checks: ReviewCheck[];
  banner: ReviewBanner | null;
  blockedReason: string | null;
  actions: { accept: boolean; reject: boolean; retry: boolean };
  acceptLabel: string;
  appliedVersion: number | null;
  weekStart: string | null;
};

const ruleTexts: Partial<Record<RuleId, string>> = {
  I1: "une séance passée ou déjà faite serait modifiée",
  I3: "la structure d’une séance n’est pas valide",
  I4: "une course prioritaire serait déplacée ou retirée",
  C1: "une séance tombe sur un jour où tu n’es pas disponible",
  C2: "une séance ou une semaine dépasse le temps que tu as déclaré",
  C3: "une contrainte posée par un spécialiste n’est pas respectée",
  H1: "ton dernier signalement de douleur ou de maladie interdit de courir",
  H2: "ta douleur déclarée interdit la qualité et la hausse de volume",
  H3: "ta forme du jour interdit une séance de qualité",
  E1: "une sortie dépasse de plus de 30 % ta plus longue sortie des 30 derniers jours",
  E2: "une sortie dépasse de 10 à 30 % ta plus longue sortie des 30 derniers jours",
  P1: "le volume d’une semaine augmente de plus de 10 % par rapport aux 4 précédentes",
  P2: "le dénivelé d’une semaine augmente de plus de 15 %",
  P3: "la sortie longue dépasse 35 % du temps de course de la semaine",
  P4: "deux séances de qualité se suivent, ou une qualité suit la sortie longue",
  P5: "l’intensité élevée dépasse 25 % du temps de la semaine",
  P6: "l’affûtage avant ta course principale ne réduit pas assez le volume",
  P7: "une séance de qualité tombe juste avant ta course principale",
};

const statusDisplay: Record<
  ProposalRecord["status"],
  { label: string; tone: ReviewTone }
> = {
  draft: { label: "Brouillon", tone: "muted" },
  ready: { label: "À toi de décider", tone: "warning" },
  accepted: { label: "Acceptée", tone: "warning" },
  applied: { label: "Appliquée", tone: "success" },
  rejected: { label: "Refusée", tone: "muted" },
  expired: { label: "Expirée", tone: "muted" },
  superseded: { label: "Remplacée", tone: "muted" },
  stale: { label: "Périmée", tone: "danger" },
  invalid: { label: "Non valide", tone: "danger" },
  reverted: { label: "Annulée", tone: "muted" },
};

export function proposalStatusDisplay(status: ProposalRecord["status"]) {
  return statusDisplay[status];
}

function isRunning(session: Pick<SessionContent, "sport" | "kind">) {
  return session.sport !== "rest" && session.kind !== "rest";
}

function sessionMeta(session: SessionContent) {
  if (!isRunning(session)) return "jour sans course";
  const distance = sessionDistance({
    ...session,
    sessionKey: "",
    scheduledOn: "",
  });
  return [
    formatDuration(session.targets.durationSeconds),
    distance ? formatDistance(distance) : null,
    session.targets.elevationGainMeters
      ? `${formatElevation(session.targets.elevationGainMeters)} D+`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function side(session: SessionContent | undefined): ReviewSide {
  return session
    ? { title: session.title, meta: sessionMeta(session) }
    : { title: "Séance introuvable", meta: null };
}

function weekNumber(state: PlanState, weekStart: string) {
  const starts = state.weeks.map((week) => week.weekStart).sort();
  const index = starts.indexOf(weekStart);
  return index === -1 ? null : index + 1;
}

function weekLabel(state: PlanState, weekStart: string) {
  const number = weekNumber(state, weekStart);
  return number
    ? `Semaine ${number}`
    : `Semaine du ${formatPlainDay(weekStart)}`;
}

const raceRoleLabels = {
  primary: "Objectif principal",
  preparation: "Préparation",
  secondary: "Course secondaire",
} as const;

function describeOperation(
  operation: PlanOperation,
  before: PlanState,
  races: ReviewRace[],
): ReviewOperation[] {
  const sessions = new Map(
    before.sessions.map((session) => [session.sessionKey, session]),
  );
  const at = (session: PlanSession | undefined) =>
    session ? formatPlanDay(session.scheduledOn) : "Séance introuvable";
  switch (operation.op) {
    case "move_session": {
      const session = sessions.get(operation.sessionKey);
      const meta = session ? sessionMeta(session) : null;
      return [
        {
          label: "Déplacée",
          context: session?.title ?? "Séance",
          before: { title: at(session), meta },
          after: { title: formatPlanDay(operation.toDate), meta },
        },
      ];
    }
    case "swap_sessions": {
      const first = sessions.get(operation.firstKey);
      const second = sessions.get(operation.secondKey);
      return [
        [first, second],
        [second, first],
      ].map(([moved, target]) => ({
        label: "Déplacée",
        context: moved?.title ?? "Séance",
        before: { title: at(moved), meta: moved ? sessionMeta(moved) : null },
        after: { title: at(target), meta: moved ? sessionMeta(moved) : null },
      }));
    }
    case "replace_session": {
      const session = sessions.get(operation.sessionKey);
      return [
        {
          label: "Remplacée",
          context: at(session),
          before: side(session),
          after: side(operation.content),
        },
      ];
    }
    case "shorten_session": {
      const session = sessions.get(operation.sessionKey);
      return [
        {
          label: "Raccourcie",
          context: at(session),
          before: side(session),
          after: session
            ? side({
                ...session,
                targets: {
                  ...session.targets,
                  durationSeconds: operation.durationSeconds,
                },
              })
            : null,
        },
      ];
    }
    case "skip_session": {
      const session = sessions.get(operation.sessionKey);
      return [
        {
          label: "Supprimée",
          context: at(session),
          before: side(session),
          after: { title: "Jour sans séance", meta: null },
        },
      ];
    }
    case "add_session":
      return [
        {
          label: "Ajoutée",
          context: formatPlanDay(operation.session.scheduledOn),
          before: null,
          after: side(operation.session.content),
        },
      ];
    case "set_week_targets": {
      const week = before.weeks.find(
        (item) => item.weekKey === operation.weekKey,
      );
      return [
        {
          label: "Objectifs",
          context: week ? weekLabel(before, week.weekStart) : "Semaine",
          before: week
            ? {
                title: formatDuration(week.targets.durationSeconds),
                meta: "objectif de la semaine",
              }
            : null,
          after: {
            title: formatDuration(operation.targets.durationSeconds),
            meta: "objectif de la semaine",
          },
        },
      ];
    }
    case "replace_range": {
      const count = before.sessions.filter(
        (session) =>
          session.scheduledOn >= operation.from &&
          session.scheduledOn <= operation.to,
      ).length;
      return [
        {
          label: "Remplacées",
          context: `${formatPlainDay(operation.from)} → ${formatPlainDay(operation.to)}`,
          before: {
            title: `${count} séance${count > 1 ? "s" : ""}`,
            meta: null,
          },
          after: {
            title: `${operation.sessions.length} séance${operation.sessions.length > 1 ? "s" : ""}`,
            meta: null,
          },
        },
      ];
    }
    case "set_race_role": {
      const race = races.find((item) => item.id === operation.raceId);
      const current = before.plan.raceRoles.find(
        (entry) => entry.raceId === operation.raceId,
      );
      return [
        {
          label: "Course",
          context: race?.name ?? "Course",
          before: {
            title: current ? raceRoleLabels[current.role] : "Hors du plan",
            meta: null,
          },
          after: {
            title: operation.role
              ? raceRoleLabels[operation.role]
              : "Hors du plan",
            meta: null,
          },
        },
      ];
    }
    case "create_plan":
      return [];
  }
}

function weekTotals(state: PlanState, weekStart: string) {
  const sessions = state.sessions.filter(
    (session) =>
      mondayOf(session.scheduledOn) === weekStart && isRunning(session),
  );
  const elevations = sessions.map(
    (session) => session.targets.elevationGainMeters,
  );
  return {
    duration: sessions.reduce(
      (total, session) => total + session.targets.durationSeconds,
      0,
    ),
    elevation: elevations.some((value) => value !== null)
      ? elevations.reduce<number>((total, value) => total + (value ?? 0), 0)
      : null,
  };
}

function signedDuration(seconds: number) {
  if (Math.round(seconds / 60) === 0) return null;
  const value = formatDuration(Math.abs(seconds));
  return `${seconds < 0 ? "−" : "+"}${value.endsWith("’") ? `${value.slice(0, -1)} min` : value}`;
}

function affectedWeeks(before: PlanState, after: PlanState) {
  const previous = new Map(
    before.sessions.map((session) => [session.sessionKey, session]),
  );
  const next = new Map(
    after.sessions.map((session) => [session.sessionKey, session]),
  );
  const weeks = new Set<string>();
  for (const [key, session] of previous) {
    const changed = next.get(key);
    if (!changed || JSON.stringify(changed) !== JSON.stringify(session)) {
      weeks.add(mondayOf(session.scheduledOn));
      if (changed) weeks.add(mondayOf(changed.scheduledOn));
    }
  }
  for (const [key, session] of next)
    if (!previous.has(key)) weeks.add(mondayOf(session.scheduledOn));
  for (const week of after.weeks) {
    const old = before.weeks.find((item) => item.weekKey === week.weekKey);
    if (old && JSON.stringify(old.targets) !== JSON.stringify(week.targets))
      weeks.add(week.weekStart);
  }
  return [...weeks].sort();
}

function buildWeekTotals(
  before: PlanState,
  after: PlanState,
  weeks: string[],
): ReviewWeekTotal[] {
  return weeks.map((weekStart) => {
    const previous = weekTotals(before, weekStart);
    const next = weekTotals(after, weekStart);
    return {
      label: weekLabel(before, weekStart),
      duration: {
        before: formatDuration(previous.duration),
        after: formatDuration(next.duration),
        delta: signedDuration(next.duration - previous.duration),
      },
      elevation:
        previous.elevation === null && next.elevation === null
          ? null
          : {
              before: formatElevation(previous.elevation ?? 0),
              after: formatElevation(next.elevation ?? 0),
            },
    };
  });
}

function kicker(state: PlanState, weeks: string[]) {
  const numbers = weeks
    .map((weekStart) => weekNumber(state, weekStart))
    .filter((value): value is number => value !== null);
  if (numbers.length === 0) return "Proposition · plan";
  if (numbers.length === 1) return `Proposition · semaine ${numbers[0]}`;
  return `Proposition · semaines ${numbers[0]} à ${numbers.at(-1)}`;
}

function operationFailure(errors: OperationError[], state: PlanState): string {
  const frozen = errors.find(
    (error) => error.code === "frozen_session" || error.code === "past_date",
  );
  if (frozen) {
    const session = state.sessions.find(
      (item) => item.sessionKey === frozen.key,
    );
    return session
      ? `Ton plan a changé depuis : la séance du ${formatPlanDay(session.scheduledOn)} est déjà passée ou faite.`
      : reasonText("frozen_session");
  }
  if (errors.some((error) => error.code === "unknown_key"))
    return reasonText("unknown_key");
  return reasonText("invalid_operations");
}

function failing(report: ValidationReport, severity: "block" | "warn") {
  return new Set(
    report.results
      .filter(
        (result) => result.outcome === "fail" && result.severity === severity,
      )
      .map((result) => result.ruleId),
  );
}

export function introducedRules(
  after: ValidationReport,
  before: ValidationReport | null,
  severity: "block" | "warn",
) {
  const previous = before ? failing(before, severity) : new Set<RuleId>();
  return [...failing(after, severity)].filter(
    (rule) => rule !== "I2" && !previous.has(rule),
  );
}

function checksFrom(
  after: ValidationReport,
  before: ValidationReport | null,
): { checks: ReviewCheck[]; blocks: RuleId[] } {
  const blocks = introducedRules(after, before, "block");
  const warnings = introducedRules(after, before, "warn");
  const outcome = (rule: RuleId) =>
    after.results.find((result) => result.ruleId === rule)?.outcome;
  const checks: ReviewCheck[] = [];
  if (outcome("C1") !== "fail" && outcome("C2") !== "fail")
    checks.push({
      tone: "pass",
      text: "Tes indisponibilités et tes limites déclarées sont respectées.",
    });
  if (outcome("I1") !== "fail")
    checks.push({
      tone: "pass",
      text: "Aucune séance passée ou déjà faite n’est modifiée.",
    });
  for (const rule of blocks)
    checks.push({
      tone: "block",
      text: `Bloquant : ${ruleTexts[rule] ?? "une règle de sécurité n’est pas respectée"}.`,
    });
  for (const rule of warnings)
    if (ruleTexts[rule])
      checks.push({ tone: "warn", text: `À surveiller : ${ruleTexts[rule]}.` });
  return { checks, blocks };
}

function opinions(proposal: ProposalRecord): ReviewOpinion[] {
  const lead = proposal.rationale ?? proposal.summary;
  return [
    ...(lead
      ? [{ ...coach, label: coach.role, text: lead, verdict: null, lead: true }]
      : []),
    ...proposal.specialistOpinions.map((opinion) => {
      const member = staffMember(opinion.specialist);
      return {
        ...member,
        label: `${member.role} · consultée`,
        text: opinion.summary,
        verdict: {
          label: verdictLabel(opinion.verdict),
          tone: verdictTone(opinion.verdict),
        },
        lead: false,
      };
    }),
  ];
}

function newPlanSummary(
  state: PlanState,
  races: ReviewRace[],
  replacesActive: boolean,
): ReviewNewPlan {
  const weeks = [...state.weeks].sort((first, second) =>
    first.weekStart.localeCompare(second.weekStart),
  );
  const peak = Math.max(
    0,
    ...weeks.map((week) => weekTotals(state, week.weekStart).duration),
  );
  return {
    weeks: weeks.length,
    sessions: state.sessions.filter(isRunning).length,
    peakWeek: formatDuration(peak),
    startsOn: formatPlainDay(state.plan.startsOn),
    phases: [...state.blocks]
      .sort((first, second) => first.startsOn.localeCompare(second.startsOn))
      .map((block) => ({
        key: block.blockKey,
        name: block.name,
        weeks: Math.max(
          1,
          Math.round((daysBetween(block.startsOn, block.endsOn) + 1) / 7),
        ),
        kind: block.kind,
      })),
    races: state.plan.raceRoles.flatMap((entry) => {
      const race = races.find((item) => item.id === entry.raceId);
      if (!race) return [];
      const primary = entry.role === "primary";
      return [
        {
          id: race.id,
          name: race.name,
          letter: race.priority ?? (primary ? "A" : "B"),
          detail: [
            race.date ? formatPlanDay(race.date) : null,
            primary
              ? race.targetSeconds
                ? `objectif ${formatClock(race.targetSeconds)}`
                : "objectif"
              : "préparation",
          ]
            .filter(Boolean)
            .join(" · "),
        },
      ];
    }),
    replacesActive,
  };
}

function bannerFor(
  proposal: ProposalRecord,
  isNewPlan: boolean,
): ReviewBanner | null {
  const note = proposal.decisions.at(-1)?.note ?? null;
  switch (proposal.status) {
    case "applied":
      return {
        tone: "success",
        title: isNewPlan
          ? "Appliquée · ton nouveau plan est actif"
          : `Appliquée · ton plan passe en version ${proposal.appliedVersion ?? "?"}`,
        body: "Stride a revérifié la proposition avant de l’appliquer. Tes séances et les totaux de la semaine sont à jour.",
      };
    case "rejected":
      return {
        tone: "muted",
        title: "Refusée · ton plan ne change pas",
        body: `${coach.name} en tient compte. Tu peux lui en reparler pour proposer autre chose.`,
      };
    case "accepted":
      return {
        tone: "warning",
        title: "Acceptée, application en attente",
        body: "Stride n’a pas encore pu appliquer le changement. Ton plan ne change pas tant qu’il n’est pas appliqué.",
      };
    case "stale":
    case "invalid":
      return {
        tone: "danger",
        title: "Cette proposition ne peut plus être appliquée",
        body: `${reasonText(note)} Rien n’a été modifié. Demande à ${coach.name} de la mettre à jour.`,
      };
    case "superseded":
      return {
        tone: "muted",
        title: "Remplacée par une proposition plus récente",
        body: "Rien n’a été modifié.",
      };
    case "expired":
      return {
        tone: "muted",
        title: "Expirée avant ta décision",
        body: "Rien n’a été modifié.",
      };
    default:
      return null;
  }
}

export function buildProposalReview(input: ReviewInput): ProposalReview {
  const { proposal, plan } = input;
  const isNewPlan = proposal.scope === "new_plan";
  const parsed = planOperationsSchema.safeParse(proposal.operations);
  const operations = parsed.success ? parsed.data : [];
  const pending = proposal.status === "ready" || proposal.status === "accepted";
  let blockedReason: string | null = parsed.success
    ? null
    : reasonText("invalid_operations");
  let checks: ReviewCheck[] = [];
  let described: ReviewOperation[] = [];
  let totals: ReviewWeekTotal[] = [];
  let newPlan: ReviewNewPlan | null = null;
  let weekStart: string | null = null;
  let kickerText = isNewPlan
    ? "Proposition · nouveau plan"
    : "Proposition · plan";

  if (isNewPlan) {
    const creation = operations[0];
    if (creation?.op === "create_plan") {
      newPlan = newPlanSummary(creation.state, input.races, plan !== null);
      if (pending && input.planning) {
        const report = validateNewPlan(input.planning, creation.state);
        const result = checksFrom(report, null);
        checks = result.checks;
        if (result.blocks.length)
          blockedReason = `Elle ne respecte plus une règle de sécurité de Stride : ${ruleTexts[result.blocks[0]] ?? "règle bloquante"}.`;
      }
    } else blockedReason ??= reasonText("invalid_operations");
  } else if (plan) {
    described = operations.flatMap((operation) =>
      describeOperation(operation, plan.state, input.races),
    );
    const outcome = applyOperations(
      plan.state,
      operations,
      pending
        ? { today: input.today, matchedSessionKeys: input.matchedSessionKeys }
        : { today: plan.state.plan.startsOn, matchedSessionKeys: new Set() },
    );
    if (outcome.ok) {
      const weeks = affectedWeeks(plan.state, outcome.state);
      totals = buildWeekTotals(plan.state, outcome.state, weeks);
      kickerText = kicker(plan.state, weeks);
      weekStart = weeks[0] ?? null;
    }
    if (pending) {
      if (input.planReplaced) blockedReason ??= reasonText("plan_replaced");
      if (proposal.baseVersion !== plan.activeVersion)
        blockedReason ??= `Ton plan a changé depuis qu’elle a été proposée : il est passé en version ${plan.activeVersion}.`;
      if (!outcome.ok)
        blockedReason ??= operationFailure(outcome.errors, plan.state);
      else if (input.planning) {
        const versions = {
          expected: proposal.baseVersion ?? plan.activeVersion,
          current: plan.activeVersion,
        };
        const change = { matchedSessionKeys: input.matchedSessionKeys };
        const before = validatePlanChange(
          input.planning,
          plan.state,
          plan.state,
          {
            ...change,
            versions: {
              expected: plan.activeVersion,
              current: plan.activeVersion,
            },
          },
        );
        const after = validatePlanChange(
          input.planning,
          plan.state,
          outcome.state,
          { ...change, versions },
        );
        const result = checksFrom(after, before);
        checks = result.checks;
        if (result.blocks.length)
          blockedReason ??= `Elle ne respecte plus une règle de sécurité de Stride : ${ruleTexts[result.blocks[0]] ?? "règle bloquante"}.`;
      }
    }
  } else if (pending) blockedReason ??= reasonText(null);

  const ready = proposal.status === "ready";
  const blocked = pending && blockedReason !== null;
  const status = blocked
    ? { label: "Périmée", tone: "danger" as const }
    : statusDisplay[proposal.status];
  return {
    id: proposal.id,
    title: proposal.title,
    summary: proposal.summary,
    kind: isNewPlan ? "new_plan" : "change",
    kicker: kickerText,
    subkicker: isNewPlan
      ? plan
        ? "Remplace le plan actif"
        : "Premier plan"
      : `Sur la version ${proposal.baseVersion ?? "?"} du plan`,
    status,
    origin: {
      line: originLine(proposal),
      detail: formatStamp(proposal.createdAt, input.timeZone),
      staff: [coach, ...consultedStaff(proposal)],
      coachSessionId: proposal.coachSessionId,
    },
    operations: described,
    weekTotals: totals,
    newPlan,
    opinions: opinions(proposal),
    checks: pending ? checks : [],
    banner: blocked
      ? {
          tone: "danger",
          title: "Cette proposition ne peut plus être appliquée",
          body: `${blockedReason} Rien n’a été modifié. Demande à ${coach.name} de la mettre à jour.`,
        }
      : bannerFor(proposal, isNewPlan),
    blockedReason: pending ? blockedReason : null,
    actions: {
      accept: ready && !blocked,
      reject: ready,
      retry: proposal.status === "accepted",
    },
    acceptLabel: isNewPlan ? "Activer ce plan" : "Accepter",
    appliedVersion: proposal.appliedVersion,
    weekStart,
  };
}

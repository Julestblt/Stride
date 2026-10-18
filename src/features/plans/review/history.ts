import {
  consultedStaff,
  coach,
  formatPlainDay,
  formatStamp,
  formatStampDate,
  formatStampDay,
  originLine,
  type ProposalRecord,
  type StaffMember,
} from "./proposal";
import { proposalStatusDisplay, type ReviewTone } from "./review";

export const historyFilters = [
  "all",
  "pending",
  "applied",
  "rejected",
  "other",
] as const;

export type HistoryFilter = (typeof historyFilters)[number];

const filterLabels: Record<HistoryFilter, string> = {
  all: "Tout",
  pending: "À décider",
  applied: "Appliquées",
  rejected: "Refusées",
  other: "Autres",
};

export type PlanHistoryEntry = {
  id: string;
  title: string;
  status: { label: string; tone: ReviewTone };
  when: string;
  version: string | null;
  origin: { line: string; staff: StaffMember[] };
  note: string | null;
  reviewable: boolean;
  isNewPlan: boolean;
  isExtension: boolean;
  highlighted: boolean;
};

export type PlanHistory = {
  subtitle: string | null;
  filter: HistoryFilter;
  filters: { key: HistoryFilter; label: string; count: number }[];
  groups: { key: string; label: string; entries: PlanHistoryEntry[] }[];
  empty: boolean;
};

export type PlanHistoryInput = {
  proposals: ProposalRecord[];
  plan: {
    title: string;
    activeVersion: number;
    since: string | null;
  } | null;
  timeZone: string;
  filter: HistoryFilter;
};

function category(proposal: ProposalRecord): HistoryFilter {
  switch (proposal.status) {
    case "ready":
    case "accepted":
      return "pending";
    case "applied":
      return "applied";
    case "rejected":
      return "rejected";
    default:
      return "other";
  }
}

function extensionOf(proposal: ProposalRecord) {
  const operation = proposal.operations[0];
  if (
    !operation ||
    typeof operation !== "object" ||
    !("op" in operation) ||
    operation.op !== "extend_plan" ||
    !("previousEndsOn" in operation) ||
    typeof operation.previousEndsOn !== "string" ||
    !("endsOn" in operation) ||
    typeof operation.endsOn !== "string" ||
    !("weeks" in operation) ||
    !Array.isArray(operation.weeks)
  )
    return null;
  return {
    previousEndsOn: operation.previousEndsOn,
    endsOn: operation.endsOn,
    weeks: operation.weeks.length,
  };
}

function extensionNote(proposal: ProposalRecord) {
  const extension = extensionOf(proposal);
  if (!extension) return null;
  return `Fin du plan : ${formatPlainDay(extension.previousEndsOn)} → ${formatPlainDay(extension.endsOn)}, +${extension.weeks} semaine${extension.weeks > 1 ? "s" : ""}.`;
}

function version(proposal: ProposalRecord) {
  if (proposal.status === "applied" && proposal.appliedVersion)
    return proposal.baseVersion
      ? `v${proposal.baseVersion} → v${proposal.appliedVersion}`
      : `v${proposal.appliedVersion}`;
  if (proposal.baseVersion)
    return extensionOf(proposal)
      ? `Prolonge v${proposal.baseVersion}`
      : `Sur v${proposal.baseVersion}`;
  return proposal.scope === "new_plan" ? "Nouveau plan" : null;
}

function newPlanNote(proposal: ProposalRecord) {
  const creation = proposal.operations[0];
  if (
    !creation ||
    typeof creation !== "object" ||
    !("state" in creation) ||
    !creation.state ||
    typeof creation.state !== "object"
  )
    return null;
  const state = creation.state as {
    plan?: { startsOn?: unknown };
    weeks?: unknown;
    sessions?: unknown;
  };
  const weeks = Array.isArray(state.weeks) ? state.weeks.length : null;
  const sessions = Array.isArray(state.sessions)
    ? state.sessions.filter(
        (session) =>
          !session ||
          typeof session !== "object" ||
          !("sport" in session) ||
          session.sport !== "rest",
      ).length
    : null;
  const startsOn =
    typeof state.plan?.startsOn === "string" ? state.plan.startsOn : null;
  if (weeks === null || sessions === null) return null;
  return `${weeks} semaines, ${sessions} séances${startsOn ? `, début le ${formatPlainDay(startsOn)}` : ""}.`;
}

function note(proposal: ProposalRecord, timeZone: string) {
  const last = proposal.decisions.at(-1);
  switch (proposal.status) {
    case "rejected": {
      const day = last ? formatStampDay(last.createdAt, timeZone) : null;
      const reason = last?.note ? ` : ${last.note}` : "";
      return `Refusée par toi${day ? ` le ${day}` : ""}${reason}.`;
    }
    case "stale":
      return "Le plan a changé avant son application. Rien n’a été appliqué.";
    case "invalid":
      return "Elle ne respectait plus les règles de Stride. Rien n’a été appliqué.";
    case "superseded":
      return "Remplacée par une proposition plus récente avant ta décision.";
    case "expired":
      return "Expirée avant ta décision.";
    case "accepted":
      return "Acceptée, application en attente.";
    default:
      return proposal.scope === "new_plan"
        ? (newPlanNote(proposal) ?? proposal.summary)
        : (extensionNote(proposal) ?? proposal.summary);
  }
}

function monthKey(iso: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date(iso));
  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value ?? "01";
  return `${part("year")}-${part("month")}`;
}

const monthYear = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function monthLabel(key: string) {
  const text = monthYear.format(new Date(`${key}-01T00:00:00Z`));
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function buildPlanHistory(input: PlanHistoryInput): PlanHistory {
  const proposals = [...input.proposals].sort(
    (first, second) =>
      second.createdAt.localeCompare(first.createdAt) ||
      second.id.localeCompare(first.id),
  );
  const counts = new Map<HistoryFilter, number>(
    historyFilters.map((key) => [key, 0]),
  );
  for (const proposal of proposals) {
    counts.set("all", (counts.get("all") ?? 0) + 1);
    const key = category(proposal);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const groups: PlanHistory["groups"] = [];
  for (const proposal of proposals) {
    if (input.filter !== "all" && category(proposal) !== input.filter) continue;
    const key = monthKey(proposal.createdAt, input.timeZone);
    let group = groups.at(-1);
    if (!group || group.key !== key) {
      group = { key, label: monthLabel(key), entries: [] };
      groups.push(group);
    }
    group.entries.push({
      id: proposal.id,
      title: proposal.title,
      status: proposalStatusDisplay(proposal.status),
      when: formatStamp(proposal.createdAt, input.timeZone),
      version: version(proposal),
      origin: {
        line: originLine(proposal),
        staff: [coach, ...consultedStaff(proposal)],
      },
      note: note(proposal, input.timeZone),
      reviewable: proposal.status === "ready" || proposal.status === "accepted",
      isNewPlan: proposal.scope === "new_plan",
      isExtension: extensionOf(proposal) !== null,
      highlighted: proposal.status === "ready",
    });
  }
  return {
    subtitle: input.plan
      ? [
          input.plan.title,
          `version ${input.plan.activeVersion} en cours${input.plan.since ? ` depuis le ${formatStampDate(input.plan.since, input.timeZone)}` : ""}`,
        ].join(" · ")
      : null,
    filter: input.filter,
    filters: historyFilters.map((key) => ({
      key,
      label: filterLabels[key],
      count: counts.get(key) ?? 0,
    })),
    groups,
    empty: proposals.length === 0,
  };
}

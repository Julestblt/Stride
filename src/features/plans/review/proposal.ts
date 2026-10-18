import {
  defaultStaff,
  staffAgents,
  type StaffAgent,
} from "@/features/coach/staff";
import { mondayOf } from "../model/dates";
import type { PlanState } from "../model/plan";

export const proposalStatuses = [
  "draft",
  "ready",
  "accepted",
  "applied",
  "rejected",
  "expired",
  "superseded",
  "stale",
  "invalid",
  "reverted",
] as const;

export type ProposalStatus = (typeof proposalStatuses)[number];

export type SpecialistOpinion = {
  specialist: string;
  verdict: string;
  summary: string;
};

export type ProposalDecision = {
  decision: string;
  actor: string;
  note: string | null;
  resultingVersion: number | null;
  createdAt: string;
};

export type ProposalRecord = {
  id: string;
  title: string;
  summary: string | null;
  rationale: string | null;
  scope: string;
  origin: string;
  status: ProposalStatus;
  operations: unknown[];
  baseVersion: number | null;
  appliedVersion: number | null;
  createdAt: string;
  updatedAt: string;
  specialistOpinions: SpecialistOpinion[];
  coachSessionId: string | null;
  decisions: ProposalDecision[];
};

export type StaffMember = { name: string; role: string; monogram: string };

export function staffMember(specialist: string): StaffMember {
  const known = (staffAgents as readonly string[]).includes(specialist)
    ? defaultStaff[specialist as StaffAgent]
    : null;
  const member = known
    ? { name: known.name, role: known.role }
    : { name: "Spécialiste", role: "Staff" };
  return { ...member, monogram: member.name.slice(0, 1).toUpperCase() };
}

export const coach = staffMember("coach");

export function consultedStaff(proposal: ProposalRecord) {
  const seen = new Set<string>();
  return proposal.specialistOpinions.flatMap((opinion) => {
    if (seen.has(opinion.specialist)) return [];
    seen.add(opinion.specialist);
    return [staffMember(opinion.specialist)];
  });
}

export function originLine(proposal: ProposalRecord) {
  const consulted = consultedStaff(proposal).map((member) => member.name);
  const lead =
    proposal.scope === "new_plan"
      ? `Créé avec ${coach.name}`
      : `Proposée par ${coach.name}`;
  return consulted.length ? `${lead}, avec ${consulted.join(" et ")}` : lead;
}

const stampDate = (timeZone: string) =>
  new Intl.DateTimeFormat("fr-FR", {
    timeZone,
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
const stampTime = (timeZone: string) =>
  new Intl.DateTimeFormat("fr-FR", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
const calendarDay = (timeZone: string) =>
  new Intl.DateTimeFormat("fr-FR", {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

export function formatStamp(iso: string, timeZone: string) {
  const at = new Date(iso);
  return `${stampDate(timeZone).format(at)} · ${stampTime(timeZone).format(at)}`;
}

export function formatStampDate(iso: string, timeZone: string) {
  return stampDate(timeZone).format(new Date(iso));
}

export function formatStampDay(iso: string, timeZone: string) {
  return calendarDay(timeZone).format(new Date(iso));
}

export function formatStampTime(iso: string, timeZone: string) {
  return stampTime(timeZone).format(new Date(iso));
}

const planDay = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "UTC",
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const plainDay = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "UTC",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export function formatPlanDay(iso: string) {
  return planDay.format(new Date(`${iso}T00:00:00Z`));
}

export function formatPlainDay(iso: string) {
  return plainDay.format(new Date(`${iso}T00:00:00Z`));
}

const verdictLabels: Record<string, string> = {
  compatible: "D’accord",
  agree: "D’accord",
  ok: "D’accord",
  approved: "D’accord",
  compatible_with_conditions: "D’accord, avec une condition",
  conditional: "D’accord, avec une condition",
  caution: "Avec prudence",
  against: "Réservée",
  not_recommended: "Réservée",
  incompatible: "Réservée",
};

export function verdictLabel(verdict: string) {
  return verdictLabels[verdict.trim().toLowerCase()] ?? verdict;
}

export function verdictTone(verdict: string): "success" | "warning" {
  const label = verdictLabel(verdict);
  return label === "D’accord" || label === "D’accord, avec une condition"
    ? "success"
    : "warning";
}

export const outcomeReasons = [
  "stale_version",
  "frozen_session",
  "unknown_key",
  "invalid_state",
  "invalid_operations",
  "validation_failed",
  "invalid_changeset",
  "unknown_race",
] as const;

export type OutcomeReason = (typeof outcomeReasons)[number];

export function outcomeOf(reason: string): "stale" | "invalid" | null {
  switch (reason) {
    case "stale_version":
    case "frozen_session":
    case "unknown_key":
    case "invalid_state":
      return "stale";
    case "invalid_operations":
    case "validation_failed":
    case "invalid_changeset":
    case "unknown_race":
      return "invalid";
    default:
      return null;
  }
}

export function reasonText(reason: string | null) {
  switch (reason) {
    case "stale_version":
      return "Ton plan a changé depuis qu’elle a été proposée.";
    case "frozen_session":
      return "Ton plan a changé depuis : une séance qu’elle modifie est déjà passée ou faite.";
    case "unknown_key":
      return "Ton plan a changé depuis : une séance qu’elle modifie n’existe plus.";
    case "invalid_state":
      return "Ton plan a changé depuis : il n’est plus actif.";
    case "plan_replaced":
      return "Ton plan a été remplacé depuis qu’elle a été proposée.";
    case "unknown_race":
      return "Une course qu’elle cite n’existe plus dans ton calendrier.";
    case "validation_failed":
    case "invalid_operations":
    case "invalid_changeset":
      return "Elle ne respecte plus les règles de sécurité de Stride.";
    default:
      return "Ton plan a changé depuis qu’elle a été proposée.";
  }
}

export type WeekProposal = {
  id: string;
  title: string;
  summary: string | null;
};

export function proposalsByWeek(
  state: PlanState,
  proposals: (WeekProposal & { targetKeys: string[] })[],
): Record<string, WeekProposal[]> {
  const weeks: Record<string, WeekProposal[]> = {};
  for (const proposal of proposals) {
    const keys = new Set(
      proposal.targetKeys.map((key) => key.slice(key.indexOf(":") + 1)),
    );
    const starts = new Set([
      ...state.sessions
        .filter((session) => keys.has(session.sessionKey))
        .map((session) => mondayOf(session.scheduledOn)),
      ...state.weeks
        .filter((week) => keys.has(week.weekKey))
        .map((week) => week.weekStart),
    ]);
    for (const start of starts)
      (weeks[start] ??= []).push({
        id: proposal.id,
        title: proposal.title,
        summary: proposal.summary,
      });
  }
  return weeks;
}

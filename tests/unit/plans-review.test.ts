import { describe, expect, it } from "vitest";
import { buildPlanHistory } from "@/features/plans/review/history";
import {
  outcomeOf,
  proposalsByWeek,
  reasonText,
  type ProposalRecord,
} from "@/features/plans/review/proposal";
import {
  buildProposalReview,
  type ReviewInput,
} from "@/features/plans/review/review";
import { planningInputFixture } from "./coaching-tools-fixture";
import { easyRun, planState } from "./plan-fixture";

function proposal(overrides: Partial<ProposalRecord> = {}): ProposalRecord {
  return {
    id: "10000000-0000-4000-8000-000000000001",
    title: "Footing décalé à mercredi",
    summary: "Le footing de mardi passe à mercredi.",
    rationale: "Réunion tardive mardi : je décale le footing d’un jour.",
    scope: "session",
    origin: "schedule",
    status: "ready",
    operations: [
      {
        op: "move_session",
        sessionKey: "s-2026-10-20-1",
        toDate: "2026-10-21",
      },
    ],
    baseVersion: 3,
    appliedVersion: null,
    createdAt: "2026-10-14T05:42:00Z",
    updatedAt: "2026-10-14T05:42:00Z",
    specialistOpinions: [
      {
        specialist: "medical",
        verdict: "compatible",
        summary: "Rien ne s’oppose au décalage.",
      },
    ],
    coachSessionId: null,
    decisions: [],
    ...overrides,
  };
}

function input(overrides: Partial<ReviewInput> = {}): ReviewInput {
  return {
    proposal: proposal(),
    plan: { state: planState(), version: 3, activeVersion: 3 },
    today: "2026-10-14",
    timeZone: "Europe/Paris",
    matchedSessionKeys: new Set(),
    planning: null,
    races: [],
    ...overrides,
  };
}

function planning(availableWeekdays: number[]) {
  const fixture = planningInputFixture();
  return {
    ...fixture,
    availability: { ...fixture.availability, availableWeekdays },
  };
}

describe("proposal review", () => {
  it("shows a ready change with before and after, attribution and checks", () => {
    const review = buildProposalReview(
      input({ planning: planning([2, 3, 4, 6, 7]) }),
    );
    expect(review.status).toEqual({
      label: "À toi de décider",
      tone: "warning",
    });
    expect(review.kicker).toBe("Proposition · semaine 2");
    expect(review.subkicker).toBe("Sur la version 3 du plan");
    expect(review.operations).toEqual([
      {
        label: "Déplacée",
        context: "Footing",
        before: { title: "mar. 20/10/2026", meta: "50’" },
        after: { title: "mer. 21/10/2026", meta: "50’" },
      },
    ]);
    expect(review.weekTotals).toEqual([
      {
        label: "Semaine 2",
        duration: { before: "3h10", after: "3h10", delta: null },
        elevation: null,
      },
    ]);
    expect(review.origin.line).toBe("Proposée par Claire, avec Inès");
    expect(review.origin.detail).toBe("mer. 14/10/2026 · 07:42");
    expect(
      review.opinions.map((opinion) => [
        opinion.name,
        opinion.label,
        opinion.verdict?.label ?? null,
      ]),
    ).toEqual([
      ["Claire", "Coach", null],
      ["Inès", "Médecin · consultée", "D’accord"],
    ]);
    expect(review.checks).toContainEqual({
      tone: "pass",
      text: "Aucune séance passée ou déjà faite n’est modifiée.",
    });
    expect(review.checks.some((check) => check.tone === "block")).toBe(false);
    expect(review.blockedReason).toBeNull();
    expect(review.banner).toBeNull();
    expect(review.actions).toEqual({
      accept: true,
      reject: true,
      retry: false,
    });
  });

  it("disables accept when the plan moved to another version", () => {
    const review = buildProposalReview(
      input({ proposal: proposal({ baseVersion: 2 }) }),
    );
    expect(review.status).toEqual({ label: "Périmée", tone: "danger" });
    expect(review.blockedReason).toBe(
      "Ton plan a changé depuis qu’elle a été proposée : il est passé en version 3.",
    );
    expect(review.banner?.title).toBe(
      "Cette proposition ne peut plus être appliquée",
    );
    expect(review.actions).toEqual({
      accept: false,
      reject: true,
      retry: false,
    });
  });

  it("disables accept when a targeted session is already done", () => {
    const review = buildProposalReview(
      input({ matchedSessionKeys: new Set(["s-2026-10-20-1"]) }),
    );
    expect(review.blockedReason).toBe(
      "Ton plan a changé depuis : la séance du mar. 20/10/2026 est déjà passée ou faite.",
    );
    expect(review.actions.accept).toBe(false);
  });

  it("disables accept when a session key no longer exists", () => {
    const review = buildProposalReview(
      input({
        proposal: proposal({
          operations: [{ op: "skip_session", sessionKey: "s-missing" }],
        }),
      }),
    );
    expect(review.operations[0].before?.title).toBe("Séance introuvable");
    expect(review.blockedReason).toBe(
      "Ton plan a changé depuis : une séance qu’elle modifie n’existe plus.",
    );
  });

  it("disables accept when the change breaks a blocking rule", () => {
    const review = buildProposalReview(
      input({
        planning: planning([2, 4, 7]),
        proposal: proposal({
          operations: [
            {
              op: "move_session",
              sessionKey: "s-2026-10-25-1",
              toDate: "2026-10-24",
            },
          ],
        }),
      }),
    );
    expect(review.blockedReason).toBe(
      "Elle ne respecte plus une règle de sécurité de Stride : une séance tombe sur un jour où tu n’es pas disponible.",
    );
    expect(review.checks).toContainEqual({
      tone: "block",
      text: "Bloquant : une séance tombe sur un jour où tu n’es pas disponible.",
    });
    expect(review.actions.accept).toBe(false);
  });

  it("shows replaced and removed sessions with week totals", () => {
    const review = buildProposalReview(
      input({
        proposal: proposal({
          operations: [
            {
              op: "replace_session",
              sessionKey: "s-2026-10-22-1",
              content: { ...easyRun(40), title: "Footing plat" },
            },
            { op: "skip_session", sessionKey: "s-2026-10-25-1" },
          ],
        }),
      }),
    );
    expect(review.operations.map((operation) => operation.label)).toEqual([
      "Remplacée",
      "Supprimée",
    ]);
    expect(review.operations[0].after).toEqual({
      title: "Footing plat",
      meta: "40’",
    });
    expect(review.weekTotals[0].duration).toEqual({
      before: "3h10",
      after: "1h30",
      delta: "−1h40",
    });
  });

  it("is read-only once applied, rejected or stale", () => {
    const applied = buildProposalReview(
      input({
        proposal: proposal({ status: "applied", appliedVersion: 4 }),
      }),
    );
    expect(applied.banner).toMatchObject({
      tone: "success",
      title: "Appliquée · ton plan passe en version 4",
    });
    expect(applied.actions).toEqual({
      accept: false,
      reject: false,
      retry: false,
    });
    expect(applied.checks).toEqual([]);

    const rejected = buildProposalReview(
      input({ proposal: proposal({ status: "rejected" }) }),
    );
    expect(rejected.banner?.title).toBe("Refusée · ton plan ne change pas");
    expect(rejected.status.label).toBe("Refusée");

    const stale = buildProposalReview(
      input({
        proposal: proposal({
          status: "stale",
          decisions: [
            {
              decision: "stale",
              actor: "system",
              note: "stale_version",
              resultingVersion: null,
              createdAt: "2026-10-14T06:00:00Z",
            },
          ],
        }),
      }),
    );
    expect(stale.banner?.body).toBe(
      "Ton plan a changé depuis qu’elle a été proposée. Rien n’a été modifié. Demande à Claire de la mettre à jour.",
    );
    expect(stale.actions.accept).toBe(false);
  });

  it("offers a retry when the worker could not apply an accepted proposal", () => {
    const review = buildProposalReview(
      input({ proposal: proposal({ status: "accepted" }) }),
    );
    expect(review.banner?.title).toBe("Acceptée, application en attente");
    expect(review.actions).toEqual({
      accept: false,
      reject: false,
      retry: true,
    });
  });

  it("still offers a retry when an accepted proposal is blocked at render", () => {
    const review = buildProposalReview(
      input({ proposal: proposal({ status: "accepted", baseVersion: 2 }) }),
    );
    expect(review.banner?.title).toBe(
      "Cette proposition ne peut plus être appliquée",
    );
    expect(review.actions).toEqual({
      accept: false,
      reject: false,
      retry: true,
    });
  });

  it("blocks a proposal made on a plan that was replaced", () => {
    const review = buildProposalReview(input({ planReplaced: true }));
    expect(review.blockedReason).toBe(
      "Ton plan a été remplacé depuis qu’elle a été proposée.",
    );
    expect(review.actions.accept).toBe(false);
  });

  it("summarizes a new plan without a full preview", () => {
    const state = planState();
    const review = buildProposalReview(
      input({
        plan: null,
        races: [
          {
            id: "race-a",
            name: "Marathon de Paris",
            date: "2026-11-08",
            priority: "A",
            targetSeconds: 11_700,
          },
        ],
        proposal: proposal({
          scope: "new_plan",
          baseVersion: null,
          specialistOpinions: [],
          operations: [{ op: "create_plan", state }],
        }),
      }),
    );
    expect(review.kind).toBe("new_plan");
    expect(review.kicker).toBe("Proposition · nouveau plan");
    expect(review.subkicker).toBe("Premier plan");
    expect(review.acceptLabel).toBe("Activer ce plan");
    expect(review.origin.line).toBe("Créé avec Claire");
    expect(review.newPlan).toEqual({
      weeks: 4,
      sessions: 5,
      peakWeek: "3h10",
      startsOn: "12/10/2026",
      phases: [{ key: "b-base-1", name: "Base", weeks: 4, kind: "base" }],
      races: [
        {
          id: "race-a",
          name: "Marathon de Paris",
          letter: "A",
          detail: "dim. 08/11/2026 · objectif 3:15:00",
        },
      ],
      replacesActive: false,
    });
    expect(review.actions.accept).toBe(true);
  });
});

describe("plan history", () => {
  const records = [
    proposal({ id: "10000000-0000-4000-8000-000000000001" }),
    proposal({
      id: "10000000-0000-4000-8000-000000000002",
      title: "Repos avancé",
      status: "applied",
      appliedVersion: 3,
      baseVersion: 2,
      createdAt: "2026-10-05T19:10:00Z",
    }),
    proposal({
      id: "10000000-0000-4000-8000-000000000003",
      title: "Côtes courtes",
      status: "rejected",
      specialistOpinions: [],
      createdAt: "2026-10-03T16:25:00Z",
      decisions: [
        {
          decision: "rejected",
          actor: "athlete",
          note: "week-end en famille",
          resultingVersion: null,
          createdAt: "2026-10-03T17:00:00Z",
        },
      ],
    }),
    proposal({
      id: "10000000-0000-4000-8000-000000000004",
      title: "Nouveau plan · Marathon de Paris",
      scope: "new_plan",
      status: "applied",
      baseVersion: null,
      appliedVersion: 1,
      specialistOpinions: [],
      operations: [{ op: "create_plan", state: planState() }],
      createdAt: "2026-09-14T17:02:00Z",
    }),
    proposal({
      id: "10000000-0000-4000-8000-000000000005",
      title: "Seuil échangé",
      status: "stale",
      createdAt: "2026-10-01T06:05:00Z",
    }),
  ];

  it("groups proposals by month, newest first, with versions", () => {
    const history = buildPlanHistory({
      proposals: records,
      plan: {
        title: "Marathon de Paris",
        activeVersion: 3,
        since: "2026-10-05T19:12:00Z",
      },
      timeZone: "Europe/Paris",
      filter: "all",
    });
    expect(history.subtitle).toBe(
      "Marathon de Paris · version 3 en cours depuis le lun. 05/10/2026",
    );
    expect(history.groups.map((group) => group.label)).toEqual([
      "Octobre 2026",
      "Septembre 2026",
    ]);
    const entries = history.groups.flatMap((group) => group.entries);
    expect(entries.map((entry) => [entry.status.label, entry.version])).toEqual(
      [
        ["À toi de décider", "Sur v3"],
        ["Appliquée", "v2 → v3"],
        ["Refusée", "Sur v3"],
        ["Périmée", "Sur v3"],
        ["Appliquée", "v1"],
      ],
    );
    expect(entries[0]).toMatchObject({
      when: "mer. 14/10/2026 · 07:42",
      reviewable: true,
      highlighted: true,
      origin: { line: "Proposée par Claire, avec Inès" },
    });
    expect(entries[2].note).toBe(
      "Refusée par toi le 03/10/2026 : week-end en famille.",
    );
    expect(entries[3].note).toBe(
      "Le plan a changé avant son application. Rien n’a été appliqué.",
    );
    expect(entries[4]).toMatchObject({
      origin: { line: "Créé avec Claire" },
      note: "4 semaines, 5 séances, début le 12/10/2026.",
      isNewPlan: true,
    });
    expect(history.filters).toEqual([
      { key: "all", label: "Tout", count: 5 },
      { key: "pending", label: "À décider", count: 1 },
      { key: "applied", label: "Appliquées", count: 2 },
      { key: "rejected", label: "Refusées", count: 1 },
      { key: "other", label: "Autres", count: 1 },
    ]);
  });

  it("filters by status and keeps the counts", () => {
    const history = buildPlanHistory({
      proposals: records,
      plan: null,
      timeZone: "Europe/Paris",
      filter: "applied",
    });
    expect(history.subtitle).toBeNull();
    expect(
      history.groups.flatMap((group) =>
        group.entries.map((entry) => entry.title),
      ),
    ).toEqual(["Repos avancé", "Nouveau plan · Marathon de Paris"]);
    expect(history.filters[0].count).toBe(5);
  });

  it("is empty without proposals", () => {
    expect(
      buildPlanHistory({
        proposals: [],
        plan: null,
        timeZone: "Europe/Paris",
        filter: "all",
      }),
    ).toMatchObject({ empty: true, groups: [] });
  });
});

describe("worker outcomes", () => {
  it("records plan moves as stale and rule failures as invalid", () => {
    expect(outcomeOf("stale_version")).toBe("stale");
    expect(outcomeOf("frozen_session")).toBe("stale");
    expect(outcomeOf("unknown_key")).toBe("stale");
    expect(outcomeOf("invalid_operations")).toBe("invalid");
    expect(outcomeOf("validation_failed")).toBe("invalid");
    expect(outcomeOf("invalid_state")).toBe("stale");
    expect(outcomeOf("unknown_race")).toBe("invalid");
    expect(outcomeOf("invalid_changeset")).toBe("invalid");
    expect(reasonText("unknown_race")).toBe(
      "Une course qu’elle cite n’existe plus dans ton calendrier.",
    );
    expect(reasonText("invalid_state")).toBe(
      "Ton plan a changé depuis : il n’est plus actif.",
    );
    expect(outcomeOf("worker_unavailable")).toBeNull();
  });
});

describe("week proposals", () => {
  it("lists the ready proposals touching each week", () => {
    expect(
      proposalsByWeek(planState(), [
        {
          id: "p-1",
          title: "Seuil raccourci",
          summary: null,
          targetKeys: ["session:s-2026-10-22-1"],
        },
        {
          id: "p-2",
          title: "Footing décalé",
          summary: "Mardi passe à jeudi.",
          targetKeys: ["s-2026-10-20-1", "s-2026-10-25-1"],
        },
        {
          id: "p-3",
          title: "Objectifs revus",
          summary: null,
          targetKeys: ["week:w-2026-11-02"],
        },
      ]),
    ).toEqual({
      "2026-10-19": [
        { id: "p-1", title: "Seuil raccourci", summary: null },
        { id: "p-2", title: "Footing décalé", summary: "Mardi passe à jeudi." },
      ],
      "2026-11-02": [{ id: "p-3", title: "Objectifs revus", summary: null }],
    });
  });
});

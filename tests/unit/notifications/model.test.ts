import { describe, expect, it } from "vitest";
import { defaultStaff } from "@/features/coach/staff";
import {
  bellLabel,
  dayLabel,
  groupByDay,
  matchesFilter,
  notificationTarget,
  notificationView,
  parseFilter,
  parseNotification,
  parseNotifications,
} from "@/features/notifications/model";

const proposalId = "a7000000-0000-4000-8000-0000000000e1";
const threadId = "a7000000-0000-4000-8000-00000000c001";

function row(overrides: Record<string, unknown>) {
  return {
    id: "a7000000-0000-4000-8000-000000000001",
    kind: "plan_proposal",
    payload: { proposalId, title: "Raccourcir ton seuil", summary: "4 × 6’" },
    occurred_at: "2026-10-07T04:15:00+00:00",
    read_at: null,
    resolved_at: null,
    resolution: null,
    ...overrides,
  };
}

function view(overrides: Record<string, unknown>) {
  const notification = parseNotification(row(overrides));
  if (!notification) throw new Error("invalid fixture");
  return notificationView(notification, defaultStaff);
}

describe("notification view", () => {
  it("asks the athlete to review a ready proposal", () => {
    expect(view({})).toMatchObject({
      family: "plan",
      title: "Claire propose : Raccourcir ton seuil",
      body: "4 × 6’",
      href: `/plan?proposition=${proposalId}`,
      unread: true,
      todo: true,
      status: { label: "À traiter", tone: "warning" },
      action: "Voir la proposition",
      time: "06:15",
    });
  });

  it.each([
    ["applied", "Appliqué"],
    ["rejected", "Refusée"],
    ["replaced", "Remplacée"],
  ])("resolves a %s proposal", (resolution, label) => {
    const resolved = view({
      resolved_at: "2026-10-07T05:00:00+00:00",
      resolution,
      read_at: "2026-10-07T05:00:00+00:00",
    });
    expect(resolved).toMatchObject({
      todo: false,
      unread: false,
      action: null,
      status: { label },
    });
  });

  it("links a staff reply to its thread with the coach excerpt", () => {
    expect(
      view({
        kind: "staff_reply",
        payload: {
          threadId,
          threadTitle: "Ravitaillements",
          agent: "strategist",
          excerpt: "7 ravitos sur l’EcoTrail.",
        },
      }),
    ).toMatchObject({
      family: "staff",
      agent: "strategist",
      title: "Hugo a répondu sur « Ravitaillements »",
      body: "7 ravitos sur l’EcoTrail.",
      href: `/coach/${threadId}`,
      todo: false,
      status: null,
      action: null,
    });
  });

  it("waits for an answer to a staff question, then shows it answered", () => {
    const payload = {
      threadId,
      threadTitle: "Seuil",
      agent: "coach",
      toolUseId: "toolu_legs",
      question: "Et tes jambes ce matin ?",
    };
    expect(view({ kind: "staff_question", payload })).toMatchObject({
      title: "Claire t’a posé une question",
      body: "« Et tes jambes ce matin ? »",
      todo: true,
      status: { label: "Réponse attendue", tone: "warning" },
      action: "Répondre",
    });
    expect(
      view({
        kind: "staff_question",
        payload,
        resolved_at: "2026-10-07T05:00:00+00:00",
        resolution: "answered",
      }),
    ).toMatchObject({
      todo: false,
      status: { label: "Répondu", tone: "success" },
      action: null,
    });
  });

  it("drops unknown kinds and invalid payloads", () => {
    expect(
      parseNotifications([
        row({ kind: "garmin_sync" }),
        row({ payload: { title: "Sans identifiant" } }),
        row({}),
      ]),
    ).toHaveLength(1);
  });
});

describe("notification target", () => {
  it("opens the notification link", () => {
    expect(notificationTarget(row({}))).toBe(`/plan?proposition=${proposalId}`);
  });

  it("falls back to the history for an unknown or invalid notification", () => {
    expect(notificationTarget(null)).toBe("/notifications");
    expect(notificationTarget(row({ kind: "garmin_sync" }))).toBe(
      "/notifications",
    );
    expect(notificationTarget({ id: "not-a-uuid" })).toBe("/notifications");
  });
});

describe("notification filters", () => {
  const proposal = parseNotification(row({}))!;
  const reply = parseNotification(
    row({
      kind: "staff_reply",
      payload: { threadId, threadTitle: null, agent: "coach", excerpt: "Ok" },
    }),
  )!;

  it("reads the filter key from the query", () => {
    expect(parseFilter("a-traiter")).toBe("a-traiter");
    expect(parseFilter(["staff"])).toBe("toutes");
    expect(parseFilter("inconnu")).toBe("toutes");
  });

  it("matches each filter", () => {
    expect(matchesFilter(proposal, "a-traiter")).toBe(true);
    expect(matchesFilter(proposal, "staff")).toBe(false);
    expect(matchesFilter(reply, "staff")).toBe(true);
    expect(matchesFilter(reply, "a-traiter")).toBe(false);
    expect(matchesFilter(reply, "donnees")).toBe(false);
    expect(matchesFilter(reply, "toutes")).toBe(true);
  });
});

describe("notification days", () => {
  const now = new Date("2026-10-07T22:30:00Z");

  it("labels days in Europe/Paris across midnight", () => {
    expect(dayLabel("2026-10-07T22:01:00Z", now)).toBe("Aujourd’hui");
    expect(dayLabel("2026-10-07T21:59:00Z", now)).toBe("Hier");
    expect(dayLabel("2026-10-07T21:59:00Z", now, { withDate: true })).toBe(
      "Hier · mer. 7 oct.",
    );
    expect(dayLabel("2026-10-06T21:59:00Z", now)).toBe("mar. 6 oct.");
  });

  it("groups the newest day first", () => {
    const at = (occurred_at: string, id: string) =>
      view({ occurred_at, id: `a7000000-0000-4000-8000-00000000000${id}` });
    const days = groupByDay(
      [
        at("2026-10-06T21:30:00Z", "1"),
        at("2026-10-06T22:30:00Z", "2"),
        at("2026-10-07T06:00:00Z", "3"),
      ],
      new Date("2026-10-07T08:00:00Z"),
    );
    expect(days.map((day) => [day.label, day.items.length])).toEqual([
      ["Aujourd’hui", 2],
      ["Hier", 1],
    ]);
  });

  it("names the unread count for the bell", () => {
    expect(bellLabel(0)).toBe("Notifications");
    expect(bellLabel(4)).toBe("Notifications, 4 non lues");
  });
});

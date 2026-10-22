import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const reads = vi.hoisted(() => ({
  readActivity: vi.fn(),
  listActivities: vi.fn(),
  listRaces: vi.fn(),
  readActivePlan: vi.fn(),
  loadSessionDebrief: vi.fn(),
}));

vi.mock("../../src/server/activities/activities", () => ({
  readActivity: reads.readActivity,
  listActivities: reads.listActivities,
}));
vi.mock("../../src/server/races/races", () => ({
  listRaces: reads.listRaces,
}));
vi.mock("../../src/server/plans/stored", () => ({
  readActivePlan: reads.readActivePlan,
}));
vi.mock("../../src/server/plans/debrief", () => ({
  loadSessionDebrief: reads.loadSessionDebrief,
}));

import {
  attachmentCountLabel,
  attachmentGroups,
  attachmentHref,
  attachmentMeta,
  coachAttachmentsSchema,
  dedupeAttachments,
  toggleAttachment,
  type AttachmentOption,
} from "../../src/features/coach/attachments";
import {
  AttachmentAccessError,
  attachmentContextSchema,
  attachmentContextText,
  loadAttachmentOptions,
  loadSessionOption,
  resolveAttachments,
} from "../../src/server/coaching/attachments";
import {
  feelingView,
  type DebriefView,
} from "../../src/features/plans/debrief/view";
import type { OnboardingContext } from "../../src/server/onboarding/context";

const today = "2026-10-08";
const context = {
  userId: "a0000000-0000-4000-8000-00000000000a",
} as OnboardingContext;

function option(
  kind: AttachmentOption["kind"],
  id: string,
  date: string | null,
  values: Partial<AttachmentOption> = {},
): AttachmentOption {
  return {
    kind,
    id,
    title: id,
    date,
    distanceKm: null,
    elevationGainM: null,
    ...values,
  };
}

const activity = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-000000000001",
  type: "trail_running",
  name: "Sortie longue vallonnée",
  routeName: null,
  date: "2026-10-04",
  distanceMeters: 24_600,
  durationSeconds: 9_000,
  elevationGainMeters: 680,
  averageHeartRate: 141.4,
};
const race = {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  name: "Trail des Lacs",
  kind: "trail",
  date: "2027-06-27",
  distanceKm: 50,
  elevationGainM: 2400,
  priority: "B",
  targetSeconds: null,
  revision: 1,
};
const session = {
  sessionKey: "w02-thu",
  scheduledOn: "2026-10-09",
  sport: "run",
  kind: "threshold",
  title: "Seuil 3 × 10 min",
  purpose: "Tenir l’allure seuil.",
  isKey: true,
  priority: "key",
  targets: {
    durationSeconds: 3_600,
    distanceMeters: 11_000,
    elevationGainMeters: null,
  },
};

describe("attachment choices", () => {
  it("accepts at most three typed references", () => {
    const ref = { kind: "race", id: race.id } as const;
    expect(coachAttachmentsSchema.safeParse([ref, ref, ref]).success).toBe(
      true,
    );
    expect(coachAttachmentsSchema.safeParse([ref, ref, ref, ref]).success).toBe(
      false,
    );
    expect(
      coachAttachmentsSchema.safeParse([{ kind: "note", id: "x" }]).success,
    ).toBe(false);
    expect(
      coachAttachmentsSchema.safeParse([{ kind: "race", id: "a b" }]).success,
    ).toBe(false);
    expect(
      coachAttachmentsSchema.safeParse([{ kind: "activity", id: "w02-thu" }])
        .success,
    ).toBe(false);
    expect(
      coachAttachmentsSchema.safeParse([{ kind: "session", id: "w02-thu" }])
        .success,
    ).toBe(true);
  });

  it("keeps a picked item once and stops at three", () => {
    const first = option("activity", "a1", today);
    expect(dedupeAttachments([first, { ...first }])).toEqual([first]);
    const three = [
      first,
      option("race", "r1", today),
      option("session", "s1", today),
    ];
    expect(toggleAttachment(three, option("race", "r2", today))).toEqual(three);
    expect(toggleAttachment(three, { ...first })).toEqual(three.slice(1));
    expect(
      toggleAttachment([first], option("activity", "a2", today)),
    ).toHaveLength(2);
  });

  it("formats French meta lines and links", () => {
    expect(
      attachmentMeta(
        option("activity", "a1", "2026-10-04", {
          distanceKm: 24.6,
          elevationGainM: 680,
        }),
        today,
      ),
    ).toBe("dim. 04/10/2026 · 24,6 km · 680 m D+");
    expect(attachmentMeta(option("session", "s1", "2026-10-08"), today)).toBe(
      "jeu. 08/10/2026 · prévue",
    );
    expect(attachmentMeta(option("session", "s0", "2026-10-06"), today)).toBe(
      "mar. 06/10/2026",
    );
    expect(attachmentHref({ kind: "session", id: "w02-thu" })).toBe(
      "/plan?seance=w02-thu",
    );
    expect(attachmentHref({ kind: "activity", id: "a1" })).toBe(
      "/activities/a1",
    );
    expect(attachmentHref({ kind: "race", id: "r1" })).toBe("/races/r1");
    expect(attachmentCountLabel(2)).toBe("2 éléments joints sur 3");
    expect(attachmentCountLabel(3)).toBe("3 éléments au plus");
  });

  it("groups activities by week and sessions around today", () => {
    expect(
      attachmentGroups(
        "activity",
        [
          option("activity", "old", "2026-09-23"),
          option("activity", "now", "2026-10-06"),
          option("activity", "last", "2026-10-04"),
        ],
        today,
      ).map((group) => [group.label, group.options.map((item) => item.id)]),
    ).toEqual([
      ["Cette semaine", ["now"]],
      ["Semaine dernière", ["last"]],
      ["Semaine du 21/09/2026", ["old"]],
    ]);
    expect(
      attachmentGroups(
        "session",
        [
          option("session", "past", "2026-10-01"),
          option("session", "later", "2026-10-12"),
          option("session", "soon", "2026-10-08"),
        ],
        today,
      ).map((group) => [group.label, group.options.map((item) => item.id)]),
    ).toEqual([
      ["À venir", ["soon", "later"]],
      ["Passées", ["past"]],
    ]);
  });
});

describe("attachment resolution", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    reads.readActivity.mockImplementation(async (_context, id: string) =>
      id === activity.id ? activity : null,
    );
    reads.listRaces.mockResolvedValue([race]);
    reads.readActivePlan.mockResolvedValue({ state: { sessions: [session] } });
    reads.loadSessionDebrief.mockResolvedValue(null);
  });

  it("adds the session debrief to the context block", async () => {
    const debrief: DebriefView = {
      sessionKey: session.sessionKey,
      activityId: activity.id,
      sessionTitle: "Seuil 3 × 10 min",
      aligned: true,
      verdict: {
        tone: "warning",
        title: "Fractions trop rapides",
        body: "2 fractions sur 3 plus vite que la cible.",
      },
      alignment: "7 tours alignés sur les 7 étapes",
      note: null,
      steps: [
        {
          key: "1",
          compact: false,
          name: "Seuil 1",
          detail: "10:00 · FC 166",
          target: "4:38–4:42",
          actual: "4:24",
          actualTone: "danger",
          status: { label: "Trop vite", tone: "danger", chip: true },
          zone: 4,
        },
      ],
      feeling: feelingView({ source: "athlete", effort: 8, feel: 25 }),
      coachHref: "/coach/nouvelle?seance=w02-thu",
      planHref: "/plan?seance=w02-thu",
    };
    reads.loadSessionDebrief.mockResolvedValue(debrief);
    const resolved = await resolveAttachments(context, [
      { kind: "session", id: session.sessionKey },
    ]);
    expect(reads.loadSessionDebrief).toHaveBeenCalledWith(context, {
      sessionKey: session.sessionKey,
    });
    const block = attachmentContextSchema.parse(
      JSON.parse(attachmentContextText(resolved)),
    );
    expect(block.attachments[0]).toMatchObject({
      kind: "session",
      debrief: {
        activityId: activity.id,
        verdict: { title: "Fractions trop rapides" },
        stepsAligned: true,
        steps: [
          {
            name: "Seuil 1",
            target: "4:38–4:42",
            actual: "4:24",
            status: "Trop vite",
          },
        ],
        feeling: { source: "athlete", effort: 8, feel: "Mal" },
      },
    });
  });

  it("preselects a session from the plan even outside the picker window", async () => {
    const options = { session: [], activity: [], race: [] };
    expect(
      await loadSessionOption(context, options, session.sessionKey),
    ).toMatchObject([
      { kind: "session", id: session.sessionKey, title: "Seuil 3 × 10 min" },
    ]);
    expect(await loadSessionOption(context, options, "unknown")).toEqual([]);
    expect(await loadSessionOption(context, options, "Bad Key!")).toEqual([]);
  });

  it("reads each record for the athlete and builds a typed context block", async () => {
    const resolved = await resolveAttachments(context, [
      { kind: "activity", id: activity.id },
      { kind: "race", id: race.id },
      { kind: "session", id: session.sessionKey },
      { kind: "race", id: race.id },
    ]);
    expect(reads.readActivity).toHaveBeenCalledWith(context, activity.id);
    expect(reads.listRaces).toHaveBeenCalledWith(context);
    expect(resolved.map((item) => [item.kind, item.title, item.date])).toEqual([
      ["activity", "Sortie longue vallonnée", "2026-10-04"],
      ["race", "Trail des Lacs", "2027-06-27"],
      ["session", "Seuil 3 × 10 min", "2026-10-09"],
    ]);
    const block = attachmentContextSchema.parse(
      JSON.parse(attachmentContextText(resolved)),
    );
    expect(block.attachments[0]).toMatchObject({
      kind: "activity",
      id: activity.id,
      distanceKm: 24.6,
      durationMinutes: 150,
      elevationGainM: 680,
      averageHeartRateBpm: 141,
    });
    expect(block.attachments[2]).toMatchObject({
      kind: "session",
      durationMinutes: 60,
      distanceKm: 11,
    });
  });

  it("drops heart rate and target values that round to zero", async () => {
    reads.readActivity.mockResolvedValue({
      ...activity,
      averageHeartRate: 0.3,
    });
    reads.listRaces.mockResolvedValue([{ ...race, targetSeconds: 0.4 }]);
    const resolved = await resolveAttachments(context, [
      { kind: "activity", id: activity.id },
      { kind: "race", id: race.id },
    ]);
    const block = attachmentContextSchema.parse(
      JSON.parse(attachmentContextText(resolved)),
    );
    expect(block.attachments[0]).not.toHaveProperty("averageHeartRateBpm");
    expect(block.attachments[1]).not.toHaveProperty("targetSeconds");
  });

  it("refuses a record the athlete does not own", async () => {
    await expect(
      resolveAttachments(context, [
        { kind: "activity", id: "aaaaaaaa-aaaa-4aaa-8aaa-999999999999" },
      ]),
    ).rejects.toBeInstanceOf(AttachmentAccessError);
    await expect(
      resolveAttachments(context, [
        { kind: "race", id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" },
      ]),
    ).rejects.toBeInstanceOf(AttachmentAccessError);
    reads.readActivePlan.mockResolvedValue(null);
    await expect(
      resolveAttachments(context, [{ kind: "session", id: "w02-thu" }]),
    ).rejects.toBeInstanceOf(AttachmentAccessError);
  });

  it("lists the picker options and keeps the others when one read fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    reads.listActivities.mockRejectedValue(new Error("down"));
    reads.readActivePlan.mockResolvedValue({
      state: {
        sessions: [
          session,
          { ...session, sessionKey: "far", scheduledOn: "2026-12-01" },
          { ...session, sessionKey: "rest", sport: "rest", kind: "rest" },
        ],
      },
    });
    const options = await loadAttachmentOptions(context, today);
    expect(options.activity).toEqual([]);
    expect(options.session.map((item) => item.id)).toEqual(["w02-thu"]);
    expect(options.race).toMatchObject([
      { kind: "race", id: race.id, title: "Trail des Lacs" },
    ]);
  });
});

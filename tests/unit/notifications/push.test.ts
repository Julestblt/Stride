import { describe, expect, it } from "vitest";
import {
  applicationServerKey,
  deviceLabel,
  deviceName,
  isPushEndpoint,
  pushDeviceState,
  pushMessage,
  pushPreferencesSchema,
  pushSummary,
  type PushDelivery,
} from "@/features/notifications/push";

const threadId = "a7000000-0000-4000-8000-00000000c001";
const activityId = "a7000000-0000-4000-8000-00000000a001";

function delivery(
  kind: string,
  payload: unknown,
  faces: unknown = null,
): PushDelivery {
  return {
    id: "a7000000-0000-4000-8000-000000000d01",
    subscription: {
      id: "a7000000-0000-4000-8000-000000000501",
      endpoint: "https://push.example.com/a",
      keys: { p256dh: "key", auth: "auth" },
    },
    kind,
    payload,
    occurredAt: "2026-10-23T05:00:00+00:00",
    faces,
  };
}

describe("push message", () => {
  it("names the staff member who replied with the athlete's chosen face", () => {
    expect(
      pushMessage(
        delivery(
          "staff_reply",
          {
            threadId,
            threadTitle: "Sortie longue",
            agent: "coach",
            excerpt: "On garde la sortie longue dimanche.",
          },
          { coach: "thomas" },
        ),
      ),
    ).toEqual({
      title: "Thomas a répondu",
      body: "« On garde la sortie longue dimanche. »",
      url: `/coach/${threadId}`,
      tag: `staff_reply:/coach/${threadId}`,
    });
  });

  it("falls back to default faces when the profile is missing", () => {
    expect(
      pushMessage(
        delivery("staff_question", {
          threadId,
          threadTitle: null,
          agent: "medical",
          question: "Où as-tu mal ?",
        }),
      )?.title,
    ).toBe("Inès t’a posé une question");
  });

  it("announces a ready debrief that opens the activity", () => {
    expect(
      pushMessage(
        delivery("garmin_activity", {
          activityId,
          name: "Footing",
          type: "running",
          distanceMeters: 10400,
          durationSeconds: 3138,
          matched: false,
        }),
      ),
    ).toMatchObject({
      title: "Débrief prêt",
      body: "Sortie de 10,4 km en 52:18 importée depuis Garmin.",
      url: `/activities/${activityId}`,
    });
  });

  it("tells the athlete when a workout did not reach the watch", () => {
    expect(
      pushMessage(
        delivery("watch_workout", {
          externalKey: "plan:s-1",
          scheduledOn: "2026-10-24",
          status: "failed",
          errorCode: null,
          sessionTitle: "Seuil 3 × 10 min",
        }),
      ),
    ).toMatchObject({
      title: "Séance non envoyée sur la montre",
      body: "« Seuil 3 × 10 min » du sam. 24 oct. n’a pas pu partir. Ouvre ton plan pour réessayer.",
      url: "/plan",
    });
  });

  it("reuses the notification center copy for proposals", () => {
    expect(
      pushMessage(
        delivery("plan_proposal", {
          proposalId: "a7000000-0000-4000-8000-0000000000e1",
          title: "Semaine allégée",
          summary: "Deux séances raccourcies.",
        }),
      ),
    ).toMatchObject({
      title: "Claire propose : Semaine allégée",
      body: "Deux séances raccourcies.",
    });
  });

  it("builds the morning reminder from the planned sessions", () => {
    expect(
      pushMessage(
        delivery("session_reminder", {
          day: "2026-10-23",
          sessions: [
            { title: "Seuil 3 × 10 min", isKey: true, durationSeconds: 3900 },
            { title: "Mobilité", isKey: false, durationSeconds: null },
          ],
        }),
      ),
    ).toEqual({
      title: "Séance du jour : Seuil 3 × 10 min",
      body: "1h05 · + 1 autre séance · ouvre Aujourd’hui pour le détail et ta paire.",
      url: "/today",
      tag: "session_reminder:2026-10-23",
    });
  });

  it("skips gear questions and unreadable payloads", () => {
    expect(
      pushMessage(
        delivery("gear_mismatch", {
          activityId,
          activityName: null,
          sessionTitle: null,
          day: null,
          garmin: null,
          planned: null,
        }),
      ),
    ).toBeNull();
    expect(pushMessage(delivery("staff_reply", { threadId }))).toBeNull();
    expect(
      pushMessage(delivery("session_reminder", { sessions: [] })),
    ).toBeNull();
  });
});

describe("push endpoints", () => {
  it("accepts browser push services only", () => {
    expect(isPushEndpoint("https://web.push.apple.com/QGx")).toBe(true);
    expect(isPushEndpoint("https://fcm.googleapis.com/fcm/send/abc")).toBe(
      true,
    );
    expect(
      isPushEndpoint("https://updates.push.services.mozilla.com/wpush/v2/x"),
    ).toBe(true);
    expect(isPushEndpoint("https://push.apple.com.example.com/x")).toBe(false);
    expect(isPushEndpoint("https://10.0.0.1/internal")).toBe(false);
  });
});

describe("push preferences", () => {
  it("defaults every category to on", () => {
    expect(pushPreferencesSchema.parse({ plan_staff: false })).toEqual({
      session_reminder: true,
      plan_staff: false,
      debrief: true,
      garmin_issues: true,
    });
  });
});

describe("push device", () => {
  const ready = {
    configured: true,
    appleMobile: false,
    standalone: false,
    supported: true,
    permission: "default" as NotificationPermission,
    subscribed: false,
  };

  it("asks iPhone users to install the app first", () => {
    expect(
      pushDeviceState({ ...ready, appleMobile: true, supported: false }),
    ).toBe("install");
    expect(
      pushDeviceState({ ...ready, appleMobile: true, standalone: true }),
    ).toBe("off");
  });

  it("explains unavailable, unsupported and blocked devices", () => {
    expect(pushDeviceState({ ...ready, configured: false })).toBe(
      "unavailable",
    );
    expect(pushDeviceState({ ...ready, supported: false })).toBe("unsupported");
    expect(pushDeviceState({ ...ready, permission: "denied" })).toBe("denied");
    expect(pushDeviceState({ ...ready, subscribed: true })).toBe("on");
  });

  it("names the device", () => {
    const iphone =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15";
    const ipad =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15";
    expect(deviceName(deviceLabel(iphone))).toBe("Sur cet iPhone");
    expect(deviceLabel(ipad, 5)).toBe("iPad");
    expect(deviceLabel(ipad, 0)).toBe("Mac");
    expect(deviceName(deviceLabel("Mozilla/5.0 (X11; Linux x86_64)"))).toBe(
      "Sur ce navigateur",
    );
  });

  it("decodes the VAPID public key", () => {
    expect(Array.from(applicationServerKey("AQID_-8"))).toEqual([
      1, 2, 3, 255, 239,
    ]);
  });
});

describe("pushSummary", () => {
  const preferences = {
    session_reminder: true,
    plan_staff: true,
    debrief: true,
    garmin_issues: true,
  };

  it("lists the enabled categories once a device receives push", () => {
    expect(pushSummary({ configured: true, devices: 1, preferences })).toBe(
      "Rappels, plan, débrief, Garmin",
    );
    expect(
      pushSummary({
        configured: true,
        devices: 2,
        preferences: {
          ...preferences,
          session_reminder: false,
          debrief: false,
        },
      }),
    ).toBe("Plan, Garmin");
  });

  it("says when push is off, unregistered or unavailable", () => {
    expect(
      pushSummary({
        configured: true,
        devices: 1,
        preferences: {
          session_reminder: false,
          plan_staff: false,
          debrief: false,
          garmin_issues: false,
        },
      }),
    ).toBe("Push coupé");
    expect(pushSummary({ configured: true, devices: 0, preferences })).toBe(
      "Push à activer",
    );
    expect(pushSummary({ configured: false, devices: 1, preferences })).toBe(
      "Dans l’app uniquement",
    );
  });
});

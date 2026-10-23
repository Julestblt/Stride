import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const sendNotification = vi.fn();
vi.mock("web-push", () => ({
  sendNotification: (...args: unknown[]) => sendNotification(...args),
  WebPushError: class extends Error {},
}));

const { dispatchPushes } = await import("@/server/push/send");

const environment = {
  publicKey: "public",
  privateKey: "private",
  subject: "mailto:test@example.com",
  dispatchSecret: "secret",
};

describe("push dispatch", () => {
  it("reports a device outside the push services as gone without sending", async () => {
    const subscriptionId = "a7000000-0000-4000-8000-000000000501";
    const result = await dispatchPushes(environment, [
      {
        id: "a7000000-0000-4000-8000-000000000d01",
        subscription: {
          id: subscriptionId,
          endpoint: "https://10.0.0.1/internal",
          keys: { p256dh: "key", auth: "auth" },
        },
        kind: "session_reminder",
        payload: {},
        occurredAt: "2026-10-23T05:00:00+00:00",
        faces: null,
      },
    ]);
    expect(result).toEqual({ gone: [subscriptionId], failed: [] });
    expect(sendNotification).not.toHaveBeenCalled();
  });
});

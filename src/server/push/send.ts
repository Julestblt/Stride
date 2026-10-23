import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { sendNotification, WebPushError } from "web-push";
import {
  pushDeliverySchema,
  pushMessage,
  pushTimeToLive,
  type PushDelivery,
} from "@/features/notifications/push";
import type { PushEnvironment } from "./environment";

export type DispatchResult = { gone: string[]; failed: string[] };

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

export function authorizedDispatch(
  header: string | null,
  environment: PushEnvironment,
) {
  const token = header?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return false;
  return timingSafeEqual(digest(token), digest(environment.dispatchSecret));
}

async function deliver(
  environment: PushEnvironment,
  delivery: PushDelivery,
): Promise<"sent" | "gone" | "failed"> {
  const message = pushMessage(delivery);
  if (!message) return "sent";
  try {
    await sendNotification(
      {
        endpoint: delivery.subscription.endpoint,
        keys: delivery.subscription.keys,
      },
      JSON.stringify(message),
      {
        vapidDetails: {
          subject: environment.subject,
          publicKey: environment.publicKey,
          privateKey: environment.privateKey,
        },
        TTL: pushTimeToLive(delivery.kind),
        urgency: "normal",
        timeout: 10_000,
      },
    );
    return "sent";
  } catch (error) {
    if (
      error instanceof WebPushError &&
      (error.statusCode === 404 || error.statusCode === 410)
    )
      return "gone";
    return "failed";
  }
}

export async function dispatchPushes(
  environment: PushEnvironment,
  items: readonly unknown[],
): Promise<DispatchResult> {
  const deliveries = items.flatMap((item) => {
    const parsed = pushDeliverySchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
  const outcomes = await Promise.all(
    deliveries.map(async (delivery) => ({
      delivery,
      outcome: await deliver(environment, delivery),
    })),
  );
  return {
    gone: [
      ...new Set(
        outcomes
          .filter(({ outcome }) => outcome === "gone")
          .map(({ delivery }) => delivery.subscription.id),
      ),
    ],
    failed: outcomes
      .filter(({ outcome }) => outcome === "failed")
      .map(({ delivery }) => delivery.id),
  };
}

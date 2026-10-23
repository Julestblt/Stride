"use client";

import { unsubscribePush } from "@/server/push/actions";

async function release() {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration("/");
  const subscription = await registration?.pushManager?.getSubscription();
  if (!subscription) return;
  await unsubscribePush({ endpoint: subscription.endpoint }).catch(() => null);
  await subscription.unsubscribe().catch(() => false);
}

export async function releasePushSubscription() {
  await Promise.race([
    release().catch(() => undefined),
    new Promise((resolve) => setTimeout(resolve, 3000)),
  ]);
}

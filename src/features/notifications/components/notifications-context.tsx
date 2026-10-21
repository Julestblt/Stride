"use client";

import { createContext, useContext } from "react";
import type { NotificationFeed } from "../model";

type NotificationsState = { feed: NotificationFeed | null; now: string };

const NotificationsContext = createContext<NotificationsState>({
  feed: null,
  now: new Date(0).toISOString(),
});

export function NotificationsProvider({
  feed,
  now,
  children,
}: NotificationsState & { children: React.ReactNode }) {
  return (
    <NotificationsContext value={{ feed, now }}>
      {children}
    </NotificationsContext>
  );
}

export function useNotifications() {
  return useContext(NotificationsContext);
}

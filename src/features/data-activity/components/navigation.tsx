"use client";

import Link, { useLinkStatus } from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useTransition,
  type ComponentProps,
} from "react";
import { useDataActivity } from "./provider";

export function DataActivityPending({ pending }: { pending: boolean }) {
  const markLoading = useDataActivity()?.markLoading;
  useEffect(() => {
    if (pending) return markLoading?.();
  }, [pending, markLoading]);
  return null;
}

function LinkPending() {
  const { pending } = useLinkStatus();
  return <DataActivityPending pending={pending} />;
}

export function DataActivityLink({
  children,
  ...props
}: ComponentProps<typeof Link>) {
  return (
    <Link {...props}>
      {children}
      <LinkPending />
    </Link>
  );
}

export function useDataActivityNavigation() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const markLoading = useDataActivity()?.markLoading;
  useEffect(() => {
    if (pending) return markLoading?.();
  }, [pending, markLoading]);
  return useCallback(
    (href: string) => {
      startTransition(() => router.push(href));
    },
    [router],
  );
}

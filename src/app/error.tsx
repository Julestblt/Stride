"use client";

import { StandaloneError } from "@/features/not-found/components/standalone-error";

export default function RootError({ retry }: { retry: () => void }) {
  return <StandaloneError retry={retry} />;
}

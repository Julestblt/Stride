"use client";

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export function HistoryBackButton() {
  const router = useRouter();

  return (
    <Button
      className="w-full"
      variant="outline"
      onClick={() => {
        if (window.history.length > 1) {
          window.history.back();
        } else {
          router.push("/");
        }
      }}
      type="button"
    >
      Page précédente
    </Button>
  );
}

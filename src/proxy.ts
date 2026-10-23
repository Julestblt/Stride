import type { NextRequest } from "next/server";
import { refreshSession } from "@/server/supabase/refresh-session";

export async function proxy(request: NextRequest) {
  return refreshSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|.*\\.(?:svg|png|ico|jpg|jpeg|gif|webp)$).*)",
  ],
};

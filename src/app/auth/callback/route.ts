import type { NextRequest } from "next/server";
import { completeAuthCallback } from "@/server/auth/callback";

export async function GET(request: NextRequest) {
  return completeAuthCallback(request);
}

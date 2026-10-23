import { appIcon } from "@/features/app-shell/app-icon";

export const dynamic = "force-static";

export function GET() {
  return appIcon(192);
}

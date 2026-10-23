import { permanentRedirect } from "next/navigation";
import { bodyHref } from "@/features/progress/health";

export default function ProgressRecoveryRedirect() {
  permanentRedirect(bodyHref());
}

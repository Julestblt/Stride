import { notFound } from "next/navigation";
import { onboardingEnabled } from "@/server/onboarding/environment";
export const dynamic = "force-dynamic";
export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!onboardingEnabled()) notFound();
  return children;
}

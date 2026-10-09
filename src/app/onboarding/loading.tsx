import { Skeleton } from "@/components/ui/skeleton";
export default function OnboardingLoading() {
  return (
    <main
      lang="fr"
      aria-busy="true"
      aria-label="Chargement de ton parcours"
      className="flex min-h-svh gap-6 p-5"
    >
      <Skeleton className="hidden w-56 lg:block" />
      <div className="flex flex-1 flex-col gap-6">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-11 w-full max-w-160" />
      </div>
    </main>
  );
}

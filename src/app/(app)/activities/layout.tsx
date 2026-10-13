import { ActivityListSnapshotProvider } from "@/features/activities/components/activity-list-snapshot";

export default function ActivitiesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ActivityListSnapshotProvider>{children}</ActivityListSnapshotProvider>
  );
}

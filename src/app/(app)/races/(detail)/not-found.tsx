import {
  RouteNotFound,
  RouteStateFrame,
} from "@/features/app-shell/components/route-state";

export default function RaceNotFound() {
  return (
    <RouteStateFrame section="Courses">
      <RouteNotFound item="race" />
    </RouteStateFrame>
  );
}

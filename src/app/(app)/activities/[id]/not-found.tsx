import {
  RouteNotFound,
  RouteStateFrame,
} from "@/features/app-shell/components/route-state";

export default function ActivityNotFound() {
  return (
    <RouteStateFrame section="Activités">
      <RouteNotFound item="activity" />
    </RouteStateFrame>
  );
}

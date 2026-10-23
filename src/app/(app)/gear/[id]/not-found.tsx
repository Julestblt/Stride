import {
  RouteNotFound,
  RouteStateFrame,
} from "@/features/app-shell/components/route-state";

export default function PairNotFound() {
  return (
    <RouteStateFrame section="Matériel">
      <RouteNotFound item="pair" />
    </RouteStateFrame>
  );
}

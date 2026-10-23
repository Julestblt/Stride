import {
  RouteNotFound,
  RouteStateFrame,
} from "@/features/app-shell/components/route-state";

export default function ConversationNotFound() {
  return (
    <RouteStateFrame section="Coach">
      <RouteNotFound item="conversation" />
    </RouteStateFrame>
  );
}

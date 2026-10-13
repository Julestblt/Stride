import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HeartRateEditor } from "@/features/settings/components/heart-rate-editor";
import { calculateHeartRateZones } from "@/features/onboarding/heart-rate-zones";

const today = new Date("2026-10-13T12:00:00Z");
function render(zones: ReturnType<typeof calculateHeartRateZones>) {
  return renderToStaticMarkup(
    createElement(HeartRateEditor, {
      kind: "threshold",
      value: 172,
      source: "known",
      zones,
      onApply: () => {},
      onCancel: () => {},
      onRevert: () => {},
    }),
  );
}
describe("threshold editor zone explanation", () => {
  it("describes maximum percentages when resting calibration is absent", () => {
    expect(
      render(
        calculateHeartRateZones({ maximum: 185, observations: [], today }),
      ),
    ).toContain(
      "Les zones utilisent des pourcentages de ta FC max, sans FC au repos.",
    );
  });
  it("describes maximum and resting inputs for Karvonen calibration", () => {
    const observations = Array.from({ length: 7 }, (_, index) => ({
      metric: "resting_heart_rate_bpm",
      value: 50,
      observedOn: `2026-10-${String(index + 1).padStart(2, "0")}`,
    }));
    expect(
      render(calculateHeartRateZones({ maximum: 185, observations, today })),
    ).toContain("Les zones utilisent ta FC max et ta FC au repos.");
  });
  it("reports unavailable zones without claiming calculation inputs", () => {
    expect(render(null)).toContain(
      "Les zones sont indisponibles faute de données suffisantes.",
    );
  });
});

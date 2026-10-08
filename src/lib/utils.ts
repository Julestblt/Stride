import { createCn } from "cn/config";

export const cn = createCn({
  extend: {
    theme: {
      text: [
        "nano",
        "micro",
        "label",
        "meta",
        "body",
        "lead",
        "title",
        "headline",
        "display",
        "metric-sm",
        "metric",
        "metric-lg",
        "metric-hero",
      ],
      radius: ["mark", "tag", "control", "surface", "card", "panel"],
    },
  },
});

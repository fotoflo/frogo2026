"use client";

// @ts-expect-error -- no published types for @analytics/mixpanel
import mixpanelPlugin from "@analytics/mixpanel";
import Analytics from "analytics";

const analytics = Analytics({
  app: "frogo-tv",
  plugins: [
    mixpanelPlugin({
      token: "100718",
    }),
  ],
});

export default analytics;

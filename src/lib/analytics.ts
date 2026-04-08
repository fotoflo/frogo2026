"use client";

// @ts-expect-error -- no published types for @analytics/mixpanel
import mixpanelPlugin from "@analytics/mixpanel";
// @ts-expect-error -- no published types for @analytics/google-analytics
import googleAnalytics from "@analytics/google-analytics";
import Analytics from "analytics";

const analytics = Analytics({
  app: "frogo-tv",
  plugins: [
    mixpanelPlugin({
      token: "100718",
    }),
    googleAnalytics({
      measurementIds: ["G-RG302NZGNF"],
    }),
  ],
});

export default analytics;

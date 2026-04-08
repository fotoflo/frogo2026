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
      token: "a6cf6baae65e0c61baff6f1494c33d2a",
      options: {
        autocapture: true,
        record_sessions_percent: 100,
      },
    }),
    googleAnalytics({
      measurementIds: ["G-RG302NZGNF"],
    }),
  ],
});

export default analytics;

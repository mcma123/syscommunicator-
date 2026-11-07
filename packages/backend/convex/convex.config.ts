import rateLimiter from "@convex-dev/rate-limiter/convex.config.js";
import workpool from "@convex-dev/workpool/convex.config.js";
import aggregate from "@convex-dev/aggregate/convex.config";
import { defineApp } from "convex/server";
import { v } from "convex/values";

const app = defineApp({
  env: {
    EXPO_PROJECT_ID: v.optional(v.string()),
    EXPO_PUSH_ACCESS_TOKEN: v.optional(v.string()),
    NOTIFICATION_DELIVERY_ENABLED: v.optional(v.string()),
    SITE_URL: v.optional(v.string()),
    RESEND_API_KEY: v.optional(v.string()),
    AUTH_EMAIL_FROM: v.optional(v.string()),
    ENABLE_DEMO_ACCOUNTS: v.optional(v.string()),
    DEV_AUTH_PASSWORD_PARENT: v.optional(v.string()),
    DEV_AUTH_PASSWORD_TEACHER: v.optional(v.string()),
    DEV_AUTH_PASSWORD_PRINCIPAL: v.optional(v.string()),
    DEV_AUTH_PASSWORD_FINANCE: v.optional(v.string()),
    DEV_AUTH_PASSWORD_ADMIN: v.optional(v.string()),
  },
});

app.use(rateLimiter, { name: "notificationRateLimiter" });
app.use(workpool, { name: "notificationEmailWorkpool" });
app.use(workpool, { name: "notificationWorkpool" });
app.use(aggregate, { name: "dashboardAggregate" });
export default app;

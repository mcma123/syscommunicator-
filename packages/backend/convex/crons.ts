import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";
const crons = cronJobs();
crons.interval(
  "expire file grants and reclaim owned orphan files",
  { hours: 1 },
  internal.files.cleanup,
  {},
);
crons.interval("reclaim abandoned staging uploads", { hours: 1 }, internal.files.sweepUploads, {
  cursor: null,
});
crons.interval("reclaim removed Ad Center media", { hours: 1 }, internal.ads.cleanupMedia, {});
crons.interval(
  "advertiser follow-up emails",
  { minutes: 30 },
  internal.advertiserEmail.sendDue,
  {},
);
crons.daily(
  "refresh public reach figures",
  { hourUTC: 1, minuteUTC: 0 },
  internal.advertisers.refreshReach,
  {},
);
crons.monthly(
  "monthly advertiser reports",
  { day: 1, hourUTC: 6, minuteUTC: 0 },
  internal.advertiserEmail.monthlyReports,
  {},
);
crons.interval("consent reminders", { hours: 1 }, internal.notificationJobs.consentReminders, {});
crons.interval("expire invitations", { hours: 1 }, internal.notificationJobs.expireInvitations, {});
crons.interval(
  "confirm notification delivery",
  { minutes: 15 },
  internal.notificationJobs.pollDue,
  {},
);
export default crons;

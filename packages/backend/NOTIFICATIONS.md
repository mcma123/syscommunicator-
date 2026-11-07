# Notifications and scheduled jobs

## Delivery boundary

`workflows.receipts` creates the existing in-app notice receipt and queues one push delivery per registered device; urgent notices also queue an email. Keys deduplicate each source revision, recipient, channel and device. Hourly consent jobs queue one reminder per outstanding family/request deadline/device during the last 24 hours before the deadline. A response for every eligible linked learner prevents the reminder, including when answered after enqueueing.

`notificationJobs.ts` owns dispatch, provider actions, completion, receipt checks, consent fanout and invitation expiry. `lib/notificationQueue.ts` uses separate `@convex-dev/workpool` pools: push parallelism two and email parallelism one. `notificationEmail.ts` runs paced email I/O in Node; `@convex-dev/rate-limiter` reserves one Resend API request per second across sends and status lookups. Reservations occur when work starts, and access/preferences are rechecked after waiting. Slow email delivery cannot hold the push queue. Resend sends retry at most three times with a stable idempotency key and exponential backoff. Push sends have no automatic retry: a network failure can have an unknown outcome. Authorized notice owners/whole-school staff can explicitly retry Failed/Blocked rows; the UI warns that a push may already have arrived. Neither Accepted nor confirmed rows are retried.

Every dispatch and send attempt rechecks the current recipient, active account, module flag, guardian/audience relationship, publication revision or consent deadline/response, channel preference, muted category and Johannesburg quiet hours. Urgent notices respect quiet hours too. Overnight and daytime quiet windows defer to their end; equal endpoints mean no quiet interval. Sign-in verification/reset and school invitations remain transactional messages in `authEmail.ts`/`onboarding.ts`, independent of announcement opt-outs and quiet hours. Payment reminders and receipt emails remain deferred to Phase 9; the daily digest is optional and unimplemented.

Push and announcement email text is generic. It contains no learner name, notice body or private document URL. Tapping push uses a fixed notice/form route; the destination independently authorizes access. Already accepted external messages cannot be recalled, and a provider confirmation is not proof that a notification appeared on a screen.

## Device and session ownership

`notifications.registerDevice` derives the caller and Convex Auth session. It accepts Expo-format tokens only for the deployment's configured EAS project, with a maximum of ten device records per user. A token moving between accounts is transferred atomically. Tokens, session IDs, provider IDs and email addresses never appear in the public delivery history.

Each device is bound to a live session. Sending rejects missing/expired/revoked sessions and sessions older than the account's cutoff. Normal native sign-out attempts to unregister the current session's devices before sign-out; server revocation independently blocks subsequent sends. Expo DeviceNotRegistered responses remove the matching user's registration.

The native bridge registers after active sign-in/restoration, refreshes on reconnection/app foreground and token changes, and consumes notification responses. Token-change callbacks pass the native token to Expo rather than recursively fetching it. Effects cancel stale work during account changes. Expo web has a separate no-op bridge. Physical devices and a compatible installed development/native build are required for remote push; Expo Go is retained for other app previews. Profile shows registration status, retry and phone settings controls. App version 1.0.3 includes the new native module/configuration and requires a new compatible binary; EAS builds are not started automatically.

## Honest status and reporting

States are Pending, Deferred, Sending, Accepted, Delivered, Failed, Blocked and Skipped. The UI labels Delivered as **Provider confirmed**:

- Push Accepted means Expo returned a ticket. Confirmation requires its receipt to report successful handoff to Apple/Google.
- Email Accepted means Resend returned an ID. Confirmation requires the authenticated Retrieve Email API to report delivered/opened/clicked; bounced/failed/complained/suppressed/canceled are failures.
- Receipt checks run every 15 minutes in bounded batches. After 24 hours without confirmation, status is Failed with delivery explicitly unknown. A Resend key needs retrieve/read permission as well as send permission for these checks.
- `noticeReceipts.deliveredAt` retains its legacy meaning of **available in app**. `notificationDeliveredAt` is set only after provider confirmation. Read and acknowledgement timestamps remain separate user interactions.

Staff notice details and each user's profile show paginated delivery history through client-store adapters and a shared hook. History/retry functions enforce current notice-author/class or whole-school scope. A teacher who is also a guardian loses staff receipt/delivery access when her class assignment is removed, even while parent notice reads remain valid; personal history is indexed by the server-derived user. Provider state and internal device cleanup are infrastructure projections and do not create business audit entries. Public registration, removal and retry requests audit atomically.

## Configuration and activation

Set these **Convex deployment** variables, never client secrets:

| Variable | Purpose |
| --- | --- |
| EXPO_PROJECT_ID | Must match app.json's public EAS project ID: `6cd3c02c-5a24-4596-84b0-7048bf2c7ea8` |
| NOTIFICATION_DELIVERY_ENABLED | `true` enables school notification transport; missing/other values block it honestly |
| RESEND_API_KEY | Resend send and retrieve access |
| AUTH_EMAIL_FROM | A sender on the school's verified Resend domain |
| SITE_URL | Reachable HTTPS address for school content links; authentication retains its existing return-origin rules |
| EXPO_PUSH_ACCESS_TOKEN | Optional dedicated Expo push-service token when push security is enabled |

Never reuse the root EAS account `EXPO_TOKEN` as a push token or put it in app config. Configure Android FCM/iOS APNs credentials through EAS, create/install a compatible build, sign in on a real device and grant notification permission. Publishing a scoped QA notice must then be verified on that device. Configure Resend's verified sender and confirm receipt in an actual school-controlled mailbox. Fictional `.example` email addresses are explicitly blocked from school notification sends.

Use the deployment dashboard for private values. Do not paste API keys into chat, commit them, print environment values or pass them as process arguments. Development/production target guard rules still apply. No production activation is part of this phase.

## Scheduled work and verification

Notice publication continues to use revision-checked `ctx.scheduler.runAt`, rechecking active Principal/Administrator authority and the module flag. Consent reminders and pending invitation expiry run hourly with bounded pages/continuations and deduplication. Expired invitations retain their metadata/audit history with status Expired. Phase 8's owned-file cleanup remains hourly. Cron jobs target internal functions only.

`notifications.test.ts` covers ownership, mixed teacher/guardian scope loss, account transfer, project validation, fanout/deduplication, preference/quiet-hour and membership/session changes, safe payloads, real component execution with mocked providers, email retry idempotency, ticket/receipt separation, provider failures/device removal, consent responses and invitation expiry. Frontend tests verify honest Accepted labels and confirmed retry behavior. Run both suites, all TypeScript checks, Expo doctor/export/lint and the web build. Mocked providers and exports do not establish live email or physical phone delivery; keep the phase exit criterion pending until those checks succeed.

Implementation references: [Expo notification setup](https://docs.expo.dev/push-notifications/push-notifications-setup/), [Expo sending and receipts](https://docs.expo.dev/push-notifications/sending-notifications/), [Expo SDK API](https://docs.expo.dev/versions/latest/sdk/notifications/), [Resend delivery lookup](https://resend.com/guides/email/users-never-got-login-code), and the installed Workpool 0.4.15 and Rate Limiter 0.4.3 README/types. Expo native versions follow this repository's SDK 57 bundled module manifest, rather than the latest SDK documentation's installation versions.

# School write workflows

## Contract
Both clients use server-described School actions through their owning stores. `workflowForms.forms` supplies available commands and initial values; `workflows.submit` independently authenticates and validates all inputs, target IDs, document scope and current state. Unknown value keys are rejected. The client cannot set caller identity, authors, audit actors or timestamps. Every successful school mutation audits atomically; rejected writes roll back.

| Journey | Authority and resulting state |
| --- | --- |
| Notices | Teachers create/edit own Drafts for assigned classes and submit Review. Principal/Administrator approve immediate publication or future Johannesburg scheduling, return Review/Scheduled to Draft, or archive Published notices. Published content is immutable through draft editing. |
| Receipt fanout | Internal jobs validate publication revision and process 25 users per batch. Only active eligible guardians get a receipt; duplicates preserve read/acknowledgement. Staff details paginate actual recipient states. In-app availability is not a push/email delivery claim. |
| Events | Academic staff create/edit/cancel scoped events. Teachers must own the event and retain its class scope. End follows start; all-day events use midnight and an exclusive end. |
| Consent | Academic staff create future-due requests. Only the active linked guardian of an audience-eligible learner responds before expiry while Open. Decision/phone/notes are validated; guardian and time are server-derived. A different guardian cannot overwrite an existing response. |
| Enquiries | Users create own threads, optionally linked to their own learner. Principal/Administrator assign department/responsible staff. Only the creator, assigned teacher or whole-school staff read/reply; internal notes stay staff-only. Responsible staff resolve/reopen; families cannot assign or resolve. |
| Attendance | Assigned teachers/whole-school staff upsert one register per class/day and one mark per register/learner. No future dates or foreign-class learners. Submission requires every active learner marked. Corrections to Submitted registers require a reason and audit previous/next values. Classes are bounded to 100 active learners for this workflow. |
| Conduct | Academic staff create scoped Merit/Demerit/Note entries; guardian visibility is explicit. A guardian/teacher combination does not grant staff rights outside assigned classes. |
| Reports | Authorized academic staff upload a PDF (10 MiB maximum) as Draft. Principal/Administrator review then release. Current authorized staff can retrieve drafts; linked guardians can retrieve Released reports only. Old sample text fixtures are not downloadable PDFs. |
| People | Administrator-only invitations, invitation revocation/history, role changes, teaching-class grants/revocation and deactivation/reactivation. Another Administrator must change the caller's own access. Reactivation does not revive old sessions. Invitations retain existing verified-email/single-use/expiry policy. |
| Settings | Administrator-only school profile/term/contact fields and supported module flags. Changes persist and affect actual module access/navigation, including related reads. |
| Profile | Current user only: name/contact phone, push/email preferences, muted categories and paired valid quiet-hour values. Sign-in email, staff roles and learner links are not self-editable. |

## Scheduling and files
Scheduled notices store a revision and initiating publisher. Internal publication rechecks current Principal/Administrator authority; cancelled/stale schedules cannot publish. Receipt continuation follows an authorized Published revision and resolves current recipient membership; later loss of publisher access does not drop delivery batches.

The legacy report upload/download API uses authenticated 512 KiB byte actions without exposing permanent storage URLs. The action validates size/PDF signature, checks staff scope before storing, independently rechecks in finalization, and deletes the new file if finalization fails. Retrieval checks current scope/release before reading and again before returning bytes. Web downloads; native document picker/file sharing needs a compatible binary and device validation. A server-computed learner/title/term/content digest makes new uploads retry-safe for the current uploader; concurrent finalization reuses one report and deletes the spare file. Existing report records are preserved. Current clients use the Phase 8 upload reservations, protected links, notice/resource attachments and receipt PDFs defined in [FILES.md](FILES.md); hourly jobs reclaim positively identified orphan uploads.

## Client behavior and limits
Sensitive operations require an explicit confirmation. Offline/pending buttons are disabled; drafts survive a failed submit and success is shown only after resolution. There is no offline write queue. Pickers show bounded choices (up to 100 school records); learner profiles expose targeted conduct/report creation beyond the initial picker. Register submission fails closed above the documented class limit.

Invitation issuance is implemented on both clients, but live email still requires deployment RESEND_API_KEY, a verified AUTH_EMAIL_FROM and reachable SITE_URL. Missing configuration disables invitation submission and never claims a send. Notification preferences govern the Phase 10 queue, including muted categories and Johannesburg quiet hours. Device registration, delivery/receipt reporting and activation requirements are defined in NOTIFICATIONS.md. Payment states cannot be changed by these commands.

## Verification
Isolated backend tests cover transitions, scheduling/cancellation, receipt deduplication and multi-batch audience isolation, input/spoof rejection, deadlines, assigned replies/internal notes, complete registers/corrections, conduct privacy, report review/release/file access, role/class changes, deactivation/old-session rejection, sanitized invitations/revocation and feature flags/preferences. Frontend tests cover confirmation, pending state, server errors and retained drafts. Run all suites/type checks, web build, Expo doctor/export/lint and browser journeys after changes.

Verified development evidence: 34 frontend + 59 backend + 3 CLI tests pass; all TypeScript checks, web build, Expo exports/lint and doctor pass. Browser checks cover Expo-created enquiries with live web replies/status/reload, reviewed notice publication and guardian PDF retrieval after release. Real dev HTTP sessions confirm concurrent/sequential upload deduplication. This is development/browser verification, not live email or physical-device acceptance.

## Ad Center
- Server forms: `adSave` (headline ≤80, caption ≤500, optional https link and ≤40-character button label, Johannesburg start/end within one year, audience, popup) plus `adSubmit` (Teacher Draft → Review; needs at least one picture/video), `adPublish` (Principal/Administrator; Draft/Review → Published; needs media and a future end), `adReturn` (Review/Published → Draft with optional note) and `adArchive`. Both clients render `adSave` inside the Ad Center composer and hide it from the generic action panel.
- Media is not a workflow form: the composer uploads through `ads.prepareUpload`/`finishUpload` and manages items with `ads.removeMedia`/`moveMedia` (FILES.md). Links must be `https:` URLs without credentials. Teacher edits are allowed only on Draft; whole-school staff may also edit an ad in Review.

## Advertising
- Parent clients call `adStats.track` (banner, popup, click) fire-and-forget; the client also skips repeats within a page session.
- Public enquiries create or update one `advertisers` row per email. With email consent the sequence starts at once (welcome, +3 days, +7 days; copy in `advertiserEmail.sequenceEmail`, offer text in `@school-connect/core/advertising`). Sends run from `advertiserEmail.sendDue` (scheduled after an enquiry and every 30 minutes); without `RESEND_API_KEY`/`AUTH_EMAIL_FROM` an attempt is logged as Skipped and retried hourly.
- `advertiserEmail.monthlyReports` (1st of the month) emails each Active advertiser with consent last month's views, popup views, clicks and parent visits for its linked ads.

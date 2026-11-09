# Files and document storage

## Upload contract
Both client stores delegate file workflows to the shared React hook. `files.beginUpload` authenticates the current session, validates the staff/class/document scope and issues a one-hour Convex upload URL plus a session-owned reservation. The client POSTs the bytes, registers the returned staging ID with `claimUpload`, then calls `finishUpload`. Registration verifies creation time, metadata and SHA-256; the action verifies the bytes and file signature. Finalization independently rechecks the session and current write scope in a mutation, stores canonical metadata, registers ownership and audits atomically. A server-created copy separates staging from canonical storage. Final storage IDs and permanent storage URLs are not returned to clients.

- Reports: PDF, up to 10 MiB; authorized academic staff create Draft records. Principal/Administrator review and release. The uploader/learner/title/term/content digest preserves retry deduplication across reservations and the legacy byte API.
- Notice attachments: PDF up to 10 MiB; PNG/JPEG up to 5 MiB; at most ten per Draft. Only the current draft author with academic/class scope or whole-school staff can add/remove. Published content stays immutable.
- Resources: the same PDF/image limits. Academic staff upload scoped Drafts; Principal/Administrator publish/archive. Staff workflow filters expose authorized private records.
- File names must match the declared type, have at most 150 characters and contain no control characters or path separators. Metadata and signatures are checked server-side. This is type validation, not malware scanning.

`workflows.uploadReport/reportFile` remain compatibility endpoints with the original 512 KiB byte limit. Current clients use the URL workflow. Fixture text files remain labelled fictional samples; they are not converted to school PDFs.

## Protected downloads
`files.prepareDownload` creates a cryptographically random 256-bit bearer token, retaining only its SHA-256 hash. Grants bind the current user/session, canonical target, storage snapshot and two-minute expiry. `files.downloadUrl` is authenticated and repeats scope checks before returning a gateway URL and safe file metadata.

`GET /files/download` streams the file rather than redirecting to permanent storage. It rechecks token expiry, live session expiry/revocation/cutoff, active account, current module flags, roles and guardian/class/audience/publication scope before reading and again before responding. A changed storage snapshot or attachment position invalidates the grant. Responses use no-store, attachment disposition, nosniff and no-referrer. A link is a short-lived bearer capability; never log or persist it. Already downloaded copies cannot be revoked.

Authorized staff can read report drafts within their current class/school scope. Guardians need an active link to the learner and Released status. Finance alone has no academic file access. Receipt access is limited to the receipt's still-linked guardian or Principal/Administrator/Finance. Resource and notice downloads retain their module audience rules. Legacy notice/resource queries return file metadata without storage IDs.

## Receipt PDFs
`receiptFiles.generate` requires an existing receipt and matching Succeeded payment (charge, payer and amount), derives all amounts and references from stored records, and never creates a payment or marks a charge paid. Concurrent generation attaches one PDF and deletes spare blobs. PDFs embed the supplied crest and licensed Open Sans, with school red and Johannesburg dates. `scripts/prepare-receipt-assets.mjs` reproducibly embeds the existing crest and pinned installed Open Sans fonts into `convex/receiptAssets.ts`; the font license and source hashes accompany the generated module. `lib/receiptPdf.ts` owns layout. Provider payment confirmation remains Phase 9.

## Scheduled cleanup
Hourly internal jobs work in bounded batches with continuations:

- Delete expired download grants (100 at a time).
- Reclaim registered staging files and reservations after expiry plus three days (25 at a time).
- Scan storage in pages of 25 for lost upload responses: delete only objects older than 24 hours whose size/type/digest and creation window match retained expired upload reservations. Skip all managed canonical objects, unknown objects and ambiguous matches above 100 reservations. This deliberately preserves storage without positive upload provenance.
- Delete explicitly detached notice files after 24 hours, checking the complete bounded attachment array first. Archives retain their attached files. Active storage, unrelated assets and seed-owned samples are preserved.

Grants and internal storage maintenance are infrastructure records, not school submissions; they do not create business audit entries. Upload reservations/claims, attachment saves/removals, publication and generated receipt metadata do audit. No production cleanup is provisioned. The existing explicit dev reset still deletes only seed-owned storage; detached non-seed storage is owned by these jobs.

## Clients and verification
Web fetches protected links into Blob downloads. Expo uses `expo-file-system` to download into cache and `expo-sharing` to open/share, then removes the temporary file. Picker and sharing still require a compatible native binary and physical Android/iOS acceptance.

`convex/files.test.ts` covers uploads above the old cap, scope/type/size/signature/digest denials, release, expired/revoked grants, guardian changes, resource publication, removed attachments, receipt validation and concurrent finalization and conservative cleanup. Run the backend and frontend suites, all TypeScript checks, web build and Expo doctor/export/lint. Isolated receipt fixtures are not evidence of a live payment provider.

Development verification also covers the real Convex upload POST/streaming-blob path, PDF release/download, resource archive, attachment removal, session sign-out revocation and cross-client web-upload/Expo-web-download. A rendered receipt sample has been visually checked. These checks do not establish live payment-provider delivery or physical native sharing.

## Ad Center media (Cloudflare R2)
- Ad pictures and videos live in the private Cloudflare R2 bucket configured by deployment-only env vars `R2_ENDPOINT`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` (`lib/r2.ts`, SigV4 via `aws4fetch`). Nothing about the bucket or its keys reaches clients; missing configuration fails with "Media storage is not configured".
- Upload: `ads.prepareUpload` (action) validates `adEditor` scope, Draft/Review state, type/size (PNG/JPEG/WebP ≤ 10 MiB; MP4/WebM/MOV ≤ 50 MiB) and the 10-item limit, reserves a session-owned `adMedia` row (15-minute expiry) and returns a presigned **PUT** bound to the declared Content-Type. The browser/app uploads directly to R2. `ads.finishUpload` rechecks owner/session/expiry, HEADs the object (size and type must match), reads the first 16 bytes for the file signature, then marks it Ready, bumps the ad revision and audits `file.attached`; any mismatch deletes the object and the reservation.
- Delivery: clients only ever receive **signed gateway links** `/media/ad?m&r&s&sig` (HMAC-SHA256 with `AD_MEDIA_SIGNING_KEY` over media ID, ad revision and scope). The HTTP route rechecks the media and ad on every request: scope `p` (parents) needs a Published ad inside its schedule with the module enabled; scope `e` (editors) allows drafts. Valid requests get a 302 to a one-hour presigned R2 GET (`Cache-Control: private, max-age=600`); R2 serves byte ranges, so video seeking works. Editing, returning, archiving or removing media revokes old links immediately (revision/state no longer match). Bad signatures → 403; unknown, detached or not-visible → 404.
- Cleanup: removed media is detached; the hourly `ads.cleanupMedia` action deletes R2 objects detached for over a day and abandoned reservations (25 per run, rescheduling while full).
- The previous Convex-storage ad upload kind is closed ("upload through the Ad Center composer"); a few early dev test ads keep their single Convex-stored file for display only.

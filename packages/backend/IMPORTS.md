# Roster import contracts (Phase 11)

Administrators load the school's classes, learners, guardians and staff from CSV files. The import is
built and tested against isolated test databases; no real school data has been imported.

## Templates

Templates come from `IMPORT_TEMPLATES` in `@school-connect/core/imports` and are downloadable from
web **People → Import roster**. Headers must match exactly (any order, case-insensitive).

| Kind | Columns (required in bold) | Natural key |
| --- | --- | --- |
| classes | **grade**, **class_name**, **year** | year + class name |
| learners | **learner_number**, **first_name**, **last_name**, preferred_name, date_of_birth (YYYY-MM-DD), **grade**, **class_name**, **year** | learner number (upper-cased) |
| guardians | **learner_number**, **email**, **first_name**, **last_name**, phone, **relationship**, primary_contact (yes/no) | email + learner number |
| staff | **email**, **first_name**, **last_name**, phone, **roles** (`;`-separated), class_names (`;`-separated), year | email |

Import in order: classes → learners → guardians/staff. Missing grades are created by the classes import, up to 50 grades in total; grade names match case-insensitively.

## Rules

- Files: at most 1 MB on web and 2,000 data rows; cells at most 120 characters; RFC 4180 quoting.
- Free-text cells may not start with `=`, `+`, `-` or `@` (spreadsheet formula injection on later export).
- In-file duplicates of a natural key are rejected (the first occurrence wins); rows are reported by
  spreadsheet row number (blank rows are skipped without renumbering) with field-level messages.
- `imports.preview` (query) and `imports.commit` (mutation) take at most 50 rows each, re-validate every
  row with the same school-core function and report `create`, `update`, `unchanged` or `rejected`.
  Preview writes nothing. Commit writes accepted rows, audits every write and updates the batch counters
  in the same transaction; rejected rows write nothing. A commit that sends more rows than the batch
  declared rolls back.
- Re-importing the same file is idempotent. Blank optional cells (including `primary_contact` and `class_names`) never erase stored values; new guardian contacts default to not primary and new staff contacts to no classes. Existing
  learners keep their status; a class that already exists under another grade is rejected.
- `importBatches` records each upload (Open → Completed via `imports.complete`, which refuses until every declared row has been processed). `imports.batches` lists the
  20 most recent. All four endpoints require an active Administrator with the People module enabled.

## Staged contacts — no access is granted

Guardian and staff rows are stored only as `rosterContacts`. Importing never creates `users`, `staffRoles`,
`guardianLinks`, `teachingAssignments` or invitations, and sends no email. Sign-in linking in
`authPolicy.ts` reads only `users` and pending invitations, so a staged contact cannot sign in or see
learners. Guardians already linked to that learner, and existing staff accounts, are reported as
`unchanged` and managed in People.

Activating staged contacts (turning them into invitations/accounts) is deliberately not built: it waits
for the school's POPIA consent and privacy-notice decision (root `Backend-and-Database-Integration.md`,
Phase 11). Production import also waits for a preview-deployment rehearsal and school sign-off.

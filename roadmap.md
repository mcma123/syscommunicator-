# School Connect frontend
- [ ] Research d6 design and modules; document verified references.
- [ ] Establish configurable design tokens and shared typed mock services.
- [ ] Build matching parent and staff modules for desktop and mobile web.
- [ ] Make notice, consent, simulated payment, publishing, and enquiry journeys functional.
- [ ] Document shared-backend adapter boundaries and module inventory.
- [ ] Verify core journeys and mobile layout.

# Backend and database
- Next: Phase 10 notifications. Defer Phase 9 payments until the other feature work is complete; finish payment-dependent checks before final launch.
- [ ] Follow the phased checklist in [Backend-and-Database-Integration.md](Backend-and-Database-Integration.md).
- Phase 2 adds guarded development seeding/reset and isolated backend CI tests. Cloud preview CI remains deferred; Phase 3 introduces authentication.

- Phase 3 connects Convex Auth, web/Expo identity and guarded dev accounts. Live email invitation/recovery validation awaits Resend configuration; Phase 4 adds shared permissions, scoped server reads, audit enforcement and negative authorization tests. Phase 5 delivers shared live module hooks and cross-client receipts. Phase 6 delivers paginated module reads, independent detail/history, dashboard counts, calendar export and staff reads in both clients. Phase 7 delivers audited school write workflows and report PDF release on both clients. Phase 8 delivers notice/resource/report uploads, protected temporary downloads, verified-payment receipt PDFs and conservative scheduled orphan cleanup; provider payments remain Phase 9.

- Phase 10 implements notification registration, delivery, reminders and reporting; verified email/native phone activation is tracked separately in the integration checklist. Payment-dependent work remains deferred to Phase 9.

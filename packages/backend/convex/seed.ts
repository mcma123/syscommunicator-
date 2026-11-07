import { invalidateDashboard } from "./lib/dashboardState";
import { dashboardAggregate } from "./lib/dashboardAggregate";
import {
  children,
  initialState,
  schoolConfig,
  type NoticeCategory,
  type ResourceCategory,
  type StaffRole,
} from "@school-connect/core";
import { v } from "convex/values";
import { internalMutation, internalQuery, type MutationCtx } from "./_generated/server";
import type { Doc, Id, TableNames } from "./_generated/dataModel";
import { attachment } from "./validators";
import {
  checkSchool,
  ensure,
  FIXTURE_DATE,
  fixture,
  inventory,
  MAX_ROWS,
  requireSeedDeployment,
  single,
  TABLES,
} from "./seedSupport";

const countsValidator = v.record(v.string(), v.number());
const profiles: { key: string; name: string; role?: StaffRole }[] = [
  { key: "parent", name: "Jamie Williams" },
  { key: "teacher", name: "Sarah Jacobs", role: "Teacher" },
  { key: "principal", name: "Amelia Davids", role: "Principal" },
  { key: "finance", name: "Nadia Petersen", role: "Finance" },
  { key: "admin", name: "Alex Morgan", role: "Administrator" },
];

export const preflight = internalQuery({
  args: {},
  returns: countsValidator,
  handler: async (ctx) => {
    requireSeedDeployment();
    await checkSchool(ctx);
    return inventory(ctx);
  },
});

export const files = internalQuery({
  args: {},
  returns: v.array(v.object({ key: v.string(), file: attachment })),
  handler: async (ctx) => {
    requireSeedDeployment();
    const records = await ctx.db
      .query("seedFixtures")
      .withIndex("by_key")
      .take(MAX_ROWS + 1);
    if (records.length > MAX_ROWS) throw new Error("Too many fixture records.");
    const files: { key: string; file: Doc<"resources">["file"] }[] = [];
    for (const record of records) {
      if (
        record.target.kind === "file" &&
        (await ctx.db.system.get("_storage", record.target.file.storageId))
      ) {
        files.push({ key: record.key, file: record.target.file });
      }
    }
    return files;
  },
});

export const claimFile = internalMutation({
  args: { key: v.string(), file: attachment },
  returns: attachment,
  handler: async (ctx, args) => {
    requireSeedDeployment();
    if (!args.key.startsWith("file:")) throw new Error("Invalid fixture file key.");
    const metadata = await ctx.db.system.get("_storage", args.file.storageId);
    if (
      !metadata ||
      metadata.size !== args.file.size ||
      metadata.contentType !== args.file.contentType
    )
      throw new Error("Invalid sample storage metadata.");
    const existing = await fixture(ctx, args.key);
    if (existing) {
      if (existing.target.kind !== "file") throw new Error("Conflicting fixture file key.");
      if (await ctx.db.system.get("_storage", existing.target.file.storageId))
        return existing.target.file;
      await ctx.db.delete("seedFixtures", existing._id);
    }
    await ctx.db.insert("seedFixtures", {
      key: args.key,
      target: { kind: "file", file: args.file },
    });
    return args.file;
  },
});

async function sampleFile(ctx: MutationCtx, key: string) {
  const record = await fixture(ctx, `file:${key}`);
  if (
    !record ||
    record.target.kind !== "file" ||
    !(await ctx.db.system.get("_storage", record.target.file.storageId))
  ) {
    throw new Error(`Missing sample file ${key}; run seedFiles:run.`);
  }
  return record.target.file;
}

export const run = internalMutation({
  args: {},
  returns: countsValidator,
  handler: async (ctx) => {
    requireSeedDeployment();
    const school = await checkSchool(ctx);
    await inventory(ctx);
    await ensure(
      ctx,
      "schools",
      "school",
      {
        name: schoolConfig.name,
        appName: schoolConfig.appName,
        shortName: schoolConfig.shortName,
        tagline: schoolConfig.subtitle,
        websiteUrl: schoolConfig.websiteUrl,
        clothingStoreUrl: schoolConfig.clothingStoreUrl,
        timezone: schoolConfig.timezone,
        currency: schoolConfig.currency,
        currentTerm: schoolConfig.term,
        featureFlags: {},
        updatedAt: FIXTURE_DATE,
      },
      async () => school,
    );

    const users: Record<string, Id<"users">> = {};
    for (const profile of profiles) {
      const email = `${profile.key}@wgjs.example`;
      const userId = await ensure(
        ctx,
        "users",
        `user:${profile.key}`,
        {
          name: profile.name,
          email,
          status: "Active",
          updatedAt: FIXTURE_DATE,
        },
        () =>
          ctx.db
            .query("users")
            .withIndex("email", (q) => q.eq("email", email))
            .unique(),
      );
      users[profile.key] = userId;
      if (profile.role) {
        const role = profile.role;
        await ensure(ctx, "staffRoles", `role:${profile.key}`, { userId, role }, () =>
          ctx.db
            .query("staffRoles")
            .withIndex("by_userId_and_role", (q) => q.eq("userId", userId).eq("role", role))
            .unique(),
        );
      }
      await ensure(
        ctx,
        "notificationPreferences",
        `preferences:${profile.key}`,
        {
          userId,
          pushEnabled: initialState.notifications,
          emailEnabled: true,
          mutedCategories: [],
        },
        () =>
          ctx.db
            .query("notificationPreferences")
            .withIndex("by_userId", (q) => q.eq("userId", userId))
            .unique(),
      );
    }

    const grades: Record<string, Id<"grades">> = {};
    const classes: Record<string, Id<"classes">> = {};
    const learners: Record<string, Id<"learners">> = {};
    for (const child of children) {
      const sortOrder = Number(child.grade.replace("Grade ", ""));
      const gradeId = await ensure(
        ctx,
        "grades",
        `grade:${sortOrder}`,
        { name: child.grade, sortOrder },
        async () =>
          single(
            await ctx.db
              .query("grades")
              .withIndex("by_sortOrder", (q) => q.eq("sortOrder", sortOrder))
              .take(MAX_ROWS + 1),
            (row) => row.name === child.grade,
          ),
      );
      grades[child.grade] = gradeId;
      const staffId = child.id === "emma" ? users.teacher : users.admin;
      const classId = await ensure(
        ctx,
        "classes",
        `class:${child.className}`,
        { gradeId, name: child.className, year: 2026, homeroomTeacherId: staffId },
        () =>
          ctx.db
            .query("classes")
            .withIndex("by_year_and_name", (q) => q.eq("year", 2026).eq("name", child.className))
            .unique(),
      );
      classes[child.className] = classId;
      await ensure(
        ctx,
        "timetablePeriods",
        `period:${child.className}:monday`,
        {
          classId,
          weekday: 1,
          startMinute: 480,
          endMinute: 520,
          subject: child.id === "emma" ? "Mathematics" : "Reading",
          teacherId: staffId,
        },
        () =>
          ctx.db
            .query("timetablePeriods")
            .withIndex("by_classId_and_weekday_and_startMinute", (q) =>
              q.eq("classId", classId).eq("weekday", 1).eq("startMinute", 480),
            )
            .unique(),
      );
      await ensure(
        ctx,
        "teachingAssignments",
        `assignment:${child.className}`,
        { staffId, classId },
        () =>
          ctx.db
            .query("teachingAssignments")
            .withIndex("by_staffId_and_classId", (q) =>
              q.eq("staffId", staffId).eq("classId", classId),
            )
            .unique(),
      );
      const [firstName, ...lastName] = child.name.split(" ");
      const learnerNumber = `DEMO-${child.id.toUpperCase()}`;
      const learnerId = await ensure(
        ctx,
        "learners",
        `learner:${child.id}`,
        {
          firstName,
          lastName: lastName.join(" "),
          learnerNumber,
          gradeId,
          classId,
          status: "Active",
        },
        () =>
          ctx.db
            .query("learners")
            .withIndex("by_learnerNumber", (q) => q.eq("learnerNumber", learnerNumber))
            .unique(),
      );
      learners[child.name] = learnerId;
      await ensure(
        ctx,
        "guardianLinks",
        `guardian:${child.id}`,
        { guardianId: users.parent, learnerId, relationship: "Guardian", isPrimaryContact: true },
        () =>
          ctx.db
            .query("guardianLinks")
            .withIndex("by_guardianId_and_learnerId", (q) =>
              q.eq("guardianId", users.parent).eq("learnerId", learnerId),
            )
            .unique(),
      );
    }

    const audienceFor = (name: string): Doc<"notices">["audiences"] => {
      if (name === "Whole school") return [{ kind: "School" }];
      const gradeId = grades[name];
      if (!gradeId) throw new Error(`Unknown fixture audience ${name}`);
      return [{ kind: "Grade", gradeId }];
    };
    const events: Record<string, Id<"events">> = {};
    for (const event of initialState.events) {
      const times = event.time.match(/\d{2}:\d{2}/g);
      if (!times || times.length !== 2) throw new Error("Invalid fixture event time.");
      const day = String(event.day).padStart(2, "0");
      const startsAt = Date.parse(`2026-10-${day}T${times[0]}:00+02:00`);
      const endsAt = Date.parse(`2026-10-${day}T${times[1]}:00+02:00`);
      events[event.id] = await ensure(
        ctx,
        "events",
        `event:${event.id}`,
        {
          title: event.title,
          category: event.category as NoticeCategory,
          status: "Scheduled",
          startsAt,
          endsAt,
          allDay: false,
          location: event.location,
          audiences: audienceFor(event.audience),
          createdBy: users.admin,
          updatedAt: FIXTURE_DATE,
        },
        async () =>
          single(
            await ctx.db
              .query("events")
              .withIndex("by_status_and_startsAt", (q) =>
                q.eq("status", "Scheduled").eq("startsAt", startsAt),
              )
              .take(MAX_ROWS + 1),
            (row) => row.title === event.title,
          ),
      );
    }
    const dueAt = Date.parse("2026-10-20T23:59:59+02:00");
    const consentId = await ensure(
      ctx,
      "consentRequests",
      "consent:excursion",
      {
        title: "Grade 4 excursion consent",
        description: "Fictional botanical gardens excursion; permission has not been submitted.",
        status: "Open",
        audiences: audienceFor("Grade 4"),
        eventId: events.trip,
        dueAt,
        createdBy: users.teacher,
      },
      async () =>
        single(
          await ctx.db
            .query("consentRequests")
            .withIndex("by_status_and_dueAt", (q) => q.eq("status", "Open").eq("dueAt", dueAt))
            .take(MAX_ROWS + 1),
          (row) => row.title === "Grade 4 excursion consent",
        ),
    );
    await ensure(
      ctx,
      "charges",
      "charge:excursion",
      {
        learnerId: learners["Emma Williams"],
        title: "Botanical gardens excursion",
        amountCents: 25000,
        status: "Due",
        dueAt,
        consentRequestId: consentId,
        createdBy: users.finance,
        updatedAt: FIXTURE_DATE,
      },
      async () =>
        single(
          await ctx.db
            .query("charges")
            .withIndex("by_learnerId_and_status", (q) =>
              q.eq("learnerId", learners["Emma Williams"]),
            )
            .take(MAX_ROWS + 1),
          (row) => row.title === "Botanical gardens excursion",
        ),
    );

    for (const notice of initialState.notices) {
      const authorId = notice.author === "Ms Sarah Jacobs" ? users.teacher : users.admin;
      const day = notice.date.match(/^\d+/)?.[0];
      const publishedAt = Date.parse(`2026-10-${day}T09:00:00+02:00`);
      const noticeId = await ensure(
        ctx,
        "notices",
        `notice:${notice.id}`,
        {
          title: notice.title,
          body: `${notice.body}\n\nFictional fixture attribution: ${notice.author}.`,
          category: notice.category,
          status: notice.status,
          authorId,
          audiences: audienceFor(notice.audience),
          urgent: !!notice.urgent,
          requiresAcknowledgement: notice.action === "consent",
          consentRequestId: notice.action === "consent" ? consentId : undefined,
          attachments: notice.attachment ? [await sampleFile(ctx, `notice:${notice.id}`)] : [],
          publishedAt: notice.status === "Published" ? publishedAt : undefined,
          updatedAt: FIXTURE_DATE,
        },
        async () =>
          single(
            await ctx.db
              .query("notices")
              .withIndex("by_authorId", (q) => q.eq("authorId", authorId))
              .take(MAX_ROWS + 1),
            (row) => row.title === notice.title,
          ),
      );
      const stored = await ctx.db.get("notices", noticeId);
      if (stored?.status === "Published")
        await ensure(
          ctx,
          "noticeReceipts",
          `noticeReceipt:${notice.id}`,
          {
            noticeId,
            guardianId: users.parent,
          },
          () =>
            ctx.db
              .query("noticeReceipts")
              .withIndex("by_noticeId_and_guardianId", (q) =>
                q.eq("noticeId", noticeId).eq("guardianId", users.parent),
              )
              .unique(),
        );
    }
    for (const resource of initialState.resources) {
      const category = resource.category as ResourceCategory;
      await ensure(
        ctx,
        "resources",
        `resource:${resource.title}`,
        {
          title: resource.title,
          description: "Sample document containing fictional development content.",
          category,
          status: "Published",
          file: await sampleFile(ctx, `resource:${resource.title}`),
          audiences: audienceFor(category === "Academic" ? "Grade 4" : "Whole school"),
          publishedBy: users.admin,
          updatedAt: FIXTURE_DATE,
        },
        async () =>
          single(
            await ctx.db
              .query("resources")
              .withIndex("by_status_and_category", (q) =>
                q.eq("status", "Published").eq("category", category),
              )
              .take(MAX_ROWS + 1),
            (row) => row.title === resource.title,
          ),
      );
    }
    for (const enquiry of initialState.enquiries) {
      const enquiryId = await ensure(
        ctx,
        "enquiries",
        `enquiry:${enquiry.id}`,
        {
          subject: enquiry.subject,
          department: "Finance",
          status: enquiry.status,
          createdBy: users.parent,
          learnerId: learners["Emma Williams"],
          lastMessageAt: FIXTURE_DATE,
        },
        async () =>
          single(
            await ctx.db
              .query("enquiries")
              .withIndex("by_createdBy_and_lastMessageAt", (q) => q.eq("createdBy", users.parent))
              .take(MAX_ROWS + 1),
            (row) => row.subject === enquiry.subject,
          ),
      );
      for (const [i, message] of enquiry.messages.entries())
        await ensure(
          ctx,
          "enquiryMessages",
          `message:${enquiry.id}:${i}`,
          {
            enquiryId,
            authorId: users.parent,
            body: message.body,
            internal: false,
          },
          async () =>
            single(
              await ctx.db
                .query("enquiryMessages")
                .withIndex("by_enquiryId", (q) => q.eq("enquiryId", enquiryId))
                .take(MAX_ROWS + 1),
              (row) => row.body === message.body,
            ),
        );
    }
    const classId = classes["4B"];
    const date = "2026-10-14";
    const registerId = await ensure(
      ctx,
      "attendanceRegisters",
      "register:4B:2026-10-14",
      {
        classId,
        date,
        status: "Submitted",
        takenBy: users.teacher,
        submittedAt: FIXTURE_DATE,
      },
      () =>
        ctx.db
          .query("attendanceRegisters")
          .withIndex("by_classId_and_date", (q) => q.eq("classId", classId).eq("date", date))
          .unique(),
    );
    for (const [name, present] of Object.entries(initialState.attendance)) {
      if (!learners[name]) {
        const [firstName, ...rest] = name.split(" ");
        const learnerNumber = `DEMO-${name.toUpperCase().replaceAll(" ", "-")}`;
        learners[name] = await ensure(
          ctx,
          "learners",
          `learner:${name}`,
          {
            firstName,
            lastName: rest.join(" "),
            learnerNumber,
            gradeId: grades["Grade 4"],
            classId,
            status: "Active",
          },
          () =>
            ctx.db
              .query("learners")
              .withIndex("by_learnerNumber", (q) => q.eq("learnerNumber", learnerNumber))
              .unique(),
        );
      }
      const learnerId = learners[name];
      await ensure(
        ctx,
        "attendanceMarks",
        `attendance:${name}`,
        {
          registerId,
          learnerId,
          date,
          status: present ? "Present" : "Absent",
          updatedBy: users.teacher,
        },
        () =>
          ctx.db
            .query("attendanceMarks")
            .withIndex("by_registerId_and_learnerId", (q) =>
              q.eq("registerId", registerId).eq("learnerId", learnerId),
            )
            .unique(),
      );
    }
    for (const [i, entry] of initialState.conduct.entries()) {
      const learnerId = learners[entry.child];
      await ensure(
        ctx,
        "conductEntries",
        `conduct:${i}`,
        {
          learnerId,
          title: entry.title,
          type: "Merit",
          authorId: users.teacher,
          visibleToGuardians: true,
          occurredAt: FIXTURE_DATE,
        },
        async () =>
          single(
            await ctx.db
              .query("conductEntries")
              .withIndex("by_learnerId_and_occurredAt", (q) => q.eq("learnerId", learnerId))
              .take(MAX_ROWS + 1),
            (row) => row.title === entry.title,
          ),
      );
    }
    for (const [term, status] of [
      ["Term 3, 2026", "Released"],
      ["Term 4, 2026", "Draft"],
    ] as const) {
      const learnerId = learners["Emma Williams"];
      await ensure(
        ctx,
        "reports",
        `report:${term}`,
        {
          learnerId,
          term,
          title: `${term} sample academic report`,
          status,
          uploadedBy: users.teacher,
          releasedAt: status === "Released" ? FIXTURE_DATE : undefined,
        },
        () =>
          ctx.db
            .query("reports")
            .withIndex("by_learnerId_and_term", (q) =>
              q.eq("learnerId", learnerId).eq("term", term),
            )
            .unique(),
      );
    }
    await invalidateDashboard(ctx, "schools");
    return inventory(ctx);
  },
});

export const reset = internalMutation({
  args: {},
  returns: countsValidator,
  handler: async (ctx) => {
    requireSeedDeployment();
    const counts = await inventory(ctx);
    const records = await ctx.db
      .query("seedFixtures")
      .withIndex("by_key")
      .take(MAX_ROWS + 1);
    const storageIds = new Set(
      records.flatMap((r) => (r.target.kind === "file" ? [r.target.file.storageId] : [])),
    );
    for (const storageId of storageIds)
      if (await ctx.db.system.get("_storage", storageId)) await ctx.storage.delete(storageId);
    const dashboardRows = await ctx.db.query("dashboardItems").take(MAX_ROWS + 1);
    for (const item of dashboardRows) await dashboardAggregate.deleteIfExists(ctx, item);
    for (const table of TABLES) {
      const rows = await ctx.db.query(table).take(MAX_ROWS + 1);
      for (const row of rows) await ctx.db.delete(table, row._id);
    }
    return counts;
  },
});

export const verify = internalQuery({
  args: {},
  returns: v.object({
    counts: countsValidator,
    referencesChecked: v.number(),
    filesChecked: v.number(),
  }),
  handler: async (ctx) => {
    requireSeedDeployment();
    await checkSchool(ctx);
    const counts = await inventory(ctx);
    const records = await ctx.db
      .query("seedFixtures")
      .withIndex("by_key")
      .take(MAX_ROWS + 1);
    let referencesChecked = 0;
    let filesChecked = 0;
    const foreignTables: Record<string, TableNames> = {
      userId: "users",
      guardianId: "users",
      staffId: "users",
      authorId: "users",
      createdBy: "users",
      reviewedBy: "users",
      publishedBy: "users",
      publicationActorId: "users",
      uploadedBy: "users",
      takenBy: "users",
      updatedBy: "users",
      homeroomTeacherId: "users",
      assigneeId: "users",
      payerId: "users",
      invitedBy: "users",
      acceptedBy: "users",
      actorId: "users",
      gradeId: "grades",
      classId: "classes",
      learnerId: "learners",
      noticeId: "notices",
      eventId: "events",
      enquiryId: "enquiries",
      registerId: "attendanceRegisters",
      consentRequestId: "consentRequests",
      chargeId: "charges",
      paymentId: "payments",
      groupId: "groups",
    };
    const inspect = async (value: unknown): Promise<void> => {
      if (!value || typeof value !== "object") return;
      for (const [field, nested] of Object.entries(value)) {
        const foreignTable = foreignTables[field];
        if (foreignTable && nested !== undefined) {
          const id = typeof nested === "string" && ctx.db.normalizeId(foreignTable, nested);
          if (!id || !(await ctx.db.get(foreignTable, id)))
            throw new Error(`Broken foreign reference: ${field}`);
          referencesChecked++;
        } else if (field === "storageId" && typeof nested === "string") {
          const id = ctx.db.system.normalizeId("_storage", nested);
          if (!id || !(await ctx.db.system.get("_storage", id)))
            throw new Error("Broken storage reference");
          referencesChecked++;
        } else if (typeof nested === "object") await inspect(nested);
      }
    };
    for (const record of records) {
      if (record.target.kind === "document") {
        const target = record.target;
        const table = TABLES.find((t) => t === target.table);
        const id = table && ctx.db.normalizeId(table, record.target.documentId);
        const document = table && id ? await ctx.db.get(table, id) : null;
        if (!document) throw new Error(`Broken fixture ${record.key}`);
        await inspect(document);
        referencesChecked++;
      } else {
        const meta = await ctx.db.system.get("_storage", record.target.file.storageId);
        if (
          !meta ||
          meta.size !== record.target.file.size ||
          meta.contentType !== record.target.file.contentType
        )
          throw new Error(`Missing or invalid file ${record.key}`);
        filesChecked++;
      }
    }
    if (referencesChecked === 0 || filesChecked !== 6)
      throw new Error("Incomplete seed; run seed:backend.");
    return { counts, referencesChecked, filesChecked };
  },
});

// Phase 11 roster import: Administrator-only preview and chunked, audited commit.
// Every row is re-validated here with the shared school-core rules; the client
// preview is a convenience, never the authority. Guardians and staff are only
// staged as rosterContacts: importing never creates accounts, roles or links.
import { ConvexError, v } from "convex/values";
import {
  IMPORT_BATCH_SIZE,
  IMPORT_MAX_ROWS,
  validateImportRow,
  type ClassRow,
  type GuardianRow,
  type ImportKind,
  type LearnerRow,
  type StaffRow,
} from "@school-connect/core/imports";
import type { Doc, Id, TableNames } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { authedMutation, authedQuery, type AuthedMutationCtx } from "./lib/functions";
import { hasRole, denied, requireModule, type Actor } from "./lib/auth";
import { importBatchStatus, importKind } from "./validators";

const CONTACTS_PER_LEARNER = 20;
const GRADE_LIMIT = 50;

type Outcome = "create" | "update" | "unchanged" | "rejected";
type Write = { table: TableNames; id: string; action: string };
type Plan =
  | { outcome: "rejected"; messages: string[] }
  | {
      outcome: Exclude<Outcome, "rejected">;
      messages: string[];
      apply?: (ctx: MutationCtx, batchId: Id<"importBatches">) => Promise<Write[]>;
    };

const rowInput = v.object({ row: v.number(), cells: v.record(v.string(), v.string()) });
const rowResult = v.object({
  row: v.number(),
  outcome: v.union(
    v.literal("create"),
    v.literal("update"),
    v.literal("unchanged"),
    v.literal("rejected"),
  ),
  messages: v.array(v.string()),
});

function administrator(actor: Actor) {
  if (!hasRole(actor, "Administrator")) denied();
  requireModule(actor, "people");
}
function invalid(message: string): never {
  throw new ConvexError({ code: "INVALID", message });
}
function checkChunk(rows: { row: number }[]) {
  if (rows.length === 0 || rows.length > IMPORT_BATCH_SIZE)
    invalid(`Send between 1 and ${IMPORT_BATCH_SIZE} rows at a time.`);
  if (new Set(rows.map((r) => r.row)).size !== rows.length) invalid("Row numbers must be unique.");
}
const rejected = (...messages: string[]): Plan => ({ outcome: "rejected", messages });
/** Fields whose imported value differs; blank optional imports never erase stored values. */
function changes<T extends object>(current: T, next: Partial<T>): Partial<T> {
  const diff: Partial<T> = {};
  for (const [key, value] of Object.entries(next) as [keyof T, T[keyof T]][]) {
    if (value === undefined) continue;
    if (JSON.stringify(current[key]) !== JSON.stringify(value)) diff[key] = value;
  }
  return diff;
}
/** "Grade R" sorts first, "Grade 4" as 4; anything else after numbered grades. */
function gradeSortOrder(name: string) {
  if (/^grade\s*r$/i.test(name)) return 0;
  const match = /(\d+)/.exec(name);
  return match ? Number(match[1]) : 100;
}

async function findGrade(ctx: QueryCtx, name: string) {
  const grades = await ctx.db.query("grades").withIndex("by_sortOrder").take(GRADE_LIMIT);
  return grades.find((g) => g.name.toLowerCase() === name.toLowerCase()) ?? null;
}
async function findClass(ctx: QueryCtx, year: number, name: string) {
  return ctx.db
    .query("classes")
    .withIndex("by_year_and_name", (q) => q.eq("year", year).eq("name", name))
    .unique();
}
async function findUser(ctx: QueryCtx, email: string) {
  return ctx.db
    .query("users")
    .withIndex("email", (q) => q.eq("email", email))
    .unique();
}
async function learnerByNumber(ctx: QueryCtx, learnerNumber: string) {
  return ctx.db
    .query("learners")
    .withIndex("by_learnerNumber", (q) => q.eq("learnerNumber", learnerNumber))
    .unique();
}

async function planClass(ctx: QueryCtx, row: ClassRow): Promise<Plan> {
  const grade = await findGrade(ctx, row.grade);
  const existing = await findClass(ctx, row.year, row.className);
  if (existing) {
    if (!grade || existing.gradeId !== grade._id)
      return rejected(`Class ${row.className} (${row.year}) already belongs to another grade.`);
    return { outcome: "unchanged", messages: [] };
  }
  return {
    outcome: "create",
    messages: grade ? [] : [`Grade "${row.grade}" will be created.`],
    apply: async (db) => {
      const writes: Write[] = [];
      let gradeId = (await findGrade(db, row.grade))?._id;
      if (!gradeId) {
        gradeId = await db.db.insert("grades", {
          name: row.grade,
          sortOrder: gradeSortOrder(row.grade),
        });
        writes.push({ table: "grades", id: gradeId, action: "import.grade.created" });
      }
      const id = await db.db.insert("classes", { gradeId, name: row.className, year: row.year });
      writes.push({ table: "classes", id, action: "import.class.created" });
      return writes;
    },
  };
}

async function planLearner(ctx: QueryCtx, row: LearnerRow): Promise<Plan> {
  const classroom = await findClass(ctx, row.year, row.className);
  if (!classroom)
    return rejected(`Class ${row.className} (${row.year}) does not exist. Import classes first.`);
  const grade = await ctx.db.get("grades", classroom.gradeId);
  if (!grade || grade.name.toLowerCase() !== row.grade.toLowerCase())
    return rejected(
      `Class ${row.className} belongs to ${grade?.name ?? "another grade"}, not ${row.grade}.`,
    );
  const fields = {
    firstName: row.firstName,
    lastName: row.lastName,
    preferredName: row.preferredName,
    dateOfBirth: row.dateOfBirth,
    gradeId: grade._id,
    classId: classroom._id,
  };
  const existing = await learnerByNumber(ctx, row.learnerNumber);
  if (!existing)
    return {
      outcome: "create",
      messages: [],
      apply: async (db) => {
        const id = await db.db.insert("learners", {
          ...fields,
          learnerNumber: row.learnerNumber,
          status: "Active",
        });
        return [{ table: "learners", id, action: "import.learner.created" }];
      },
    };
  const diff = changes<Doc<"learners">>(existing, fields);
  if (Object.keys(diff).length === 0) return { outcome: "unchanged", messages: [] };
  return {
    outcome: "update",
    messages: [`Updates ${Object.keys(diff).join(", ")}.`],
    apply: async (db) => {
      await db.db.patch("learners", existing._id, diff);
      return [{ table: "learners", id: existing._id, action: "import.learner.updated" }];
    },
  };
}

async function planGuardian(ctx: QueryCtx, row: GuardianRow): Promise<Plan> {
  const learner = await learnerByNumber(ctx, row.learnerNumber);
  if (!learner)
    return rejected(`Learner ${row.learnerNumber} does not exist. Import learners first.`);
  const user = await findUser(ctx, row.email);
  if (user) {
    const link = await ctx.db
      .query("guardianLinks")
      .withIndex("by_guardianId_and_learnerId", (q) =>
        q.eq("guardianId", user._id).eq("learnerId", learner._id),
      )
      .unique();
    if (link) return { outcome: "unchanged", messages: ["Already linked to an existing account."] };
  }
  const fields = {
    firstName: row.firstName,
    lastName: row.lastName,
    phone: row.phone,
    relationship: row.relationship,
    isPrimaryContact: row.isPrimaryContact,
  };
  const existing = await ctx.db
    .query("rosterContacts")
    .withIndex("by_kind_and_email_and_learnerId", (q) =>
      q.eq("kind", "Guardian").eq("email", row.email).eq("learnerId", learner._id),
    )
    .unique();
  if (!existing) {
    const current = await ctx.db
      .query("rosterContacts")
      .withIndex("by_learnerId", (q) => q.eq("learnerId", learner._id))
      .take(CONTACTS_PER_LEARNER);
    if (current.length >= CONTACTS_PER_LEARNER)
      return rejected(
        `Learner ${row.learnerNumber} already has ${CONTACTS_PER_LEARNER} staged contacts.`,
      );
    return {
      outcome: "create",
      messages: ["Staged for later activation; no account access is granted."],
      apply: async (db, importBatchId) => {
        const id = await db.db.insert("rosterContacts", {
          kind: "Guardian",
          email: row.email,
          learnerId: learner._id,
          ...fields,
          importBatchId,
          updatedAt: Date.now(),
        });
        return [{ table: "rosterContacts", id, action: "import.contact.staged" }];
      },
    };
  }
  const diff = changes<Doc<"rosterContacts">>(existing, fields);
  if (Object.keys(diff).length === 0) return { outcome: "unchanged", messages: [] };
  return {
    outcome: "update",
    messages: [`Updates ${Object.keys(diff).join(", ")}.`],
    apply: async (db, importBatchId) => {
      await db.db.patch("rosterContacts", existing._id, {
        ...diff,
        importBatchId,
        updatedAt: Date.now(),
      });
      return [{ table: "rosterContacts", id: existing._id, action: "import.contact.updated" }];
    },
  };
}

async function planStaff(ctx: QueryCtx, row: StaffRow): Promise<Plan> {
  const classIds: Id<"classes">[] = [];
  for (const name of row.classNames) {
    const classroom = row.year === undefined ? null : await findClass(ctx, row.year, name);
    if (!classroom) return rejected(`Class ${name} (${row.year ?? "no year"}) does not exist.`);
    classIds.push(classroom._id);
  }
  if (classIds.length > 0 && !row.roles.includes("Teacher"))
    return rejected("Only Teacher contacts can list classes.");
  const user = await findUser(ctx, row.email);
  if (user) {
    const roles = await ctx.db
      .query("staffRoles")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .take(1);
    if (roles.length > 0)
      return {
        outcome: "unchanged",
        messages: ["Existing staff account; manage its roles in People."],
      };
  }
  const fields = {
    firstName: row.firstName,
    lastName: row.lastName,
    phone: row.phone,
    staffRoles: row.roles,
    classIds,
  };
  const existing = await ctx.db
    .query("rosterContacts")
    .withIndex("by_kind_and_email", (q) => q.eq("kind", "Staff").eq("email", row.email))
    .unique();
  if (!existing)
    return {
      outcome: "create",
      messages: ["Staged for later activation; no account access is granted."],
      apply: async (db, importBatchId) => {
        const id = await db.db.insert("rosterContacts", {
          kind: "Staff",
          email: row.email,
          ...fields,
          importBatchId,
          updatedAt: Date.now(),
        });
        return [{ table: "rosterContacts", id, action: "import.contact.staged" }];
      },
    };
  const diff = changes<Doc<"rosterContacts">>(existing, fields);
  if (Object.keys(diff).length === 0) return { outcome: "unchanged", messages: [] };
  return {
    outcome: "update",
    messages: [`Updates ${Object.keys(diff).join(", ")}.`],
    apply: async (db, importBatchId) => {
      await db.db.patch("rosterContacts", existing._id, {
        ...diff,
        importBatchId,
        updatedAt: Date.now(),
      });
      return [{ table: "rosterContacts", id: existing._id, action: "import.contact.updated" }];
    },
  };
}

async function planRow(
  ctx: QueryCtx,
  kind: ImportKind,
  input: { row: number; cells: Record<string, string> },
): Promise<Plan> {
  const result = validateImportRow(kind, input.cells, input.row);
  if (!result.data)
    return rejected(
      ...result.errors.map((e) => (e.field ? `${e.field}: ${e.message}` : e.message)),
    );
  switch (kind) {
    case "classes":
      return planClass(ctx, result.data as ClassRow);
    case "learners":
      return planLearner(ctx, result.data as LearnerRow);
    case "guardians":
      return planGuardian(ctx, result.data as GuardianRow);
    default:
      return planStaff(ctx, result.data as StaffRow);
  }
}

/** Dry run for one chunk: what commit would do to each row right now. Writes nothing. */
export const preview = authedQuery({
  args: { kind: importKind, rows: v.array(rowInput) },
  returns: v.array(rowResult),
  handler: async (ctx, args) => {
    administrator(ctx.actor);
    checkChunk(args.rows);
    const results = [];
    for (const input of args.rows) {
      const plan = await planRow(ctx, args.kind, input);
      results.push({ row: input.row, outcome: plan.outcome, messages: plan.messages });
    }
    return results;
  },
});

async function openBatch(
  ctx: AuthedMutationCtx,
  args: { kind: ImportKind; fileName: string; totalRows: number; batchId?: Id<"importBatches"> },
) {
  if (args.batchId) {
    const batch = await ctx.db.get("importBatches", args.batchId);
    if (!batch) invalid("Import batch not found.");
    if (batch.kind !== args.kind || batch.status !== "Open")
      invalid("This import batch is closed.");
    return batch;
  }
  const fileName = args.fileName.trim();
  if (fileName === "" || fileName.length > 200)
    invalid("Enter a file name of at most 200 characters.");
  if (!Number.isInteger(args.totalRows) || args.totalRows < 1 || args.totalRows > IMPORT_MAX_ROWS)
    invalid(`An import holds between 1 and ${IMPORT_MAX_ROWS} rows.`);
  const id = await ctx.db.insert("importBatches", {
    kind: args.kind,
    fileName,
    status: "Open",
    createdBy: ctx.actor.user._id,
    totalRows: args.totalRows,
    created: 0,
    updated: 0,
    unchanged: 0,
    rejected: 0,
    updatedAt: Date.now(),
  });
  await ctx.audit("import.batch.opened", "importBatches", id, `${args.kind}: ${fileName}`);
  return (await ctx.db.get("importBatches", id))!;
}

/**
 * Commits one chunk of validated rows. Rejected rows write nothing; accepted
 * rows write and audit atomically with the batch counters.
 */
export const commit = authedMutation({
  args: {
    kind: importKind,
    fileName: v.string(),
    totalRows: v.number(),
    batchId: v.optional(v.id("importBatches")),
    rows: v.array(rowInput),
  },
  returns: v.object({ batchId: v.id("importBatches"), results: v.array(rowResult) }),
  handler: async (ctx, args) => {
    administrator(ctx.actor);
    checkChunk(args.rows);
    const batch = await openBatch(ctx, args);
    const counts = { create: 0, update: 0, unchanged: 0, rejected: 0 };
    const results = [];
    for (const input of args.rows) {
      const plan = await planRow(ctx, args.kind, input);
      counts[plan.outcome]++;
      if (plan.outcome !== "rejected" && plan.apply)
        for (const write of await plan.apply(ctx, batch._id))
          await ctx.audit(write.action, write.table, write.id, `Import row ${input.row}`);
      results.push({ row: input.row, outcome: plan.outcome, messages: plan.messages });
    }
    const processed =
      batch.created + batch.updated + batch.unchanged + batch.rejected + args.rows.length;
    if (processed > batch.totalRows) invalid("More rows were sent than the import declared.");
    await ctx.db.patch("importBatches", batch._id, {
      created: batch.created + counts.create,
      updated: batch.updated + counts.update,
      unchanged: batch.unchanged + counts.unchanged,
      rejected: batch.rejected + counts.rejected,
      updatedAt: Date.now(),
    });
    if (counts.create + counts.update === 0)
      await ctx.audit("import.batch.chunk", "importBatches", batch._id, "No changes");
    return { batchId: batch._id, results };
  },
});

export const complete = authedMutation({
  args: { batchId: v.id("importBatches") },
  returns: v.null(),
  handler: async (ctx, args) => {
    administrator(ctx.actor);
    const batch = await ctx.db.get("importBatches", args.batchId);
    if (!batch) invalid("Import batch not found.");
    if (batch.status !== "Open") invalid("This import batch is already complete.");
    await ctx.db.patch("importBatches", batch._id, { status: "Completed", updatedAt: Date.now() });
    await ctx.audit(
      "import.batch.completed",
      "importBatches",
      batch._id,
      `${batch.created} created, ${batch.updated} updated, ${batch.unchanged} unchanged, ${batch.rejected} rejected`,
    );
    return null;
  },
});

export const batches = authedQuery({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("importBatches"),
      _creationTime: v.number(),
      kind: importKind,
      fileName: v.string(),
      status: importBatchStatus,
      totalRows: v.number(),
      created: v.number(),
      updated: v.number(),
      unchanged: v.number(),
      rejected: v.number(),
    }),
  ),
  handler: async (ctx) => {
    administrator(ctx.actor);
    const rows = await ctx.db.query("importBatches").order("desc").take(20);
    return rows.map(({ createdBy: _c, updatedAt: _u, ...row }) => row);
  },
});

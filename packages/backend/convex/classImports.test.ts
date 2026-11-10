/// <reference types="vite/client" />
import aggregateTest from "@convex-dev/aggregate/test";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { parseClassImportCsv, type ClassImportTarget } from "@school-connect/core/imports";
import schema from "./schema";
import { api, internal } from "./_generated/api";

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts", "!./convex.config.ts"]);
beforeEach(() => vi.stubEnv("ENABLE_DEMO_ACCOUNTS", "true"));
afterEach(() => vi.unstubAllEnvs());

async function setup() {
  const t = convexTest(schema, modules);
  aggregateTest.register(t, "dashboardAggregate");
  await t.action(internal.seedFiles.run, {});
  const login = async (email: string) => {
    const user = await t.run((ctx) =>
      ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", email))
        .unique(),
    );
    if (!user) throw new Error("Missing fixture user");
    const session = await t.run((ctx) =>
      ctx.db.insert("authSessions", { userId: user._id, expirationTime: Date.now() + 3600000 }),
    );
    return t.withIdentity({ subject: `${user._id}|${session}` });
  };
  return {
    t,
    admin: await login("admin@wgjs.example"),
    principal: await login("principal@wgjs.example"),
    teacher: await login("teacher@wgjs.example"),
    finance: await login("finance@wgjs.example"),
    parent: await login("parent@wgjs.example"),
  };
}

// The seeded teacher teaches 4B (Grade 4); 1A (Grade 1) belongs to another teacher.
const grade4: ClassImportTarget = { grade: "Grade 4", className: "4B", year: 2026 };
const grade1: ClassImportTarget = { grade: "Grade 1", className: "1A", year: 2026 };
const csv = [
  "learner_number,first_name,last_name,date_of_birth,parent_email,parent_first_name,parent_last_name,parent_relationship",
  "wg-200,Sipho,Ndlovu,2016-02-03,sipho.parent@example.org,Lindiwe,Ndlovu,Mother",
  "WG-201,Ava,Botha,,,,,",
].join("\n");
function rowsFor(target: ClassImportTarget, text = csv) {
  const parsed = parseClassImportCsv(text, target);
  expect(parsed.errors).toEqual([]);
  return {
    learners: parsed.rows.map((r) => ({ row: r.row, cells: r.learner })),
    guardians: parsed.rows.flatMap((r) => (r.guardian ? [{ row: r.row, cells: r.guardian }] : [])),
  };
}

it("parses the simple class template and fills class, grade and year from the folder", () => {
  const parsed = parseClassImportCsv(csv, grade4);
  expect(parsed.rows).toHaveLength(2);
  expect(parsed.rows[0]).toMatchObject({
    learnerNumber: "WG-200",
    name: "Sipho Ndlovu",
    learner: { grade: "Grade 4", class_name: "4B", year: "2026" },
    guardian: { email: "sipho.parent@example.org", relationship: "Mother" },
  });
  expect(parsed.rows[1]!.guardian).toBeUndefined();
  const bad = parseClassImportCsv(
    "learner_number,first_name,last_name,parent_email\nWG-1,Ann,Lee,not-an-email\nWG-1,Ann,Lee,\n,Bo,=Cmd,",
    grade4,
  );
  expect(bad.rows).toHaveLength(1);
  expect(bad.errors.map((e) => e.field ?? e.message)).toEqual(
    expect.arrayContaining(["parent_email", "parent_first_name", "learner_number", "last_name"]),
  );
  expect(parseClassImportCsv("name,surname\nA,B", grade4).errors[0]!.message).toMatch(
    /missing columns: learner_number, first_name, last_name/,
  );
});

it("lets a teacher import learners and parent contacts into a class they teach", async () => {
  const { t, teacher, admin } = await setup();
  const { learners, guardians } = rowsFor(grade4);
  const preview = await teacher.query(api.imports.preview, { kind: "learners", rows: learners });
  expect(preview.map((r) => r.outcome)).toEqual(["create", "create"]);

  const saved = await teacher.mutation(api.imports.commit, {
    kind: "learners",
    fileName: "4B.csv",
    totalRows: learners.length,
    rows: learners,
  });
  await teacher.mutation(api.imports.complete, { batchId: saved.batchId });
  const parents = await teacher.mutation(api.imports.commit, {
    kind: "guardians",
    fileName: "4B.csv",
    totalRows: guardians.length,
    rows: guardians,
  });
  expect(parents.results.map((r) => r.outcome)).toEqual(["create"]);
  await teacher.mutation(api.imports.complete, { batchId: parents.batchId });

  await t.run(async (ctx) => {
    const sipho = await ctx.db
      .query("learners")
      .withIndex("by_learnerNumber", (q) => q.eq("learnerNumber", "WG-200"))
      .unique();
    const klass = await ctx.db
      .query("classes")
      .withIndex("by_year_and_name", (q) => q.eq("year", 2026).eq("name", "4B"))
      .unique();
    expect(sipho).toMatchObject({ classId: klass!._id, status: "Active", firstName: "Sipho" });
    const contacts = await ctx.db
      .query("rosterContacts")
      .withIndex("by_learnerId", (q) => q.eq("learnerId", sipho!._id))
      .take(5);
    expect(contacts).toMatchObject([{ kind: "Guardian", email: "sipho.parent@example.org" }]);
    // Staged only: no account or learner link is created.
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", "sipho.parent@example.org"))
      .unique();
    expect(user).toBeNull();
    const audits = await ctx.db.query("auditLog").order("desc").take(50);
    expect(audits.map((a) => a.action)).toEqual(
      expect.arrayContaining(["import.learner.created", "import.contact.staged"]),
    );
  });
  // Teachers see their own batches; Administrators see every batch.
  expect(await teacher.query(api.imports.batches, {})).toHaveLength(2);
  expect((await admin.query(api.imports.batches, {})).length).toBeGreaterThanOrEqual(2);
  // Re-importing the same file changes nothing.
  const again = await teacher.query(api.imports.preview, { kind: "learners", rows: learners });
  expect(again.map((r) => r.outcome)).toEqual(["unchanged", "unchanged"]);
});

it("keeps teachers inside their own classes and to learners and parents only", async () => {
  const { teacher, admin, finance, parent } = await setup();
  // A class the teacher does not teach.
  const other = await teacher.query(api.imports.preview, {
    kind: "learners",
    rows: rowsFor(grade1).learners,
  });
  expect(other.every((r) => r.outcome === "rejected")).toBe(true);
  expect(other[0]!.messages.join(" ")).toMatch(/classes you teach/);
  // A learner who already sits in another teacher's class cannot be moved or edited.
  const moved = await teacher.query(api.imports.preview, {
    kind: "learners",
    rows: rowsFor(grade4, "learner_number,first_name,last_name\nDEMO-NOAH,Noah,Williams").learners,
  });
  expect(moved[0]).toMatchObject({ outcome: "rejected" });
  expect(moved[0]!.messages.join(" ")).toMatch(/class you do not teach/);
  const foreignParent = await teacher.query(api.imports.preview, {
    kind: "guardians",
    rows: [
      {
        row: 2,
        cells: {
          learner_number: "DEMO-NOAH",
          email: "x@example.org",
          first_name: "X",
          last_name: "Y",
          phone: "",
          relationship: "Father",
          primary_contact: "",
        },
      },
    ],
  });
  expect(foreignParent[0]).toMatchObject({ outcome: "rejected" });
  // Only learners and guardians; classes and staff stay with the Administrator.
  const classRows = [{ row: 2, cells: { grade: "Grade 9", class_name: "9A", year: "2026" } }];
  await expect(
    teacher.query(api.imports.preview, { kind: "classes", rows: classRows }),
  ).rejects.toThrow(/cannot access/);
  await expect(
    teacher.mutation(api.imports.commit, {
      kind: "staff",
      fileName: "s.csv",
      totalRows: 1,
      rows: [
        { row: 2, cells: { email: "a@b.co", first_name: "A", last_name: "B", roles: "Teacher" } },
      ],
    }),
  ).rejects.toThrow(/cannot access/);
  // Someone else's batch cannot be continued, completed or listed.
  const { batchId } = await admin.mutation(api.imports.commit, {
    kind: "learners",
    fileName: "x.csv",
    totalRows: 3,
    rows: rowsFor(grade4).learners,
  });
  await expect(teacher.mutation(api.imports.complete, { batchId })).rejects.toThrow(
    /cannot access/,
  );
  await expect(
    teacher.mutation(api.imports.commit, {
      kind: "learners",
      fileName: "x.csv",
      totalRows: 3,
      batchId,
      rows: [{ row: 9, cells: rowsFor(grade4).learners[0]!.cells }],
    }),
  ).rejects.toThrow(/cannot access/);
  expect(await teacher.query(api.imports.batches, {})).toEqual([]);
  // Finance and parents have no class import.
  for (const client of [finance, parent])
    await expect(
      client.query(api.imports.preview, { kind: "learners", rows: rowsFor(grade4).learners }),
    ).rejects.toThrow(/cannot access/);
});

it("lets a Principal import into any class", async () => {
  const { principal } = await setup();
  const { learners } = rowsFor(grade1);
  const saved = await principal.mutation(api.imports.commit, {
    kind: "learners",
    fileName: "1A.csv",
    totalRows: learners.length,
    rows: learners,
  });
  expect(saved.results.map((r) => r.outcome)).toEqual(["create", "create"]);
});

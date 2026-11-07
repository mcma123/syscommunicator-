/// <reference types="vite/client" />
import aggregateTest from "@convex-dev/aggregate/test";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PDFDocument } from "pdf-lib";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { hashInvitation } from "./authPolicy";
import type { UploadSpec, FileTarget } from "../client";
const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts", "!./convex.config.ts"]);
beforeEach(() => {
  vi.stubEnv("ENABLE_DEMO_ACCOUNTS", "true");
  vi.stubEnv("CONVEX_SITE_URL", "https://diligent-bass-226.convex.site");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
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
    if (!user) throw new Error("Missing user");
    const session = await t.run((ctx) =>
      ctx.db.insert("authSessions", { userId: user._id, expirationTime: Date.now() + 86400000 }),
    );
    return { user, session, client: t.withIdentity({ subject: `${user._id}|${session}` }) };
  };
  const admin = await login("admin@wgjs.example"),
    parent = await login("parent@wgjs.example"),
    teacher = await login("teacher@wgjs.example"),
    finance = await login("finance@wgjs.example");
  const learner = await t.run(async (ctx) => {
    const l = await ctx.db
      .query("guardianLinks")
      .withIndex("by_guardianId", (q) => q.eq("guardianId", parent.user._id))
      .first();
    return l!.learnerId;
  });
  const bytes = new TextEncoder().encode(
    "%PDF-1.7\n" + "fictional test report".repeat(30000),
  ).buffer;
  const upload = async (
    spec: UploadSpec,
    client = admin.client,
    body = bytes,
    contentType = "application/pdf",
    fileName = "school.pdf",
  ) => {
    const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", body)), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
    const lease = await client.mutation(api.files.beginUpload, {
      spec,
      fileName,
      contentType,
      size: body.byteLength,
      sha256,
    });
    const staging = await t.run((ctx) =>
      ctx.storage.store(new Blob([body], { type: contentType })),
    );
    await client.mutation(api.files.claimUpload, { uploadId: lease.uploadId, storageId: staging });
    return {
      lease,
      staging,
      finish: () => client.action(api.files.finishUpload, { uploadId: lease.uploadId }),
    };
  };
  const reportSpec: UploadSpec = {
    kind: "report",
    values: { learnerId: learner, title: "Real report", term: "Term 4" },
  };
  const link = async (target: FileTarget, client = parent.client) => {
    const grant = await client.action(api.files.prepareDownload, { target });
    return {
      ...grant,
      ...(await client.query(api.files.downloadUrl, { ...grant, now: Date.now() })),
    };
  };
  return { t, login, admin, parent, teacher, finance, learner, bytes, upload, reportSpec, link };
}
it("uploads a report above the old byte cap, releases it, and serves only a linked guardian", async () => {
  const { t, admin, parent, finance, upload, reportSpec, link, bytes } = await setup();
  const u = await upload(reportSpec),
    id = (await u.finish()) as Id<"reports">;
  expect(await u.finish()).toBe(id);
  expect(await t.run((ctx) => ctx.storage.get(u.staging))).toBeNull();
  await expect(link({ kind: "report", id })).rejects.toThrow();
  await expect(link({ kind: "report", id }, finance.client)).rejects.toThrow();
  for (const action of ["reportReview", "reportRelease"] as const)
    await admin.client.mutation(api.workflows.submit, { action, itemId: id, values: {} });
  const granted = await link({ kind: "report", id });
  expect(granted.url).toContain("/files/download?token=");
  const response = await t.fetch(`/files/download?token=${granted.token}`);
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toContain("no-store");
  expect((await response.arrayBuffer()).byteLength).toBe(bytes.byteLength);
  await expect(
    t.action(api.files.prepareDownload, { target: { kind: "report", id } }),
  ).rejects.toThrow();
  const user = await t.run((ctx) =>
    ctx.db.insert("users", { email: "unrelated@school.test", status: "Active" }),
  );
  await t.run(async (ctx) => {
    const other = (await ctx.db.query("learners").withIndex("by_learnerNumber").take(10)).find(
      (l) => l._id !== reportSpec.values["learnerId"] && l.status === "Active",
    )!;
    const relationship = (await ctx.db.query("guardianLinks").first())!.relationship;
    await ctx.db.insert("guardianLinks", {
      guardianId: user,
      learnerId: other._id,
      relationship,
      isPrimaryContact: true,
    });
  });
  const session = await t.run((ctx) =>
    ctx.db.insert("authSessions", { userId: user, expirationTime: Date.now() + 3600000 }),
  );
  const stranger = t.withIdentity({ subject: `${user}|${session}` });
  await expect(
    stranger.action(api.files.prepareDownload, { target: { kind: "report", id } }),
  ).rejects.toThrow();
  await expect(
    stranger.query(api.files.downloadUrl, {
      grantId: granted.grantId,
      token: granted.token,
      now: Date.now(),
    }),
  ).rejects.toThrow();
  expect(
    await parent.client.query(api.files.downloadUrl, {
      grantId: granted.grantId,
      token: granted.token,
      now: Date.now(),
    }),
  ).not.toHaveProperty("storageId");
});
it("rechecks guardian links, publication, feature flags, expiry and session revocation at redemption", async () => {
  const { t, admin, parent, upload, reportSpec, link } = await setup();
  const id = (await (await upload(reportSpec)).finish()) as Id<"reports">;
  await t.run((ctx) => ctx.db.patch("reports", id, { status: "Released" }));
  const grant = await link({ kind: "report", id });
  const redeem = (now = Date.now()) => t.query(internal.files.redeem, { tokenHash: "", now });
  await expect(redeem()).rejects.toThrow();
  await expect(
    t.query(internal.files.redeem, {
      tokenHash: await hashInvitation(grant.token),
      now: grant.expiresAt + 1,
    }),
  ).rejects.toThrow();
  await t.run((ctx) => ctx.db.patch("reports", id, { status: "Reviewed" }));
  expect((await t.fetch(`/files/download?token=${grant.token}`)).status).toBe(403);
  await t.run((ctx) => ctx.db.patch("reports", id, { status: "Released" }));
  await t.run(async (ctx) => {
    const s = (await ctx.db.query("schools").first())!;
    await ctx.db.patch("schools", s._id, { featureFlags: { ...s.featureFlags, reports: false } });
  });
  expect((await t.fetch(`/files/download?token=${grant.token}`)).status).toBe(403);
  await t.run(async (ctx) => {
    const s = (await ctx.db.query("schools").first())!;
    await ctx.db.patch("schools", s._id, { featureFlags: { ...s.featureFlags, reports: true } });
  });
  const links = await t.run((ctx) =>
    ctx.db
      .query("guardianLinks")
      .withIndex("by_guardianId", (q) => q.eq("guardianId", parent.user._id))
      .take(20),
  );
  for (const l of links) await t.run((ctx) => ctx.db.delete("guardianLinks", l._id));
  expect((await t.fetch(`/files/download?token=${grant.token}`)).status).toBe(403);
  const staffGrant = await link({ kind: "report", id }, admin.client);
  await t.run((ctx) => ctx.db.delete("authSessions", admin.session));
  expect((await t.fetch(`/files/download?token=${staffGrant.token}`)).status).toBe(403);
});
it("rejects unauthorized uploads, wrong types, oversized files, digest mismatch and invalid signatures", async () => {
  const { t, parent, finance, admin, upload, reportSpec } = await setup();
  for (const client of [parent.client, finance.client])
    await expect(upload(reportSpec, client)).rejects.toThrow();
  await expect(
    upload({ ...reportSpec, values: { ...reportSpec.values, userId: parent.user._id } }),
  ).rejects.toThrow();
  for (const args of [
    { fileName: "bad.exe", contentType: "application/octet-stream", size: 10 },
    { fileName: "big.pdf", contentType: "application/pdf", size: 10485761 },
    { fileName: "../bad.pdf", contentType: "application/pdf", size: 10 },
  ])
    await expect(
      admin.client.mutation(api.files.beginUpload, {
        spec: reportSpec,
        ...args,
        sha256: "a".repeat(64),
      }),
    ).rejects.toThrow();
  const invalid = await upload(
    reportSpec,
    admin.client,
    new TextEncoder().encode("wrong file header").buffer,
  );
  await expect(invalid.finish()).rejects.toThrow(/contents/);
  const lease = await admin.client.mutation(api.files.beginUpload, {
    spec: reportSpec,
    fileName: "bad.pdf",
    contentType: "application/pdf",
    size: 10,
    sha256: "a".repeat(64),
  });
  const wrong = await t.run((ctx) =>
    ctx.storage.store(new Blob(["%PDF-wrong"], { type: "application/pdf" })),
  );
  await expect(
    admin.client.mutation(api.files.claimUpload, { uploadId: lease.uploadId, storageId: wrong }),
  ).rejects.toThrow();
  expect(
    await t.run((ctx) =>
      ctx.db
        .query("reports")
        .withIndex("by_uploadedBy_and_uploadHash", (q) => q.eq("uploadedBy", admin.user._id))
        .take(10),
    ),
  ).toHaveLength(0);
});
it("saves resource drafts, requires school publication and sanitizes legacy attachment DTOs", async () => {
  const { t, admin, parent, upload, link } = await setup();
  const categories = (await import("@school-connect/core/domain")).RESOURCE_CATEGORIES;
  const id = (await (
    await upload({
      kind: "resource",
      values: {
        title: "School resource",
        category: categories[0],
        audience: JSON.stringify([{ kind: "School" }]),
      },
    })
  ).finish()) as Id<"resources">;
  await expect(link({ kind: "resource", id })).rejects.toThrow();
  await expect(
    parent.client.mutation(api.files.resourceStatus, { resourceId: id, publish: true }),
  ).rejects.toThrow();
  await admin.client.mutation(api.files.resourceStatus, { resourceId: id, publish: true });
  const grant = await link({ kind: "resource", id });
  expect((await t.fetch(`/files/download?token=${grant.token}`)).status).toBe(200);
  expect(
    (await parent.client.query(api.resources.get, { resourceId: id })).file,
  ).not.toHaveProperty("storageId");
  await admin.client.mutation(api.files.resourceStatus, { resourceId: id, publish: false });
  expect((await t.fetch(`/files/download?token=${grant.token}`)).status).toBe(403);
});
it("attaches files only to draft notices and invalidates a removed attachment's download grant", async () => {
  vi.useFakeTimers();
  const { t, admin, upload, link } = await setup();
  const id = (await admin.client.mutation(api.workflows.submit, {
    action: "noticeSave",
    values: {
      title: "Notice attachment",
      body: "School draft",
      category: "General",
      audience: JSON.stringify([{ kind: "School" }]),
      urgent: "false",
      requiresAcknowledgement: "false",
    },
  })) as Id<"notices">;
  await (await upload({ kind: "notice", targetId: id, values: {} })).finish();
  const detachedFile = await t.run(
    async (ctx) => (await ctx.db.get("notices", id))!.attachments[0]!.storageId,
  );
  const grant = await link({ kind: "notice", id, slot: 0 }, admin.client);
  expect(
    (await admin.client.query(api.notices.get, { noticeId: id })).attachments[0],
  ).not.toHaveProperty("storageId");
  await admin.client.mutation(api.files.removeAttachment, { noticeId: id, slot: 0 });
  expect((await t.fetch(`/files/download?token=${grant.token}`)).status).toBe(403);
  await t.run((ctx) => ctx.db.patch("notices", id, { status: "Published" }));
  await expect(upload({ kind: "notice", targetId: id, values: {} })).rejects.toThrow();
  vi.advanceTimersByTime(2 * 86400000);
  await t.mutation(internal.files.cleanup, {});
  expect(await t.run(async (ctx) => (await ctx.storage.get(detachedFile)) === null)).toBe(true);
});
it("generates an idempotent valid receipt PDF only from a matching successful payment", async () => {
  const { t, admin, parent, teacher, learner, link } = await setup();
  const { receiptId, paymentId } = await t.run(async (ctx) => {
    const chargeId = await ctx.db.insert("charges", {
      learnerId: learner,
      title: "Fictional excursion",
      amountCents: 12345,
      status: "Paid",
      dueAt: Date.now(),
      createdBy: admin.user._id,
      updatedAt: Date.now(),
    });
    const paymentId = await ctx.db.insert("payments", {
      chargeId,
      payerId: parent.user._id,
      amountCents: 12345,
      provider: "isolated-test",
      status: "Pending",
    });
    const receiptId = await ctx.db.insert("receipts", {
      receiptNumber: "TEST-001",
      paymentId,
      chargeId,
      guardianId: parent.user._id,
      amountCents: 12345,
      issuedAt: Date.now(),
    });
    return { receiptId, paymentId };
  });
  await expect(parent.client.action(api.receiptFiles.generate, { receiptId })).rejects.toThrow();
  await t.run((ctx) => ctx.db.patch("payments", paymentId, { status: "Succeeded" }));
  await expect(teacher.client.action(api.receiptFiles.generate, { receiptId })).rejects.toThrow();
  // convex-test's storage simulator does not support overlapping action stores.
  const results = [
    await parent.client.action(api.receiptFiles.generate, { receiptId }),
    await parent.client.action(api.receiptFiles.generate, { receiptId }),
  ];
  expect(results).toEqual([receiptId, receiptId]);
  expect(await t.run((ctx) => ctx.db.query("managedFiles").take(10))).toHaveLength(1);
  const grant = await link({ kind: "receipt", id: receiptId });
  const response = await t.fetch(`/files/download?token=${grant.token}`);
  expect(response.status).toBe(200);
  const pdf = await PDFDocument.load(await response.arrayBuffer());
  expect(pdf.getPageCount()).toBe(1);
  // Exercise concurrent finalization without the simulator's overlapping action-store limitation.
  const bytes = await pdf.save();
  const first = await t.run((ctx) =>
    ctx.storage.store(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: "application/pdf" })),
  );
  const second = await t.run((ctx) =>
    ctx.storage.store(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: "application/pdf" })),
  );
  await t.run((ctx) => ctx.db.patch("receipts", receiptId, { file: undefined }));
  const attached = await Promise.all(
    [first, second].map((storageId) =>
      parent.client.mutation(internal.receiptFiles.attach, { receiptId, storageId }),
    ),
  );
  expect(attached.filter(Boolean)).toHaveLength(1);
}, 15000);

it("reclaims expired claimed/unclaimed staging files and detached attachments, preserving final and unrelated files", async () => {
  vi.useFakeTimers();
  const { t, upload, reportSpec } = await setup();
  const abandoned = await upload(reportSpec);
  const completed = await upload(reportSpec),
    reportId = (await completed.finish()) as Id<"reports">;
  const unknown = await t.run((ctx) => ctx.storage.store(new Blob(["unrelated school asset"])));
  // Lost upload response: its digest/window matches a lease but it has no claim.
  const unclaimed = await t.run((ctx) =>
    ctx.storage.store(
      new Blob(["%PDF-1.7\n" + "fictional test report".repeat(30000)], { type: "application/pdf" }),
    ),
  );
  const final = await t.run(
    async (ctx) => (await ctx.db.get("reports", reportId))!.file!.storageId,
  );
  vi.advanceTimersByTime(2 * 86400000);
  await t.mutation(internal.files.sweepUploads, { cursor: null });
  expect(await t.run((ctx) => ctx.storage.get(abandoned.staging))).toBeNull();
  expect(await t.run((ctx) => ctx.storage.get(unclaimed))).toBeNull();
  expect(await t.run(async (ctx) => (await ctx.storage.get(final)) !== null)).toBe(true);
  expect(await t.run(async (ctx) => (await ctx.storage.get(unknown)) !== null)).toBe(true);
  await t.mutation(internal.files.cleanup, {});
});

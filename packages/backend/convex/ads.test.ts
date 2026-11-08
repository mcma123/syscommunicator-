/// <reference types="vite/client" />
import aggregateTest from "@convex-dev/aggregate/test";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { localTime } from "./lib/workflowRules";
import type { UploadSpec } from "../client";

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts", "!./convex.config.ts"]);
const HOUR = 3600000;
const MIB = 1024 * 1024;
beforeEach(() => {
  vi.stubEnv("ENABLE_DEMO_ACCOUNTS", "true");
  vi.stubEnv("CONVEX_SITE_URL", "https://diligent-bass-226.convex.site");
});
afterEach(() => vi.unstubAllEnvs());

const png = (size = 2048) => {
  const bytes = new Uint8Array(size);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
  return bytes.buffer;
};
const mp4 = (size = 4096, signature = "ftyp") => {
  const bytes = new Uint8Array(size);
  bytes.set([0, 0, 0, 24]);
  bytes.set(new TextEncoder().encode(signature), 4);
  return bytes.buffer;
};

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
    return { user, client: t.withIdentity({ subject: `${user._id}|${session}` }) };
  };
  const [admin, principal, teacher, parent, finance] = await Promise.all(
    ["admin", "principal", "teacher", "parent", "finance"].map((r) => login(`${r}@wgjs.example`)),
  );
  // The teacher's own class, which also contains one of the parent's children.
  const classId = await t.run(async (ctx) => {
    const a = await ctx.db
      .query("teachingAssignments")
      .withIndex("by_staffId", (q) => q.eq("staffId", teacher!.user._id))
      .first();
    return a!.classId;
  });
  // A group nobody in the parent's family belongs to.
  const emptyGroup = await t.run((ctx) =>
    ctx.db.insert("groups", { name: "Empty test group", createdBy: admin!.user._id }),
  );
  const upload = async (
    client: typeof admin.client,
    adId: string,
    body: ArrayBuffer,
    contentType: string,
    fileName: string,
  ) => {
    const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", body)), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
    const spec: UploadSpec = { kind: "ad", targetId: adId, values: {} };
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
    return client.action(api.files.finishUpload, { uploadId: lease.uploadId });
  };
  const now = Date.now();
  const adValues = (audience: unknown, extra: Record<string, string> = {}) => ({
    title: "Spring fair",
    caption: "Join us on the field.",
    linkUrl: "https://example.org/fair",
    linkLabel: "Learn more",
    startsAt: localTime(now - HOUR),
    endsAt: localTime(now + 24 * HOUR),
    audience: JSON.stringify(audience),
    popup: "true",
    ...extra,
  });
  const save = (client: typeof admin.client, values: Record<string, string>, itemId?: string) =>
    client.mutation(api.workflows.submit, {
      action: "adSave",
      values,
      ...(itemId ? { itemId: itemId as Id<"ads"> } : {}),
    });
  const act = (
    client: typeof admin.client,
    action: "adSubmit" | "adPublish" | "adReturn" | "adArchive",
    itemId: string,
    values: Record<string, string> = {},
  ) => client.mutation(api.workflows.submit, { action, itemId: itemId as Id<"ads">, values });
  const active = (client: typeof admin.client, at = Date.now()) =>
    client.query(api.ads.active, { now: Math.floor(at / 60000) * 60000 });
  return {
    t,
    admin: admin!,
    principal: principal!,
    teacher: teacher!,
    parent: parent!,
    finance: finance!,
    classId,
    emptyGroup,
    upload,
    adValues,
    save,
    act,
    active,
    now,
  };
}

describe("Ad Center", () => {
  it("requires approval for teacher ads and shows published ads to the class audience", async () => {
    const s = await setup();
    const classAudience = [{ kind: "Class", classId: s.classId }];
    // Teachers may target only their own classes.
    await expect(s.save(s.teacher.client, s.adValues([{ kind: "School" }]))).rejects.toThrow();
    const adId = await s.save(s.teacher.client, s.adValues(classAudience));
    // Submission and publication both need media; teachers cannot publish.
    await expect(s.act(s.teacher.client, "adSubmit", adId)).rejects.toThrow(/image or video/);
    await s.upload(s.teacher.client, adId, png(), "image/png", "fair.png");
    await expect(s.act(s.teacher.client, "adPublish", adId)).rejects.toThrow();
    await s.act(s.teacher.client, "adSubmit", adId);
    expect(await s.active(s.parent.client)).toEqual([]);

    await s.act(s.principal.client, "adPublish", adId);
    const [ad] = await s.active(s.parent.client);
    expect(ad).toMatchObject({
      id: adId,
      title: "Spring fair",
      linkUrl: "https://example.org/fair",
      popup: true,
      media: { kind: "image", contentType: "image/png" },
    });
    expect(ad!.media!.url).toMatch(/^https?:\/\//);
    expect(JSON.stringify(ad)).not.toMatch(/storageId/);

    // Outside the schedule window, nothing shows.
    expect(await s.active(s.parent.client, s.now - 2 * HOUR)).toEqual([]);
    expect(await s.active(s.parent.client, s.now + 25 * HOUR)).toEqual([]);
    // Finance has no linked learners in the class audience.
    expect(await s.active(s.finance.client)).toEqual([]);

    const actions = await s.t.run(async (ctx) =>
      (
        await ctx.db
          .query("auditLog")
          .withIndex("by_targetTable_and_targetId", (q) =>
            q.eq("targetTable", "ads").eq("targetId", adId),
          )
          .take(20)
      ).map((a) => a.action),
    );
    expect(actions).toEqual(
      expect.arrayContaining(["ad.created", "file.attached", "ad.submitted", "ad.published"]),
    );

    // Returning or archiving removes it from the parent feed.
    await s.act(s.principal.client, "adReturn", adId, { note: "Shorter caption please." });
    expect(await s.active(s.parent.client)).toEqual([]);
    await s.act(s.admin.client, "adPublish", adId);
    expect(await s.active(s.parent.client)).toHaveLength(1);
    await s.act(s.admin.client, "adArchive", adId);
    expect(await s.active(s.parent.client)).toEqual([]);
  });

  it("filters by audience and the module switch", async () => {
    const s = await setup();
    const school = await s.save(s.principal.client, s.adValues([{ kind: "School" }]));
    const group = await s.save(
      s.principal.client,
      s.adValues([{ kind: "Group", groupId: s.emptyGroup }], { title: "Group only" }),
    );
    for (const id of [school, group]) {
      await s.upload(s.principal.client, id, png(), "image/png", "poster.png");
      await s.act(s.principal.client, "adPublish", id);
    }
    expect((await s.active(s.parent.client)).map((a) => a.id)).toEqual([school]);
    await s.t.run(async (ctx) => {
      const school = (await ctx.db.query("schools").take(1))[0]!;
      await ctx.db.patch("schools", school._id, {
        featureFlags: { ...school.featureFlags, ads: false },
      });
    });
    expect(await s.active(s.parent.client)).toEqual([]);
  });

  it("denies parents and Finance every management path", async () => {
    const s = await setup();
    const adId = await s.save(s.principal.client, s.adValues([{ kind: "School" }]));
    for (const user of [s.parent, s.finance]) {
      await expect(s.save(user.client, s.adValues([{ kind: "School" }]))).rejects.toThrow();
      await expect(s.act(user.client, "adPublish", adId)).rejects.toThrow();
      await expect(
        user.client.query(api.schoolRead.page, {
          module: "ads",
          paginationOpts: { numItems: 10, cursor: null },
        }),
      ).rejects.toThrow();
      await expect(s.upload(user.client, adId, png(), "image/png", "poster.png")).rejects.toThrow();
    }
    // Another teacher's or a whole-school ad is not editable by a teacher.
    await expect(
      s.upload(s.teacher.client, adId, png(), "image/png", "poster.png"),
    ).rejects.toThrow();
    const page = await s.teacher.client.query(api.schoolRead.page, {
      module: "ads",
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(page.page).toEqual([]);
  });

  it("validates links, dates, media types, signatures and sizes", async () => {
    const s = await setup();
    const school = [{ kind: "School" }];
    for (const linkUrl of ["http://example.org", "javascript:alert(1)", "example.org"])
      await expect(s.save(s.principal.client, s.adValues(school, { linkUrl }))).rejects.toThrow(
        /https/,
      );
    await expect(
      s.save(s.principal.client, s.adValues(school, { endsAt: localTime(s.now - 2 * HOUR) })),
    ).rejects.toThrow(/end after/);

    const adId = await s.save(s.principal.client, s.adValues(school));
    await s.upload(s.principal.client, adId, mp4(), "video/mp4", "promo.mp4");
    expect(await s.active(s.parent.client)).toEqual([]); // still a draft
    await s.act(s.principal.client, "adPublish", adId);
    expect((await s.active(s.parent.client))[0]?.media).toMatchObject({
      kind: "video",
      contentType: "video/mp4",
    });

    await s.act(s.principal.client, "adReturn", adId);
    await expect(
      s.upload(s.principal.client, adId, mp4(4096, "free"), "video/mp4", "fake.mp4"),
    ).rejects.toThrow(/do not match/);
    await expect(
      s.upload(s.principal.client, adId, mp4(16 * MIB), "video/mp4", "long.mp4"),
    ).rejects.toThrow(/15 MiB/);
    await expect(
      s.upload(s.principal.client, adId, png(), "application/pdf", "doc.pdf"),
    ).rejects.toThrow(/PNG or JPEG image/);

    // Replacing media detaches the previous stored file for cleanup.
    const before = await s.t.run(async (ctx) => (await ctx.db.get("ads", adId as Id<"ads">))!);
    await s.upload(s.principal.client, adId, png(), "image/png", "replacement.png");
    const detached = await s.t.run((ctx) =>
      ctx.db
        .query("managedFiles")
        .withIndex("by_storageId", (q) => q.eq("storageId", before.media!.storageId))
        .unique(),
    );
    expect(detached?.detachedAt).toBeGreaterThan(0);
  });

  it("keeps videos out of other upload kinds", async () => {
    const s = await setup();
    await expect(
      s.principal.client.mutation(api.files.beginUpload, {
        spec: {
          kind: "resource",
          values: {
            title: "Clip",
            category: "Newsletters",
            audience: JSON.stringify([{ kind: "School" }]),
          },
        },
        fileName: "clip.mp4",
        contentType: "video/mp4",
        size: 4096,
        sha256: "a".repeat(64),
      }),
    ).rejects.toThrow(/PDF, PNG or JPEG/);
  });
});

/// <reference types="vite/client" />
import aggregateTest from "@convex-dev/aggregate/test";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { localTime } from "./lib/workflowRules";

const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts", "!./convex.config.ts"]);
const HOUR = 3600000;
const MB = 1024 * 1024;
const R2 = "https://account.r2.cloudflarestorage.com";

/** In-memory stand-in for the private R2 bucket, reached through the stubbed global fetch. */
const bucket = new Map<string, { bytes: Uint8Array; type: string }>();
const keyOf = (url: string) =>
  decodeURIComponent(new URL(url).pathname.replace(/^\/wynburg\//, ""));
async function fakeFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (!url.startsWith(R2)) throw new Error(`Unexpected fetch ${url}`);
  const key = keyOf(url);
  const method = (init.method ?? "GET").toUpperCase();
  const object = bucket.get(key);
  if (method === "DELETE") {
    bucket.delete(key);
    return new Response(null, { status: 204 });
  }
  if (!object) return new Response(null, { status: 404 });
  if (method === "HEAD")
    return new Response(null, {
      status: 200,
      headers: { "content-length": String(object.bytes.length), "content-type": object.type },
    });
  return new Response(object.bytes.slice(0, 16), { status: 206 });
}
/** What a browser does with the presigned PUT URL. */
const put = (uploadUrl: string, bytes: Uint8Array, type: string) =>
  bucket.set(keyOf(uploadUrl), { bytes, type });

const png = (size = 2048) => {
  const b = new Uint8Array(size);
  b.set([137, 80, 78, 71, 13, 10, 26, 10]);
  return b;
};
const mp4 = (size = 4096, sig = "ftyp") => {
  const b = new Uint8Array(size);
  b.set(new TextEncoder().encode(sig), 4);
  return b;
};

beforeEach(() => {
  bucket.clear();
  vi.stubEnv("ENABLE_DEMO_ACCOUNTS", "true");
  vi.stubEnv("CONVEX_SITE_URL", "https://diligent-bass-226.convex.site");
  vi.stubEnv("R2_ENDPOINT", R2);
  vi.stubEnv("R2_BUCKET", "wynburg");
  vi.stubEnv("R2_ACCESS_KEY_ID", "test-access-key");
  vi.stubEnv("R2_SECRET_ACCESS_KEY", "test-secret-key");
  vi.stubEnv("AD_MEDIA_SIGNING_KEY", "x".repeat(48));
  vi.stubGlobal("fetch", fakeFetch);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
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
    return { user, client: t.withIdentity({ subject: `${user._id}|${session}` }) };
  };
  const [admin, principal, teacher, parent, finance] = await Promise.all(
    ["admin", "principal", "teacher", "parent", "finance"].map((r) => login(`${r}@wgjs.example`)),
  );
  const classId = await t.run(async (ctx) => {
    const a = await ctx.db
      .query("teachingAssignments")
      .withIndex("by_staffId", (q) => q.eq("staffId", teacher!.user._id))
      .first();
    return a!.classId;
  });
  const emptyGroup = await t.run((ctx) =>
    ctx.db.insert("groups", { name: "Empty test group", createdBy: admin!.user._id }),
  );
  type Client = typeof admin.client;
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
  const save = (client: Client, values: Record<string, string>, itemId?: string) =>
    client.mutation(api.workflows.submit, {
      action: "adSave",
      values,
      ...(itemId ? { itemId: itemId as Id<"ads"> } : {}),
    });
  const act = (
    client: Client,
    action: "adSubmit" | "adPublish" | "adReturn" | "adArchive",
    itemId: string,
    values: Record<string, string> = {},
  ) => client.mutation(api.workflows.submit, { action, itemId: itemId as Id<"ads">, values });
  /** Full composer flow: reserve → PUT to R2 → verify. */
  const upload = async (
    client: Client,
    adId: string,
    bytes: Uint8Array,
    type: string,
    fileName: string,
    declaredSize = bytes.length,
  ) => {
    const { mediaId, uploadUrl } = await client.action(api.ads.prepareUpload, {
      adId: adId as Id<"ads">,
      fileName,
      contentType: type,
      size: declaredSize,
    });
    expect(uploadUrl).toContain("X-Amz-Signature=");
    put(uploadUrl, bytes, type);
    return client.action(api.ads.finishUpload, { mediaId });
  };
  const active = (client: Client, at = Date.now()) =>
    client.query(api.ads.active, { now: Math.floor(at / 60000) * 60000 });
  const gateway = (url: string) => t.fetch(url.replace(/^https?:\/\/[^/]+/, ""));
  return {
    t,
    admin: admin!,
    principal: principal!,
    teacher: teacher!,
    parent: parent!,
    finance: finance!,
    classId,
    emptyGroup,
    adValues,
    save,
    act,
    upload,
    active,
    gateway,
    now,
  };
}

describe("Ad Center with Cloudflare R2 media", () => {
  it("runs the teacher approval flow and serves media through the signed gateway", async () => {
    const s = await setup();
    const classAudience = [{ kind: "Class", classId: s.classId }];
    await expect(s.save(s.teacher.client, s.adValues([{ kind: "School" }]))).rejects.toThrow();
    const adId = await s.save(s.teacher.client, s.adValues(classAudience));
    await expect(s.act(s.teacher.client, "adSubmit", adId)).rejects.toThrow(/picture or video/);

    await s.upload(s.teacher.client, adId, png(), "image/png", "poster.png");
    await s.upload(s.teacher.client, adId, mp4(), "video/mp4", "clip.mp4");
    const editorItems = await s.teacher.client.query(api.ads.media, { adId: adId as Id<"ads"> });
    expect(editorItems.map((i) => i.kind)).toEqual(["image", "video"]);
    expect(bucket.size).toBe(2);

    // Editors can preview drafts; the parent-scope link refuses unpublished ads.
    const preview = await s.gateway(editorItems[0]!.url);
    expect(preview.status).toBe(302);
    expect(preview.headers.get("location")).toMatch(
      /^https:\/\/account\.r2\.cloudflarestorage\.com\/wynburg\/ads\//,
    );
    expect(preview.headers.get("location")).toContain("X-Amz-Signature=");
    const parentScope = editorItems[0]!.url.replace("s=e", "s=p");
    expect((await s.gateway(parentScope)).status).toBe(404);

    await expect(s.act(s.teacher.client, "adPublish", adId)).rejects.toThrow();
    await s.act(s.teacher.client, "adSubmit", adId);
    expect(await s.active(s.parent.client)).toEqual([]);
    await s.act(s.principal.client, "adPublish", adId);

    const [ad] = await s.active(s.parent.client);
    expect(ad!.items.map((i) => i.kind)).toEqual(["image", "video"]);
    expect(JSON.stringify(ad)).not.toMatch(/ads\/|storage|X-Amz/);
    const served = await s.gateway(ad!.items[1]!.url);
    expect(served.status).toBe(302);
    expect(served.headers.get("cache-control")).toBe("private, max-age=600");
    // Tampered or malformed signatures are refused.
    const tampered = ad!.items[0]!.url.replace(/sig=([a-f0-9])/, (_m, c: string) =>
      c === "0" ? "sig=1" : "sig=0",
    );
    expect((await s.gateway(tampered)).status).toBe(404);
    expect((await s.gateway(ad!.items[0]!.url.replace(/sig=[a-f0-9]+/, "sig=zz"))).status).toBe(
      403,
    );

    // Outside the schedule nothing shows; archiving revokes existing links.
    expect(await s.active(s.parent.client, s.now - 2 * HOUR)).toEqual([]);
    expect(await s.active(s.finance.client)).toEqual([]);
    await s.act(s.principal.client, "adArchive", adId);
    expect(await s.active(s.parent.client)).toEqual([]);
    expect((await s.gateway(ad!.items[0]!.url)).status).toBe(404);

    const actions = await s.t.run(async (ctx) =>
      (
        await ctx.db
          .query("auditLog")
          .withIndex("by_targetTable_and_targetId", (q) =>
            q.eq("targetTable", "ads").eq("targetId", adId),
          )
          .take(30)
      ).map((a) => a.action),
    );
    expect(actions).toEqual(
      expect.arrayContaining([
        "ad.created",
        "ad.mediaRequested",
        "file.attached",
        "ad.submitted",
        "ad.published",
        "ad.archived",
      ]),
    );
  });

  it("validates types, sizes, contents and the item limit, deleting rejected objects", async () => {
    const s = await setup();
    const adId = await s.save(s.principal.client, s.adValues([{ kind: "School" }]));
    const prepare = (fileName: string, contentType: string, size: number) =>
      s.principal.client.action(api.ads.prepareUpload, {
        adId: adId as Id<"ads">,
        fileName,
        contentType,
        size,
      });
    await expect(prepare("anim.gif", "image/gif", 2048)).rejects.toThrow(/PNG, JPEG or WebP/);
    await expect(prepare("poster.png", "image/png", 11 * MB)).rejects.toThrow(/10 MB/);
    await expect(prepare("long.mp4", "video/mp4", 51 * MB)).rejects.toThrow(/50 MB/);
    await expect(prepare("clip.mp4", "image/png", 2048)).rejects.toThrow();
    await prepare("tour.mov", "video/quicktime", 4096);

    await expect(
      s.upload(s.principal.client, adId, png(), "image/png", "a.png", 9999),
    ).rejects.toThrow(/does not match/);
    await expect(
      s.upload(s.principal.client, adId, mp4(4096, "free"), "video/mp4", "fake.mp4"),
    ).rejects.toThrow(/contents/);
    expect([...bucket.keys()]).toEqual([]);
    expect(await s.principal.client.query(api.ads.media, { adId: adId as Id<"ads"> })).toEqual([]);

    // The pending MOV reservation counts toward the limit until it expires.
    for (let i = 0; i < 9; i++)
      await s.upload(s.principal.client, adId, png(), "image/png", `p${i}.png`);
    await expect(prepare("p10.png", "image/png", 2048)).rejects.toThrow(/up to 10/);
  });

  it("denies other users and protects published media", async () => {
    const s = await setup();
    const adId = await s.save(s.principal.client, s.adValues([{ kind: "School" }]));
    for (const user of [s.parent, s.finance, s.teacher])
      await expect(
        user.client.action(api.ads.prepareUpload, {
          adId: adId as Id<"ads">,
          fileName: "x.png",
          contentType: "image/png",
          size: 2048,
        }),
      ).rejects.toThrow();
    await expect(
      s.parent.client.query(api.ads.media, { adId: adId as Id<"ads"> }),
    ).rejects.toThrow();

    const first = await s.upload(s.principal.client, adId, png(), "image/png", "one.png");
    const second = await s.upload(s.principal.client, adId, png(), "image/png", "two.png");
    await s.principal.client.mutation(api.ads.moveMedia, { mediaId: second, direction: -1 });
    const order = await s.principal.client.query(api.ads.media, { adId: adId as Id<"ads"> });
    expect(order.map((i) => i.fileName)).toEqual(["two.png", "one.png"]);

    await s.act(s.principal.client, "adPublish", adId);
    await expect(
      s.principal.client.mutation(api.ads.removeMedia, { mediaId: first }),
    ).rejects.toThrow(/draft/);
    await expect(
      s.upload(s.principal.client, adId, png(), "image/png", "three.png"),
    ).rejects.toThrow(/draft/);

    // The legacy Convex-storage ad upload path is closed.
    await expect(
      s.principal.client.mutation(api.files.beginUpload, {
        spec: { kind: "ad", targetId: adId, values: {} },
        fileName: "x.png",
        contentType: "image/png",
        size: 2048,
        sha256: "a".repeat(64),
      }),
    ).rejects.toThrow(/composer/);
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
    const visible = await s.active(s.parent.client);
    expect(visible.map((a) => a.id)).toEqual([school]);
    await s.t.run(async (ctx) => {
      const row = (await ctx.db.query("schools").take(1))[0]!;
      await ctx.db.patch("schools", row._id, {
        featureFlags: { ...row.featureFlags, ads: false },
      });
    });
    expect(await s.active(s.parent.client)).toEqual([]);
    expect((await s.gateway(visible[0]!.items[0]!.url)).status).toBe(404);
  });

  it("removes media from R2 after it has been detached for a day", async () => {
    const s = await setup();
    const adId = await s.save(s.principal.client, s.adValues([{ kind: "School" }]));
    const mediaId = await s.upload(s.principal.client, adId, png(), "image/png", "old.png");
    await s.principal.client.mutation(api.ads.removeMedia, { mediaId });
    expect(bucket.size).toBe(1);
    await s.t.run((ctx) =>
      ctx.db.patch("adMedia", mediaId, { detachedAt: Date.now() - 2 * 86400000 }),
    );
    await s.t.action(internal.ads.cleanupMedia, {});
    expect(bucket.size).toBe(0);
    expect(await s.t.run((ctx) => ctx.db.get("adMedia", mediaId))).toBeNull();
  });

  it("gives each login its own session marker for popups", async () => {
    const s = await setup();
    const first = await s.parent.client.query(api.ads.session, {});
    const user = s.parent.user;
    const again = await s.t.run((ctx) =>
      ctx.db.insert("authSessions", { userId: user._id, expirationTime: Date.now() + 86400000 }),
    );
    const second = await s.t
      .withIdentity({ subject: `${user._id}|${again}` })
      .query(api.ads.session, {});
    expect(typeof first).toBe("number");
    expect(second).not.toBe(first);
  });

  it("validates links and dates", async () => {
    const s = await setup();
    const school = [{ kind: "School" }];
    for (const linkUrl of ["http://example.org", "javascript:alert(1)", "example.org"])
      await expect(s.save(s.principal.client, s.adValues(school, { linkUrl }))).rejects.toThrow(
        /https/,
      );
    await expect(
      s.save(s.principal.client, s.adValues(school, { endsAt: localTime(s.now - 2 * HOUR) })),
    ).rejects.toThrow(/end after/);
    await s.save(s.principal.client, s.adValues(school, { linkUrl: "", linkLabel: "" }));
  });
});

import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import type { ModulePage } from "@school-connect/core/live";
import {
  useConvex,
  useMutation,
  usePaginatedQuery,
  useAction,
  useQueries,
  useConvexConnectionState,
  type RequestForQueries,
} from "convex/react";
import {
  Component,
  createElement,
  Fragment,
  useState,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import type { OptimisticLocalStore } from "convex/browser";
import type { SchoolModule } from "@school-connect/core/permissions";
import { api, type ReadInput, type RecordId } from "./client";
import type { Id } from "./convex/_generated/dataModel";

/** Updates only existing, authorized query results; Convex rolls this back on failure. */
export function optimisticReceipt(
  store: OptimisticLocalStore,
  { noticeId, acknowledge }: { noticeId: Id<"notices">; acknowledge: boolean },
) {
  for (const query of store.getAllQueries(api.schoolData.list)) {
    if (query.args.module !== "messages" || !query.value) continue;
    store.setQuery(api.schoolData.list, query.args, {
      ...query.value,
      records: query.value.records.map((r) =>
        r.id === noticeId ? { ...r, read: true, acknowledged: acknowledge || r.acknowledged } : r,
      ),
    });
  }
  for (const query of store.getAllQueries(api.schoolRead.page)) {
    if (query.args.module !== "messages" || !query.value) continue;
    store.setQuery(api.schoolRead.page, query.args, {
      ...query.value,
      page: query.value.page.map((r) =>
        r.id === noticeId ? { ...r, read: true, acknowledged: acknowledge || r.acknowledged } : r,
      ),
    });
  }
  for (const query of store.getAllQueries(api.schoolRead.detail)) {
    if (query.args.module !== "messages" || query.value?.record.id !== noticeId) continue;
    store.setQuery(api.schoolRead.detail, query.args, {
      ...query.value,
      record: {
        ...query.value.record,
        read: true,
        acknowledged: acknowledge || query.value.record.acknowledged,
      },
    });
  }
}
export function useSchoolModule(
  module: SchoolModule,
  enabled: boolean,
  learnerId?: Id<"learners">,
) {
  const [retrying, setRetrying] = useState(false);
  useEffect(() => {
    if (!retrying) return;
    const timer = setTimeout(() => setRetrying(false), 100);
    return () => clearTimeout(timer);
  }, [retrying]);
  const requests = useMemo(() => {
    const next: RequestForQueries = {};
    if (enabled && !retrying)
      next["module"] = {
        query: api.schoolData.list,
        args: { module, ...(learnerId ? { learnerId } : {}) },
      };
    return next;
  }, [module, enabled, learnerId, retrying]);
  const results = useQueries(requests);
  const result: ModulePage | Error | undefined =
    enabled && !retrying ? results["module"] : undefined;
  return {
    data: result instanceof Error ? undefined : result,
    status: !enabled
      ? ("idle" as const)
      : result instanceof Error
        ? ("error" as const)
        : result === undefined
          ? ("loading" as const)
          : ("ready" as const),
    retry: () => setRetrying(true),
  };
}
export function useNoticeReceipt() {
  return useMutation(api.notices.setReceipt).withOptimisticUpdate(optimisticReceipt);
}
export function useSchoolConnection() {
  const connection = useConvexConnectionState();
  return {
    connected: connection.isWebSocketConnected,
    hasEverConnected: connection.hasEverConnected,
    offline: connection.hasEverConnected && !connection.isWebSocketConnected,
  };
}

/** Native Convex pagination preserves reactive cursors, page splits and cached records. */
export function useSchoolRecords(input: ReadInput, enabled: boolean) {
  const result = usePaginatedQuery(api.schoolRead.page, enabled ? input : "skip", {
    initialNumItems: 25,
  });
  return {
    data: { records: result.results, truncated: false },
    status: !enabled
      ? ("idle" as const)
      : result.status === "LoadingFirstPage"
        ? ("loading" as const)
        : ("ready" as const),
    canLoadMore: result.status === "CanLoadMore",
    loadingMore: result.status === "LoadingMore",
    loadMore: () => result.loadMore(25),
    retry: () => {},
  };
}
export function useSchoolDetail(input: ReadInput, itemId?: string, enabled = true) {
  const serialized = JSON.stringify(input);
  const [retrying, setRetrying] = useState(false);
  useEffect(() => {
    if (!retrying) return;
    const timer = setTimeout(() => setRetrying(false), 100);
    return () => clearTimeout(timer);
  }, [retrying]);
  const requests = useMemo<RequestForQueries>(() => {
    const q: RequestForQueries = {};
    if (enabled && !retrying && itemId)
      q["detail"] = {
        query: api.schoolRead.detail,
        args: { ...JSON.parse(serialized), itemId: itemId as RecordId },
      };
    return q;
  }, [serialized, itemId, enabled, retrying]);
  const value = useQueries(requests)["detail"];
  return {
    data:
      value instanceof Error
        ? undefined
        : (value as import("@school-connect/core/live").RecordDetail | undefined),
    status: !enabled
      ? ("idle" as const)
      : value instanceof Error
        ? ("error" as const)
        : value === undefined
          ? ("loading" as const)
          : ("ready" as const),
    retry: () => setRetrying(true),
  };
}
/** Platform-specific fallback renders errors without leaking server diagnostics. */
export class SchoolDataBoundary extends Component<
  { children: ReactNode; fallback: (retry: () => void) => ReactNode },
  { failed: boolean; generation: number }
> {
  override state = { failed: false, generation: 0 };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    return this.state.failed
      ? this.props.fallback(() =>
          this.setState((s) => ({ failed: false, generation: s.generation + 1 })),
        )
      : createElement(Fragment, { key: this.state.generation }, this.props.children);
  }
}
export function useSchoolDashboard(
  enabled: boolean,
  learnerId?: import("./convex/_generated/dataModel").Id<"learners">,
) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 60000) * 60000);
  useEffect(() => {
    const timer = setInterval(() => setNow(Math.floor(Date.now() / 60000) * 60000), 60000);
    return () => clearInterval(timer);
  }, []);
  const [retrying, setRetrying] = useState(false);
  useEffect(() => {
    if (!retrying) return;
    const timer = setTimeout(() => setRetrying(false), 100);
    return () => clearTimeout(timer);
  }, [retrying]);
  const [failure, setFailure] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const advance = useAction(api.dashboard.advance);
  const requests = useMemo<RequestForQueries>(() => {
    const q: RequestForQueries = {};
    if (enabled && !retrying)
      q["dashboard"] = {
        query: api.dashboard.current,
        args: { now, ...(learnerId ? { learnerId } : {}) },
      };
    return q;
  }, [enabled, now, learnerId, retrying]);
  const value = useQueries(requests)["dashboard"];
  const data =
    value instanceof Error
      ? undefined
      : (value as import("@school-connect/core/live").DashboardState | undefined);
  const busy = useRef(false);
  useEffect(() => {
    if (!enabled || !data || data.ready || failure || busy.current) return;
    busy.current = true;
    void advance(learnerId ? { learnerId } : {})
      .catch(() => {
        setFailure(true);
      })
      .finally(() => {
        busy.current = false;
        setAttempt((v) => v + 1);
      });
  }, [enabled, data?.revision, data?.progress, data?.ready, learnerId, advance, failure, attempt]);
  return {
    data,
    status:
      value instanceof Error || failure
        ? ("error" as const)
        : !data?.ready
          ? ("loading" as const)
          : ("ready" as const),
    retry: () => {
      setFailure(false);
      setRetrying(true);
      setAttempt((v) => v + 1);
    },
  };
}

/** Running ads for the signed-in viewer; `now` ticks each minute so start/end times apply live. */
export function useSchoolAds(enabled: boolean) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 60000) * 60000);
  useEffect(() => {
    const timer = setInterval(() => setNow(Math.floor(Date.now() / 60000) * 60000), 60000);
    return () => clearInterval(timer);
  }, []);
  const requests = useMemo<RequestForQueries>(() => {
    const q: RequestForQueries = {};
    if (enabled) q["ads"] = { query: api.ads.active, args: { now } };
    return q;
  }, [enabled, now]);
  const value = useQueries(requests)["ads"];
  const ads =
    value instanceof Error
      ? []
      : ((value as import("@school-connect/core/live").PublicAd[] | undefined) ?? []);
  return {
    ads,
    status:
      value instanceof Error
        ? ("error" as const)
        : value === undefined
          ? ("loading" as const)
          : ("ready" as const),
  };
}

/** Content type for an upload chosen by file name; the server re-validates name, type and signature. */
export function uploadContentType(name: string) {
  return /\.pdf$/i.test(name)
    ? "application/pdf"
    : /\.png$/i.test(name)
      ? "image/png"
      : /\.mp4$/i.test(name)
        ? "video/mp4"
        : /\.webm$/i.test(name)
          ? "video/webm"
          : "image/jpeg";
}

export function useSchoolWorkflows(
  module: import("@school-connect/core/live").ReadModule,
  enabled: boolean,
  itemId?: string,
  learnerId?: Id<"learners">,
) {
  const convex = useConvex();
  const requests = useMemo<RequestForQueries>(() => {
    const q: RequestForQueries = {};
    if (enabled)
      q["forms"] = {
        query: api.workflowForms.forms,
        args: {
          module,
          ...(itemId ? { itemId: itemId as RecordId } : {}),
          ...(learnerId ? { learnerId } : {}),
        },
      };
    return q;
  }, [module, enabled, itemId, learnerId]);
  const value = useQueries(requests)["forms"];
  const write = useMutation(api.workflows.submit),
    beginUpload = useMutation(api.files.beginUpload),
    claimUpload = useMutation(api.files.claimUpload),
    finishUpload = useAction(api.files.finishUpload),
    prepareDownload = useAction(api.files.prepareDownload),
    generateReceipt = useAction(api.receiptFiles.generate),
    resourceStatus = useMutation(api.files.resourceStatus),
    removeAttachment = useMutation(api.files.removeAttachment),
    invite = useAction(api.onboarding.invite);
  const submit = async (
    input: import("@school-connect/core/workflows").WorkflowInput,
    file?: import("@school-connect/core/workflows").WorkflowFile,
  ): Promise<import("@school-connect/core/workflows").WorkflowOutcome> => {
    const s = input.values;
    if (["reportCreate", "noticeAttach", "resourceCreate", "adMedia"].includes(input.action)) {
      if (!file) throw new Error("Choose a file first.");
      const kind =
        input.action === "reportCreate"
          ? "report"
          : input.action === "noticeAttach"
            ? "notice"
            : input.action === "adMedia"
              ? "ad"
              : "resource";
      const contentType = uploadContentType(file.name);
      const digest = bytesToHex(sha256(new Uint8Array(file.bytes)));
      const lease = await beginUpload({
        spec: { kind, ...(input.itemId ? { targetId: input.itemId } : {}), values: s },
        fileName: file.name,
        contentType,
        size: file.bytes.byteLength,
        sha256: digest,
      });
      const response = await fetch(lease.uploadUrl, {
        method: "POST",
        headers: { "Content-Type": contentType },
        body: file.bytes,
      });
      if (!response.ok) throw new Error("File upload failed. Please try again.");
      const uploaded: unknown = await response.json();
      if (
        !uploaded ||
        typeof uploaded !== "object" ||
        !("storageId" in uploaded) ||
        typeof uploaded.storageId !== "string"
      )
        throw new Error("Upload response was invalid.");
      await claimUpload({
        uploadId: lease.uploadId,
        storageId: uploaded.storageId as Id<"_storage">,
      });
      return { id: await finishUpload({ uploadId: lease.uploadId }) };
    }
    if (
      ["reportDownload", "noticeDownload", "resourceDownload", "receiptDownload"].includes(
        input.action,
      )
    ) {
      const kind =
        input.action === "reportDownload"
          ? "report"
          : input.action === "noticeDownload"
            ? "notice"
            : input.action === "receiptDownload"
              ? "receipt"
              : "resource";
      const id = kind === "receipt" ? (s["receiptId"] ?? "") : (input.itemId ?? "");
      if (kind === "receipt") await generateReceipt({ receiptId: id as Id<"receipts"> });
      const grant = await prepareDownload({
        target: { kind, id, ...(kind === "notice" ? { slot: Number(s["slot"]) } : {}) },
      });
      return {
        id: input.itemId ?? id,
        download: await convex.query(api.files.downloadUrl, { ...grant, now: Date.now() }),
      };
    }
    if (input.action === "resourcePublish" || input.action === "resourceArchive")
      return {
        id: await resourceStatus({
          resourceId: input.itemId as Id<"resources">,
          publish: input.action === "resourcePublish",
        }),
      };
    if (input.action === "noticeRemoveAttachment")
      return {
        id: await removeAttachment({
          noticeId: input.itemId as Id<"notices">,
          slot: Number(s["slot"]),
        }),
      };
    if (input.action === "invite") {
      const staff = s["kind"] === "Staff";
      return {
        id: await invite({
          email: s["email"] ?? "",
          kind: staff ? "Staff" : "Guardian",
          ...(staff
            ? { staffRole: s["staffRole"] as import("@school-connect/core/domain").StaffRole }
            : {}),
          learnerIds: s["learnerId"] ? [s["learnerId"] as Id<"learners">] : [],
        }),
      };
    }

    return {
      id: await write({
        ...input,
        ...(input.itemId ? { itemId: input.itemId as RecordId } : {}),
      } as import("convex/server").FunctionArgs<typeof api.workflows.submit>),
    };
  };
  return {
    forms:
      value instanceof Error || !enabled
        ? []
        : ((value ?? []) as import("@school-connect/core/workflows").WorkflowForm[]),
    status: !enabled
      ? ("idle" as const)
      : value instanceof Error
        ? ("error" as const)
        : value === undefined
          ? ("loading" as const)
          : ("ready" as const),
    submit,
  };
}
export function workflowError(error: unknown) {
  const value = error as { data?: { message?: unknown } };
  return typeof value?.data?.message === "string"
    ? value.data.message
    : "Could not save this change. Check your inputs, school permissions and connection, then try again.";
}

export function useSchoolNotifications(enabled: boolean, noticeId?: Id<"notices">) {
  const requests = useMemo<RequestForQueries>(() => {
    const queries: RequestForQueries = {};
    if (enabled) queries["notifications"] = { query: api.notifications.configuration, args: {} };
    return queries;
  }, [enabled]);
  const config = useQueries(requests)["notifications"];
  const args = useMemo(() => (noticeId ? { noticeId } : {}), [noticeId]);
  const history = usePaginatedQuery(api.notifications.history, enabled ? args : "skip", {
    initialNumItems: 15,
  });
  const retry = useMutation(api.notifications.retry);
  return {
    configuration:
      config instanceof Error || !enabled
        ? undefined
        : (config as import("./client").NotificationConfiguration | undefined),
    error: config instanceof Error,
    records: enabled ? history.results : [],
    loading: history.status === "LoadingFirstPage",
    canLoadMore: history.status === "CanLoadMore",
    loadingMore: history.status === "LoadingMore",
    loadMore: () => history.loadMore(15),
    retry,
  };
}

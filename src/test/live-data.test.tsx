import { act, renderHook, cleanup } from "@testing-library/react";
import { afterEach, describe, it, expect, vi } from "vitest";
import type { ModulePage } from "@school-connect/core/live";
import {
  useSchoolModule,
  useSchoolDashboard,
  useSchoolConnection,
  optimisticReceipt,
} from "@school-connect/backend/react";
import { api } from "@school-connect/backend/client";
import type { Id } from "@school-connect/backend/dataModel";
import type { OptimisticLocalStore } from "convex/browser";
const source = vi.hoisted(() => ({
  result: undefined as ModulePage | Error | undefined,
  dashboard: undefined as import("@school-connect/core/live").DashboardState | Error | undefined,
  advance: vi.fn(async () => null),
  connected: true,
  ever: true,
  queries: vi.fn(),
}));
vi.mock("convex/react", () => ({
  useQueries: (requests: unknown) => {
    source.queries(requests);
    return { module: source.result, dashboard: source.dashboard };
  },
  useConvexConnectionState: () => ({
    isWebSocketConnected: source.connected,
    hasEverConnected: source.ever,
  }),
  useMutation: vi.fn(),
  useAction: () => source.advance,
}));
afterEach(() => {
  cleanup();
  source.result = undefined;
  source.dashboard = undefined;
  source.connected = true;
  source.ever = true;
  vi.clearAllMocks();
  vi.useRealTimers();
});
describe("shared live data hook", () => {
  it("distinguishes loading, empty, failed and recovering subscriptions without mock fallback", () => {
    const hook = renderHook(() => useSchoolModule("messages", true));
    expect(hook.result.current.status).toBe("loading");
    source.result = { records: [], truncated: false };
    hook.rerender();
    expect(hook.result.current.status).toBe("ready");
    expect(hook.result.current.data?.records).toEqual([]);
    source.result = new Error("Backend refused");
    hook.rerender();
    expect(hook.result.current.status).toBe("error");
    expect(hook.result.current.data).toBeUndefined();
    vi.useFakeTimers();
    act(() => hook.result.current.retry());
    expect(source.queries).toHaveBeenLastCalledWith({});
    source.result = { records: [], truncated: false };
    act(() => vi.advanceTimersByTime(100));
    expect(hook.result.current.status).toBe("ready");
  });
  it("unsubscribes and hides old records when the session is disabled", () => {
    source.result = { records: [], truncated: false };
    const hook = renderHook(({ enabled }) => useSchoolModule("messages", enabled), {
      initialProps: { enabled: true },
    });
    hook.rerender({ enabled: false });
    expect(hook.result.current.data).toBeUndefined();
    expect(hook.result.current.status).toBe("idle");
    expect(source.queries).toHaveBeenLastCalledWith({});
  });
  it("derives offline status from the actual Convex socket and distinguishes initial connection", () => {
    source.connected = false;
    source.ever = false;
    const hook = renderHook(useSchoolConnection);
    expect(hook.result.current.offline).toBe(false);
    source.ever = true;
    hook.rerender();
    expect(hook.result.current.offline).toBe(true);
    source.connected = true;
    hook.rerender();
    expect(hook.result.current.offline).toBe(false);
  });
  it("optimistically updates only loaded notice pages and never clears an acknowledgement", () => {
    const page: ModulePage = {
      truncated: false,
      records: [
        {
          id: "notice-id",
          title: "Live",
          body: "",
          subtitle: "",
          status: "Published",
          at: null,
          amountCents: null,
          read: false,
          acknowledged: true,
          canAcknowledge: true,
        },
      ],
    };
    const store = {
      getAllQueries: vi.fn((query) =>
        query !== api.schoolData.list
          ? []
          : [
              { args: { module: "messages" }, value: page },
              { args: { module: "payments" }, value: page },
              { args: { module: "messages" }, value: undefined },
            ],
      ),
      setQuery: vi.fn(),
    } as unknown as OptimisticLocalStore;
    optimisticReceipt(store, { noticeId: "notice-id" as Id<"notices">, acknowledge: false });
    expect(store.setQuery).toHaveBeenCalledTimes(1);
    expect(store.setQuery).toHaveBeenCalledWith(
      api.schoolData.list,
      { module: "messages" },
      { ...page, records: [{ ...page.records[0], read: true, acknowledged: true }] },
    );
  });
});

it("updates authorized paginated/detail receipt caches together and preserves acknowledged status", () => {
  const record = {
    id: "notice-id",
    title: "Notice",
    body: "",
    subtitle: "",
    status: "Published",
    at: null,
    amountCents: null,
    read: false,
    acknowledged: true,
    canAcknowledge: true,
  };
  const page = { page: [record], isDone: true, continueCursor: "end" };
  const detail = { record, related: [] };
  const store = {
    getAllQueries: vi.fn((query) =>
      query === api.schoolRead.page
        ? [
            {
              args: { module: "messages", paginationOpts: { numItems: 25, cursor: null } },
              value: page,
            },
            { args: { module: "payments" }, value: page },
          ]
        : query === api.schoolRead.detail
          ? [{ args: { module: "messages", itemId: record.id }, value: detail }]
          : [],
    ),
    setQuery: vi.fn(),
  } as unknown as OptimisticLocalStore;
  optimisticReceipt(store, { noticeId: record.id as Id<"notices">, acknowledge: false });
  expect(store.setQuery).toHaveBeenCalledTimes(2);
  expect(store.setQuery).toHaveBeenCalledWith(
    api.schoolRead.page,
    expect.objectContaining({ module: "messages" }),
    { ...page, page: [{ ...record, read: true }] },
  );
  expect(store.setQuery).toHaveBeenCalledWith(
    api.schoolRead.detail,
    expect.objectContaining({ module: "messages" }),
    { ...detail, record: { ...record, read: true } },
  );
});

it("reopens a failed dashboard subscription on retry without treating partial totals as ready", () => {
  source.dashboard = new Error("Read failed");
  const hook = renderHook(() => useSchoolDashboard(true));
  expect(hook.result.current.status).toBe("error");
  vi.useFakeTimers();
  act(() => hook.result.current.retry());
  expect(source.queries).toHaveBeenLastCalledWith({});
  source.dashboard = {
    ready: true,
    progress: 1,
    revision: "current",
    unread: 2,
    pendingActions: 1,
    upcomingEvents: 3,
    amountDueCents: 0,
  };
  act(() => vi.advanceTimersByTime(100));
  expect(hook.result.current.status).toBe("ready");
  expect(source.advance).not.toHaveBeenCalled();
});

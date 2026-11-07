import { act, renderHook, cleanup } from "@testing-library/react";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { afterEach, it, expect, vi } from "vitest";
import type { ReactNode } from "react";
import type { ModulePage } from "@school-connect/core/live";
import { useSchoolModule, useSchoolRecords, useSchoolDetail } from "@school-connect/backend/react";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
it("keeps the real Convex subscription stable across renders and responds to source updates", async () => {
  const client = new ConvexReactClient("https://test.convex.cloud", {
    logger: false,
    unsavedChangesWarning: false,
  });
  let value: ModulePage | undefined;
  const listeners = new Set<() => void>();
  vi.spyOn(client, "watchQuery").mockReturnValue({
    onUpdate: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    localQueryResult: () => value,
    journal: () => undefined,
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ConvexProvider client={client}>{children}</ConvexProvider>
  );
  const hook = renderHook(({ enabled }) => useSchoolModule("messages", enabled), {
    wrapper,
    initialProps: { enabled: true },
  });
  expect(hook.result.current.status).toBe("loading");
  expect(listeners.size).toBe(1);
  hook.rerender({ enabled: true });
  expect(listeners.size).toBe(1);
  act(() => {
    value = { records: [], truncated: false };
    for (const notify of listeners) notify();
  });
  expect(hook.result.current.status).toBe("ready");
  hook.rerender({ enabled: false });
  expect(hook.result.current.data).toBeUndefined();
  expect(listeners.size).toBe(0);
  hook.unmount();
  await client.close();
});

it("uses real Convex pagination across empty pages, resets filters and directly subscribes to details", async () => {
  const client = new ConvexReactClient("https://test.convex.cloud", {
    logger: false,
    unsavedChangesWarning: false,
  });
  const record = {
    id: "outside-first-page",
    title: "Older record",
    body: "",
    subtitle: "",
    status: "Published",
    at: null,
    amountCents: null,
    read: false,
    acknowledged: false,
    canAcknowledge: false,
  };
  const watches = vi.spyOn(client, "watchQuery").mockImplementation((...input) => ({
    onUpdate: () => () => {},
    localQueryResult: () => {
      const args = input[1] ?? {};
      if ("itemId" in args) return { record, related: [] };
      if (args["search"]) return { page: [], isDone: true, continueCursor: "end" };
      const opts = args["paginationOpts"] as { cursor: string | null };
      return opts.cursor
        ? { page: [record], isDone: true, continueCursor: "end" }
        : { page: [], isDone: false, continueCursor: "second" };
    },
    journal: () => undefined,
  }));
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ConvexProvider client={client}>{children}</ConvexProvider>
  );
  const hook = renderHook(
    ({ search, enabled }) =>
      useSchoolRecords({ module: "messages", ...(search ? { search } : {}) }, enabled),
    { wrapper, initialProps: { search: "", enabled: true } },
  );
  expect(hook.result.current.data.records).toEqual([]);
  expect(hook.result.current.canLoadMore).toBe(true);
  act(() => hook.result.current.loadMore());
  expect(hook.result.current.data.records[0]?.id).toBe(record.id);
  expect(hook.result.current.canLoadMore).toBe(false);
  const count = watches.mock.calls.length;
  hook.rerender({ search: "", enabled: true });
  expect(watches.mock.calls.length).toBe(count);
  hook.rerender({ search: "Missing", enabled: true });
  expect(hook.result.current.data.records).toEqual([]);
  hook.rerender({ search: "", enabled: false });
  expect(hook.result.current.data.records).toEqual([]);
  expect(hook.result.current.status).toBe("idle");
  const detail = renderHook(() => useSchoolDetail({ module: "messages" }, record.id), { wrapper });
  expect(detail.result.current.data?.record.id).toBe(record.id);
  hook.unmount();
  detail.unmount();
  await client.close();
});

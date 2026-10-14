import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockRepository, initialState } from "../../packages/school-core/src";

afterEach(() => vi.unstubAllGlobals());

describe("shared school mock repository", () => {
  it("starts without structuredClone, as required by native runtimes", () => {
    vi.stubGlobal("structuredClone", undefined);
    expect(createMockRepository().getSnapshot()).toEqual(initialState);
  });

  it("isolates nested fixture data between repositories", () => {
    const first = createMockRepository();
    const second = createMockRepository();
    first.update((state) => {
      state.enquiries[0]!.messages[0]!.body = "Changed in the first client";
      state.attendance["Emma Williams"] = false;
      return { ...state };
    });
    expect(second.getSnapshot()).toEqual(initialState);
    expect(first.getSnapshot()).not.toEqual(second.getSnapshot());
  });

  it("retains snapshot identity until update and supports unsubscribe", () => {
    const repository = createMockRepository();
    const snapshot = repository.getSnapshot();
    const listener = vi.fn();
    const unsubscribe = repository.subscribe(listener);
    expect(repository.getSnapshot()).toBe(snapshot);
    repository.update((state) => ({ ...state, consent: true }));
    expect(repository.getSnapshot()).not.toBe(snapshot);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    repository.update((state) => ({ ...state, consent: false }));
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

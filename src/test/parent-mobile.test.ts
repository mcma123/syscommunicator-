import { describe, expect, it } from "vitest";
import { createMockRepository } from "@school-connect/core";
import {
  consentError,
  familyView,
  markNotice,
} from "../../apps/expo/src/features/school/parent-model";
describe("parent mobile demo", () => {
  it("keeps drafts private and scopes family actions to the selected learner", () => {
    const state = createMockRepository().getSnapshot();
    const family = familyView(state, "all");
    const noah = familyView(state, "noah");
    expect(family.notices.map((n) => n.id)).not.toContain("draft");
    expect(noah.notices.map((n) => n.id)).toEqual(["sports", "newsletter", "reading"]);
    expect(noah.events.map((e) => e.id)).not.toContain("trip");
    expect(noah.amountDue).toBe(0);
    expect(noah.consentDue).toBe(0);
    expect(family.amountDue).toBe(250);
  });
  it("counts read, consent, and payment changes from the same state", () => {
    const repository = createMockRepository();
    const before = familyView(repository.getSnapshot(), "all");
    repository.update((state) => markNotice(state, "excursion", true));
    expect(familyView(repository.getSnapshot(), "all").unread).toBe(before.unread - 1);
    expect(repository.getSnapshot().notices.find((n) => n.id === "excursion")?.acknowledged).toBe(
      true,
    );
    for (const payment of ["Failed", "Pending verification"] as const) {
      repository.update((state) => ({ ...state, payment }));
      expect(familyView(repository.getSnapshot(), "all").amountDue).toBe(250);
    }
    repository.update((state) => ({ ...state, payment: "Paid", consent: true }));
    expect(familyView(repository.getSnapshot(), "all")).toMatchObject({
      amountDue: 0,
      consentDue: 0,
    });
    expect(familyView(createMockRepository().getSnapshot(), "all").amountDue).toBe(250);
  });
  it("requires ten digits and permission for consent", () => {
    expect(consentError("abcdefghij", true)).toContain("10 digits");
    expect(consentError("082 123 4567", false)).toContain("permission");
    expect(consentError("+27 82 123 4567", true)).toBe("");
  });
  it("cannot acknowledge an unpublished draft", () => {
    const state = markNotice(createMockRepository().getSnapshot(), "draft", true);
    expect(state.notices.find((n) => n.id === "draft")?.acknowledged).toBeUndefined();
  });
});

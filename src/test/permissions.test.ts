import { describe, expect, it } from "vitest";
import { accessRolesFor, canAccessModule, SCHOOL_MODULES } from "@school-connect/core/permissions";
describe("shared module permissions", () => {
  it("keeps Finance in payments and account navigation", () => {
    for (const module of SCHOOL_MODULES)
      expect(canAccessModule("Finance", module)).toBe(
        ["home", "payments", "more", "profile"].includes(module),
      );
  });
  it("restricts teacher administration and denies unknown modules", () => {
    for (const module of ["people", "settings", "audit", "payments", "unknown"])
      expect(canAccessModule("Teacher", module)).toBe(false);
    expect(canAccessModule("Teacher", "attendance")).toBe(true);
    for (const role of ["Teacher", "Principal", "Administrator"] as const)
      expect(canAccessModule(role, "ads")).toBe(true);
    expect(canAccessModule("Parent", "ads")).toBe(false);
    expect(canAccessModule("Administrator", "ads", ["ads"])).toBe(false);
    expect(canAccessModule("Administrator", "unknown")).toBe(false);
    expect(canAccessModule([], "home")).toBe(false);
  });
  it("combines staff and explicit guardian grants without inventing Parent access", () => {
    expect(canAccessModule(accessRolesFor(["Finance"], false), "messages")).toBe(false);
    expect(canAccessModule(accessRolesFor(["Finance"], true), "messages")).toBe(true);
    expect(accessRolesFor([], false)).toEqual([]);
  });
});

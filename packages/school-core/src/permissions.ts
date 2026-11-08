import type { Role, StaffRole } from "./domain";

export const SCHOOL_MODULES = [
  "home",
  "messages",
  "calendar",
  "children",
  "resources",
  "payments",
  "forms",
  "contact",
  "more",
  "profile",
  "groups",
  "attendance",
  "conduct",
  "reports",
  "people",
  "settings",
  "audit",
  "ads",
] as const;
export type SchoolModule = (typeof SCHOOL_MODULES)[number];
export const MODULE_PERMISSIONS: Readonly<Record<Role, readonly SchoolModule[]>> = {
  Parent: [
    "home",
    "messages",
    "calendar",
    "children",
    "resources",
    "payments",
    "forms",
    "contact",
    "more",
    "profile",
  ],
  Teacher: [
    "home",
    "messages",
    "calendar",
    "children",
    "resources",
    "forms",
    "contact",
    "more",
    "profile",
    "groups",
    "attendance",
    "conduct",
    "reports",
    "ads",
  ],
  Principal: [
    "home",
    "messages",
    "calendar",
    "children",
    "resources",
    "payments",
    "forms",
    "contact",
    "more",
    "profile",
    "groups",
    "attendance",
    "conduct",
    "reports",
    "audit",
    "ads",
  ],
  Finance: ["home", "payments", "more", "profile"],
  Administrator: SCHOOL_MODULES,
};

/** Role grants combine; Parent is added only for actual linked guardians. Unknown modules fail closed. */
export function accessRolesFor(roles: readonly StaffRole[], hasLinkedLearners: boolean): Role[] {
  return hasLinkedLearners ? [...roles, "Parent"] : [...roles];
}
export function canAccessModule(
  roles: Role | readonly Role[],
  module: string,
  disabledModules: readonly string[] = [],
): boolean {
  if (disabledModules.includes(module)) return false;
  const grants = typeof roles === "string" ? [roles] : roles;
  return grants.some(
    (role) => MODULE_PERMISSIONS[role]?.some((allowed) => allowed === module) ?? false,
  );
}

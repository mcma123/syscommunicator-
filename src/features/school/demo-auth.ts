import type { Role } from "../../../packages/school-core/src";

export interface DemoAccount {
  id: string;
  name: string;
  role: Role;
  email: string;
}

// Public, fictional credentials for the frontend demo only.
export const DEMO_ACCOUNTS = [
  {
    id: "parent",
    name: "Jamie Williams",
    role: "Parent",
    email: "parent@wgjs.example",
    password: "ParentDemo!26",
  },
  {
    id: "teacher",
    name: "Sarah Jacobs",
    role: "Teacher",
    email: "teacher@wgjs.example",
    password: "TeacherDemo!26",
  },
  {
    id: "principal",
    name: "Amelia Davids",
    role: "Principal",
    email: "principal@wgjs.example",
    password: "PrincipalDemo!26",
  },
  {
    id: "finance",
    name: "Nadia Petersen",
    role: "Finance",
    email: "finance@wgjs.example",
    password: "FinanceDemo!26",
  },
  {
    id: "admin",
    name: "Alex Morgan",
    role: "Administrator",
    email: "admin@wgjs.example",
    password: "AdminDemo!26",
  },
] satisfies (DemoAccount & { password: string })[];

export function findDemoAccount(id: string | null): DemoAccount | null {
  const match = DEMO_ACCOUNTS.find((account) => account.id === id);
  return match ? { id: match.id, name: match.name, role: match.role, email: match.email } : null;
}

export function authenticateDemo(email: string, password: string): DemoAccount | null {
  const match = DEMO_ACCOUNTS.find(
    (account) => account.email === email.trim().toLowerCase() && account.password === password,
  );
  return findDemoAccount(match?.id ?? null);
}

export const STAFF_MODULES = new Set([
  "groups",
  "attendance",
  "conduct",
  "reports",
  "people",
  "audit",
  "settings",
]);

export function canAccessDemoModule(role: Role, module: string): boolean {
  return role !== "Parent" || !STAFF_MODULES.has(module);
}

import type { SchoolModule } from "@school-connect/core/permissions";
import { ModuleList } from "./parent-screens";
import { modules, type ModuleId } from "./modules";
/** Retained route adapter; staff modules now share authenticated live readers. */
export function ModulePlaceholder({ moduleId }: { moduleId: ModuleId }) {
  const module = modules.find((m) => m.id === moduleId)!;
  return <ModuleList module={moduleId as SchoolModule} title={module.title} />;
}

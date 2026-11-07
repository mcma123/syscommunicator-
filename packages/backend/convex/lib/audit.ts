import { invalidateDashboard } from "./dashboardState";
import type { MutationCtx } from "../_generated/server";
import type { Actor } from "./auth";
import type { TableNames } from "../_generated/dataModel";

export async function writeAudit(
  ctx: MutationCtx,
  actor: Actor,
  action: string,
  targetTable: TableNames,
  targetId: string,
  summary?: string,
) {
  await invalidateDashboard(ctx, targetTable, actor.user._id);
  return ctx.db.insert("auditLog", {
    actorId: actor.user._id,
    action,
    targetTable,
    targetId,
    ...(summary ? { summary } : {}),
  });
}

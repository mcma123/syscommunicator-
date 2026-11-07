import {
  v,
  type GenericValidator,
  type Infer,
  type ObjectType,
  type PropertyValidators,
} from "convex/values";
import {
  query,
  mutation,
  action,
  type QueryCtx,
  type MutationCtx,
  type ActionCtx,
} from "../_generated/server";
import { internal } from "../_generated/api";
import { hasRole, requireActor, denied, type Actor } from "./auth";
import { writeAudit } from "./audit";
import type { StaffRole } from "@school-connect/core/domain";

type ResultValidator = GenericValidator & { isOptional: "required" };
type Definition<A extends PropertyValidators, R extends ResultValidator, C> = {
  args: A;
  returns: R;
  handler: (ctx: C, args: ObjectType<A>) => Promise<Infer<R>> | Infer<R>;
};
export type AuthedQueryCtx = QueryCtx & { actor: Actor };
export type AuthedMutationCtx = MutationCtx & {
  actor: Actor;
  audit: (
    action: string,
    table: Parameters<typeof writeAudit>[3],
    id: string,
    summary?: string,
  ) => Promise<string>;
};
export type AuthedActionCtx = ActionCtx & { actor: Actor };
export function authedQuery<A extends PropertyValidators, R extends ResultValidator>(
  definition: Definition<A, R, AuthedQueryCtx>,
) {
  const argsValidator = v.object(definition.args);
  return query<typeof argsValidator, R, Promise<Infer<R>>, [ObjectType<A>]>({
    args: argsValidator,
    returns: definition.returns,
    handler: async (ctx, args) =>
      definition.handler({ ...ctx, actor: await requireActor(ctx) }, args as ObjectType<A>),
  });
}
export function authedMutation<A extends PropertyValidators, R extends ResultValidator>(
  definition: Definition<A, R, AuthedMutationCtx>,
) {
  const argsValidator = v.object(definition.args);
  return mutation<typeof argsValidator, R, Promise<Infer<R>>, [ObjectType<A>]>({
    args: argsValidator,
    returns: definition.returns,
    handler: async (ctx, args) => {
      const actor = await requireActor(ctx);
      let count = 0;
      const audit: AuthedMutationCtx["audit"] = async (verb, table, id, summary) => {
        const entry = await writeAudit(ctx, actor, verb, table, id, summary);
        count++;
        return entry;
      };
      const result = await definition.handler({ ...ctx, actor, audit }, args as ObjectType<A>);
      if (count === 0) throw new Error("Authenticated mutations must record an audit entry.");
      return result;
    },
  });
}
export function staffMutation<A extends PropertyValidators, R extends ResultValidator>(
  roles: readonly StaffRole[],
  definition: Definition<A, R, AuthedMutationCtx>,
) {
  return authedMutation({
    ...definition,
    handler: (ctx, args) => {
      if (!hasRole(ctx.actor, ...roles)) denied();
      return definition.handler(ctx, args);
    },
  });
}
export function authedAction<A extends PropertyValidators, R extends ResultValidator>(
  definition: Definition<A, R, AuthedActionCtx>,
) {
  const argsValidator = v.object(definition.args);
  return action<typeof argsValidator, R, Promise<Infer<R>>, [ObjectType<A>]>({
    args: argsValidator,
    returns: definition.returns,
    handler: async (ctx, args) => {
      const actor: Actor = await ctx.runQuery(internal.access.context, {});
      return definition.handler({ ...ctx, actor }, args as ObjectType<A>);
    },
  });
}
export function staffAction<A extends PropertyValidators, R extends ResultValidator>(
  roles: readonly StaffRole[],
  definition: Definition<A, R, AuthedActionCtx>,
) {
  return authedAction({
    ...definition,
    handler: (ctx, args) => {
      if (!hasRole(ctx.actor, ...roles)) denied();
      return definition.handler(ctx, args);
    },
  });
}

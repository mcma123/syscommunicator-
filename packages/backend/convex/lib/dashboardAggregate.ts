import { TableAggregate } from "@convex-dev/aggregate";
import { components } from "../_generated/api";
import type { DataModel, Id } from "../_generated/dataModel";
export const dashboardAggregate = new TableAggregate<{
  Namespace: Id<"dashboardBuilds">;
  Key: [string, number, number];
  DataModel: DataModel;
  TableName: "dashboardItems";
}>(components.dashboardAggregate, {
  namespace: (doc) => doc.buildId,
  sortKey: (doc) => [doc.kind, doc.pending ? 1 : 0, doc.at],
  sumValue: (doc) => doc.amount,
});

import { schoolConfig } from "../../packages/school-core/src";
import { createFileRoute } from "@tanstack/react-router";
import { AdvertiseUnsubscribe } from "@/features/school/advertise-page";

export const Route = createFileRoute("/advertise_/unsubscribe")({
  validateSearch: (search: Record<string, unknown>) => ({
    a: typeof search["a"] === "string" ? search["a"] : "",
    t: typeof search["t"] === "string" ? search["t"] : "",
  }),
  head: () => ({
    meta: [{ title: `Unsubscribe | ${schoolConfig.name}` }, { name: "robots", content: "noindex" }],
  }),
  component: Unsubscribe,
});

function Unsubscribe() {
  const { a, t } = Route.useSearch();
  return <AdvertiseUnsubscribe advertiserId={a} token={t} />;
}

import { schoolConfig } from "../../packages/school-core/src";
import { createFileRoute } from "@tanstack/react-router";
import { SchoolPortal } from "@/features/school/portal";
export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: `Settings | ${schoolConfig.name}` },
      {
        name: "description",
        content: `${schoolConfig.name} settings: your school community, connected.`,
      },
      { property: "og:title", content: `Settings | ${schoolConfig.name}` },
      {
        property: "og:description",
        content: `${schoolConfig.name} settings for parents and staff.`,
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <SchoolPortal module="settings" />,
});

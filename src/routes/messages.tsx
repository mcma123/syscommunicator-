import { schoolConfig } from "../../packages/school-core/src";
import { createFileRoute } from "@tanstack/react-router";
import { SchoolPortal } from "@/features/school/portal";
export const Route = createFileRoute("/messages")({
  head: () => ({
    meta: [
      { title: `Messages | ${schoolConfig.name}` },
      {
        name: "description",
        content: `${schoolConfig.name} messages: your school community, connected.`,
      },
      { property: "og:title", content: `Messages | ${schoolConfig.name}` },
      {
        property: "og:description",
        content: `${schoolConfig.name} messages for parents and staff.`,
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <SchoolPortal module="messages" />,
});

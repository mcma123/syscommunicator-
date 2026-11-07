import { schoolConfig } from "../../packages/school-core/src";
import { createFileRoute } from "@tanstack/react-router";
import { SchoolPortal } from "@/features/school/portal";
export const Route = createFileRoute("/groups")({
  head: () => ({
    meta: [
      { title: `Groups | ${schoolConfig.name}` },
      {
        name: "description",
        content: `${schoolConfig.name} groups: your school community, connected.`,
      },
      { property: "og:title", content: `Groups | ${schoolConfig.name}` },
      { property: "og:description", content: `${schoolConfig.name} groups for parents and staff.` },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <SchoolPortal module="groups" />,
});

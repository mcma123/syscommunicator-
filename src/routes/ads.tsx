import { schoolConfig } from "../../packages/school-core/src";
import { createFileRoute } from "@tanstack/react-router";
import { SchoolPortal } from "@/features/school/portal";
export const Route = createFileRoute("/ads")({
  head: () => ({
    meta: [
      { title: `Ad Center | ${schoolConfig.name}` },
      {
        name: "description",
        content: `${schoolConfig.name} Ad Center: your school community, connected.`,
      },
      { property: "og:title", content: `Ad Center | ${schoolConfig.name}` },
      { property: "og:description", content: `${schoolConfig.name} Ad Center for school staff.` },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <SchoolPortal module="ads" />,
});

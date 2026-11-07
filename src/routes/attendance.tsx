import { schoolConfig } from "../../packages/school-core/src";
import { createFileRoute } from "@tanstack/react-router";
import { SchoolPortal } from "@/features/school/portal";
export const Route = createFileRoute("/attendance")({
  head: () => ({
    meta: [
      { title: `Attendance | ${schoolConfig.name}` },
      {
        name: "description",
        content: `${schoolConfig.name} attendance: your school community, connected.`,
      },
      { property: "og:title", content: `Attendance | ${schoolConfig.name}` },
      {
        property: "og:description",
        content: `${schoolConfig.name} attendance for parents and staff.`,
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <SchoolPortal module="attendance" />,
});

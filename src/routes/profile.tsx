import { schoolConfig } from "../../packages/school-core/src";
import { createFileRoute } from "@tanstack/react-router";
import { SchoolPortal } from "@/features/school/portal";
export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: `Profile | ${schoolConfig.name}` },
      {
        name: "description",
        content: `${schoolConfig.name} profile: your school community, connected.`,
      },
      { property: "og:title", content: `Profile | ${schoolConfig.name}` },
      {
        property: "og:description",
        content: `${schoolConfig.name} profile for parents and staff.`,
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => <SchoolPortal module="profile" />,
});

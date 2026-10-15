import { schoolConfig } from "../../packages/school-core/src";
import { createFileRoute } from "@tanstack/react-router";
import { SchoolPortal } from "@/features/school/portal";
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `${schoolConfig.appName} | ${schoolConfig.subtitle}` },
      {
        name: "description",
        content: `${schoolConfig.appName}: ${schoolConfig.subtitle}. School notices, events and learner information in one place.`,
      },
    ],
  }),
  component: () => <SchoolPortal module="home" />,
});

import { schoolConfig } from "../../packages/school-core/src";
import { createFileRoute } from "@tanstack/react-router";
import { SchoolLogin } from "@/features/school/demo-login";

export const Route = createFileRoute("/signin")({
  head: () => ({
    meta: [
      { title: `Sign in | ${schoolConfig.name}` },
      {
        name: "description",
        content: `Sign in to ${schoolConfig.shortName} with your school account.`,
      },
    ],
  }),
  component: SchoolLogin,
});

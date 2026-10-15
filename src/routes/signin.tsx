import { schoolConfig } from "../../packages/school-core/src";
import { createFileRoute } from "@tanstack/react-router";
import { DemoLogin } from "@/features/school/demo-login";

export const Route = createFileRoute("/signin")({
  head: () => ({
    meta: [
      { title: `Demo sign in | ${schoolConfig.name}` },
      {
        name: "description",
        content: `Explore ${schoolConfig.shortName} with parent, teacher, principal, finance and administrator demo accounts.`,
      },
    ],
  }),
  component: DemoLogin,
});

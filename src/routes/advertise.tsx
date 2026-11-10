import { schoolConfig } from "../../packages/school-core/src";
import { createFileRoute } from "@tanstack/react-router";
import { AdvertisePage } from "@/features/school/advertise-page";

export const Route = createFileRoute("/advertise")({
  head: () => ({
    meta: [
      { title: `Advertise with us | ${schoolConfig.name}` },
      {
        name: "description",
        content: `Reach ${schoolConfig.name} families on the school app. Every rand supports the school.`,
      },
      { property: "og:title", content: `Advertise with ${schoolConfig.name}` },
      {
        property: "og:description",
        content: "Put your business in front of school families, every day, on the school app.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: AdvertisePage,
});

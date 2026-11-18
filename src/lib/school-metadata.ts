import { schoolConfig } from "../../packages/school-core/src";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestUrl } from "@tanstack/react-start/server";

const getOrigin = createIsomorphicFn()
  .server(() => getRequestUrl().origin)
  .client(() => window.location.origin);

const description = `${schoolConfig.subtitle}. School notices, events and learner information for the Wynberg Girls Junior School community.`;

export function getSchoolShareMeta() {
  const siteUrl = (import.meta.env["VITE_SITE_URL"] as string | undefined) || getOrigin();
  const imageUrl = new URL("/logo.png", siteUrl).href;
  return [
    { property: "og:site_name", content: schoolConfig.appName },
    { property: "og:title", content: schoolConfig.appName },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { property: "og:locale", content: "en_ZA" },
    { property: "og:image", content: imageUrl },
    { property: "og:image:type", content: "image/png" },
    { property: "og:image:alt", content: "SYS logo" },
    { name: "twitter:card", content: "summary" },
    { name: "twitter:title", content: schoolConfig.appName },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: imageUrl },
    { name: "twitter:image:alt", content: "SYS logo" },
  ];
}

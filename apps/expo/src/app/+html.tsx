import type { PropsWithChildren } from "react";
import { ScrollViewStyleReset } from "expo-router/html";
import { schoolConfig } from "@school-connect/core";
import { colors } from "@/theme/school";

// Expo web document only; this component is not included in native screens.
export default function WebDocument({ children }: PropsWithChildren) {
  return (
    <html lang="en-ZA">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{schoolConfig.appName}</title>
        <meta name="description" content={`${schoolConfig.name} · ${schoolConfig.subtitle}`} />
        <meta name="theme-color" content={colors.primary} />
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}

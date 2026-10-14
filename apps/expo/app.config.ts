import type { ConfigContext, ExpoConfig } from "expo/config";

// Inherit branding and public EAS linkage from app.json.
// Never load the root EXPO_TOKEN or put credentials into app configuration.
export default function appConfig({ config }: ConfigContext): ExpoConfig {
  return { ...config, name: "WGJS Connect", slug: "wynberg-girls-junior-connect" };
}

import { useState, type ReactNode } from "react";
import { ActivityIndicator, Image, View } from "react-native";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { localStore } from "./local-store";
import { colors } from "@/theme/school";
import { SchoolText as Text } from "@/components/school-screen";

const storage = localStore;
export function SchoolAuthProvider({ children }: { children: ReactNode }) {
  const [client] = useState(() =>
    process.env.EXPO_PUBLIC_CONVEX_URL
      ? new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL)
      : null,
  );
  if (!client)
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          padding: 24,
          backgroundColor: colors.background,
        }}
      >
        <Text>School sign-in is not configured. Contact the school.</Text>
      </View>
    );
  return (
    <ConvexAuthProvider client={client} storage={storage} shouldHandleCode={false}>
      {children}
    </ConvexAuthProvider>
  );
}
export function SessionLoading() {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: colors.background,
      }}
    >
      <Image
        source={require("../../../assets/logo.png")}
        accessibilityLabel="Wynberg Girls Junior School crest"
        resizeMode="contain"
        style={{ width: 112, height: 112, marginBottom: 24 }}
      />
      <Text>Wynberg Girls Junior School</Text>
      <Text>Honor Before Honours</Text>
      <ActivityIndicator color={colors.primary} />
      <Text>Restoring your school session...</Text>
    </View>
  );
}

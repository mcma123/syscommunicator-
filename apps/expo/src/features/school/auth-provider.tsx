import { useState, type ReactNode } from "react";
import { ActivityIndicator, Image, Platform, View } from "react-native";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import * as SecureStore from "expo-secure-store";
import { colors } from "@/theme/school";
import { SchoolText as Text } from "@/components/school-screen";

const memory = new Map<string, string>();
const storage = {
  async getItem(key: string) {
    try {
      return Platform.OS === "web"
        ? localStorage.getItem(key)
        : await SecureStore.getItemAsync(key);
    } catch {
      return memory.get(key) ?? null;
    }
  },
  async setItem(key: string, value: string) {
    memory.set(key, value);
    try {
      if (Platform.OS === "web") localStorage.setItem(key, value);
      else await SecureStore.setItemAsync(key, value);
    } catch {
      /* Keep this session in memory if secure storage is unavailable. */
    }
  },
  async removeItem(key: string) {
    memory.delete(key);
    try {
      if (Platform.OS === "web") localStorage.removeItem(key);
      else await SecureStore.deleteItemAsync(key);
    } catch {
      /* The in-memory session has been removed. */
    }
  },
};
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

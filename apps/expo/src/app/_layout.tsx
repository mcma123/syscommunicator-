import { useEffect } from "react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, Image, Platform, View } from "react-native";
import {
  useFonts,
  OpenSans_400Regular,
  OpenSans_600SemiBold,
  OpenSans_700Bold,
} from "@expo-google-fonts/open-sans";
import { SchoolProvider } from "@/features/school/store";
import { colors, fonts } from "@/theme/school";

void SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [loaded, error] = useFonts({ OpenSans_400Regular, OpenSans_600SemiBold, OpenSans_700Bold });
  useEffect(() => {
    if (loaded || error) void SplashScreen.hideAsync();
  }, [loaded, error]);
  if (!loaded && !error && Platform.OS !== "web")
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Image
          source={require("../../assets/logo.png")}
          accessibilityLabel="Wynberg Girls Junior School crest"
          style={{ width: 112, height: 112, marginBottom: 24 }}
          resizeMode="contain"
        />
        <ActivityIndicator color={colors.primary} accessibilityLabel="Loading school app" />
      </View>
    );
  return (
    <SchoolProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: "none",
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.primary,
          headerTitleStyle: { fontFamily: fonts.semibold },
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ title: "WGJS Connect" }} />
      </Stack>
    </SchoolProvider>
  );
}

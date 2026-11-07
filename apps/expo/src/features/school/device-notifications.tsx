import { useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import { useRouter } from "expo-router";
import { useSchool } from "./store";

export function DeviceNotifications() {
  const { account, connected, registerPushDevice, pushRegistrationRequest, setPushStatus } =
    useSchool();
  const router = useRouter();
  const registration = useRef({ userId: "", request: -1 });
  useEffect(() => {
    if (account?.status !== "Active" || !connected) return;
    if (
      Platform.OS === "web" ||
      !Device.isDevice ||
      Constants.executionEnvironment === "storeClient"
    ) {
      setPushStatus(
        "Remote push needs a physical Android/iOS device and a development build (not Expo Go).",
      );
      return;
    }
    let cancelled = false,
      working = false;
    const prompt =
      registration.current.userId !== account.id ||
      registration.current.request !== pushRegistrationRequest;
    registration.current = { userId: account.id, request: pushRegistrationRequest };
    const subscriptions: { remove(): void }[] = [];
    const update = (text: string) => {
      if (!cancelled) setPushStatus(text);
    };
    const setup = async () => {
      const notifications = await import("expo-notifications");
      if (cancelled) return;
      notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });
      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
      const register = async (
        prompt: boolean,
        devicePushToken?: import("expo-notifications").DevicePushToken,
      ) => {
        if (working || cancelled) return;
        working = true;
        try {
          update("Checking phone notification permission...");
          if (Platform.OS === "android")
            await notifications.setNotificationChannelAsync("school-updates", {
              name: "School updates",
              importance: notifications.AndroidImportance.HIGH,
            });
          let permission = await notifications.getPermissionsAsync();
          if (!permission.granted && prompt && permission.canAskAgain)
            permission = await notifications.requestPermissionsAsync();
          if (!permission.granted) {
            update("Phone notifications are off. Enable permission in phone settings, then retry.");
            return;
          }
          if (typeof projectId !== "string") {
            update("This build is missing its notification project. Contact the school.");
            return;
          }
          const result = await notifications.getExpoPushTokenAsync({
            projectId,
            ...(devicePushToken ? { devicePushToken } : {}),
          });
          if (cancelled) return;
          await registerPushDevice({
            token: result.data,
            platform: Platform.OS === "ios" ? "ios" : "android",
            projectId,
          });
          update(
            "This phone is registered for school notifications. Your saved preferences still apply.",
          );
        } catch {
          update(
            "Phone registration failed. Check your connection and build configuration, then retry.",
          );
        } finally {
          working = false;
        }
      };
      const open = (response: import("expo-notifications").NotificationResponse | null) => {
        if (cancelled || !response) return;
        const data = response.notification.request.content.data ?? {};
        if (
          data.kind === "Notice" &&
          typeof data.id === "string" &&
          /^[a-z0-9]{20,64}$/.test(data.id)
        )
          router.push({ pathname: "/notice/[id]", params: { id: data.id } });
        else if (data.kind === "ConsentReminder") router.push("/forms");
        void notifications.clearLastNotificationResponseAsync();
      };
      subscriptions.push(
        notifications.addPushTokenListener((token) => {
          void register(false, token);
        }),
      );
      subscriptions.push(notifications.addNotificationResponseReceivedListener(open));
      subscriptions.push(
        AppState.addEventListener("change", (state) => {
          if (state === "active") void register(false);
        }),
      );
      open(await notifications.getLastNotificationResponseAsync());
      await register(prompt);
    };
    void setup().catch(() =>
      update(
        "Notifications are unavailable in this build. Install a compatible development build.",
      ),
    );
    return () => {
      cancelled = true;
      for (const s of subscriptions) s.remove();
    };
  }, [
    account?.id,
    account?.status,
    connected,
    pushRegistrationRequest,
    registerPushDevice,
    router,
    setPushStatus,
  ]);
  return null;
}

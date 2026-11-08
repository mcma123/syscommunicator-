import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const memory = new Map<string, string>();

/**
 * Small device store: SecureStore natively, browser storage on Expo web, and an
 * in-memory fallback when either is unavailable. Used for auth tokens and ad dismissals.
 */
export const localStore = {
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
      /* Keep the value in memory if secure storage is unavailable. */
    }
  },
  async removeItem(key: string) {
    memory.delete(key);
    try {
      if (Platform.OS === "web") localStorage.removeItem(key);
      else await SecureStore.deleteItemAsync(key);
    } catch {
      /* The in-memory value has been removed. */
    }
  },
};

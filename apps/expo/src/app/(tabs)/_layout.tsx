import { useSchool } from "@/features/school/store";
import { accessRolesFor, canAccessModule } from "@school-connect/core/permissions";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "@/theme/school";
import { useSafeAreaInsets } from "react-native-safe-area-context";
export default function ParentTabs() {
  const { account } = useSchool();
  const grants = accessRolesFor(account?.roles ?? [], !!account?.learners.length);
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: "white",
          borderTopColor: colors.border,
          paddingTop: 9,
          height: 72 + insets.bottom,
          paddingBottom: Math.max(insets.bottom, 8),
        },
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 10 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "home" : "home-outline"} size={23} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          href: canAccessModule(grants, "messages", account?.disabledModules) ? undefined : null,
          title: "Updates",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "newspaper" : "newspaper-outline"} size={23} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          href: canAccessModule(grants, "calendar", account?.disabledModules) ? undefined : null,
          title: "Calendar",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "calendar" : "calendar-outline"} size={23} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="children"
        options={{
          href: canAccessModule(grants, "children", account?.disabledModules) ? undefined : null,
          title: "Children",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "people" : "people-outline"} size={23} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "More",
          tabBarIcon: ({ color }) => <Ionicons name="grid-outline" size={23} color={color} />,
        }}
      />
    </Tabs>
  );
}

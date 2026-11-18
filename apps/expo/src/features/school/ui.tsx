import type { ReactNode, ComponentProps } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, type Href } from "expo-router";

import { SchoolText as Text } from "@/components/school-screen";
import { colors, fonts } from "@/theme/school";
import { useSchool } from "./store";
export { Text };
export type IconName = ComponentProps<typeof Ionicons>["name"];
export function Icon({
  name,
  color = colors.primary,
  size = 22,
}: {
  name: IconName;
  color?: string;
  size?: number;
}) {
  return <Ionicons name={name} color={color} size={size} />;
}
export function Screen({
  title,
  subtitle,
  children: content,
  back = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  back?: boolean;
}) {
  const { account, connected, offline } = useSchool();
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={back ? ["top", "bottom", "left", "right"] : ["top", "left", "right"]}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.scroll}>
          <View style={s.body}>
            <View style={s.row}>
              {back ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Go back"
                  style={s.iconButton}
                  onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}
                >
                  <Icon name="arrow-back" />
                </Pressable>
              ) : (
                <Image
                  source={require("../../../assets/logo.png")}
                  style={{ width: 36, height: 40 }}
                  resizeMode="contain"
                  accessibilityLabel="Wynberg Girls Junior School crest"
                />
              )}
              <View style={{ flex: 1 }}>
                <Text weight="bold" style={{ fontSize: 11, lineHeight: 16 }}>
                  Wynberg Girls Junior School
                </Text>
                <Text style={s.small}>Honor Before Honours</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Your profile"
                onPress={() => router.push("/profile")}
                style={s.avatar}
              >
                <Text weight="bold" style={{ color: colors.deepRed }}>
                  {account?.name
                    .split(" ")
                    .map((part) => part[0])
                    .join("") ?? "WG"}
                </Text>
              </Pressable>
            </View>
            <View>
              <Text weight="bold" accessibilityRole="header" style={s.title}>
                {title}
              </Text>
              {subtitle && <Text style={s.muted}>{subtitle}</Text>}
            </View>
            <Text style={s.small}>
              Connected to the school development database. Records are fictional test data.
            </Text>
            {!connected && (
              <Feedback
                message={
                  offline
                    ? "Connection lost. Showing the last received information."
                    : "Connecting to your school..."
                }
              />
            )}
            {content}
            <Text style={[s.small, { textAlign: "center", marginTop: 12 }]}>
              Syscommunicator · Your school, connected
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export function Card({
  children,
  style,
}: {
  children: ReactNode;
  style?: ComponentProps<typeof View>["style"];
}) {
  return <View style={[s.card, style]}>{children}</View>;
}
export function Button({
  title,
  onPress,
  secondary = false,
  disabled = false,
  icon,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  icon?: IconName;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        secondary && s.secondary,
        { opacity: disabled ? 0.45 : pressed ? 0.75 : 1 },
      ]}
    >
      {icon && <Icon name={icon} color={secondary ? colors.primary : "white"} size={18} />}
      <Text weight="semibold" style={{ color: secondary ? colors.primary : "white" }}>
        {title}
      </Text>
    </Pressable>
  );
}
export function LinkRow({
  title,
  subtitle,
  icon,
  href,
  onPress,
  badge,
}: {
  title: string;
  subtitle?: string;
  icon: IconName;
  href?: Href;
  onPress?: () => void;
  badge?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress ?? (() => href && router.push(href))}
      style={({ pressed }) => [s.linkRow, { opacity: pressed ? 0.6 : 1 }]}
    >
      <View style={s.iconTile}>
        <Icon name={icon} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text weight="semibold">{title}</Text>
        {subtitle && <Text style={s.small}>{subtitle}</Text>}
      </View>
      {badge && <Badge label={badge} />}
      <Icon name="chevron-forward" color={colors.muted} size={16} />
    </Pressable>
  );
}
export function Badge({ label, good = false }: { label: string; good?: boolean }) {
  return (
    <View style={[s.badge, good && { backgroundColor: "#e9f4ed" }]}>
      <Text
        weight="semibold"
        style={{ fontSize: 10, lineHeight: 16, color: good ? "#246442" : colors.deepRed }}
      >
        {label}
      </Text>
    </View>
  );
}
export function Heading({
  title,
  action,
  onPress,
}: {
  title: string;
  action?: string;
  onPress?: () => void;
}) {
  return (
    <View style={s.row}>
      <Text weight="bold" style={{ flex: 1, fontSize: 17 }}>
        {title}
      </Text>
      {action && (
        <Pressable
          accessibilityRole="button"
          onPress={onPress}
          style={{ minHeight: 44, justifyContent: "center" }}
        >
          <Text weight="semibold" style={{ color: colors.primary, fontSize: 12 }}>
            {action}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
export function Chips({
  items,
  value,
  onChange,
}: {
  items: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8 }}
    >
      <View style={s.row}>
        {items.map((item) => (
          <Pressable
            key={item}
            accessibilityRole="button"
            accessibilityState={{ selected: item === value }}
            onPress={() => onChange(item)}
            style={[
              s.chip,
              item === value && { backgroundColor: colors.deepRed, borderColor: colors.deepRed },
            ]}
          >
            <Text
              weight="semibold"
              style={{ fontSize: 12, color: item === value ? "white" : colors.muted }}
            >
              {item}
            </Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}
export function ChildPicker() {
  const { child, setChild, account } = useSchool();
  const options = [{ id: "all", name: "All children" }, ...(account?.learners ?? [])];
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {options.map((option) => (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: child === option.id }}
            key={option.id}
            onPress={() => setChild(option.id)}
            style={{
              padding: 12,
              borderRadius: 20,
              backgroundColor: child === option.id ? colors.primary : colors.surface,
            }}
          >
            <Text style={{ color: child === option.id ? "white" : colors.muted }}>
              {option.name}
            </Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}
export function Field({ label, ...props }: ComponentProps<typeof TextInput> & { label: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Text weight="semibold" style={{ fontSize: 12 }}>
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        {...props}
        style={[
          s.input,
          props.multiline && { minHeight: 110, textAlignVertical: "top" },
          props.style,
        ]}
      />
    </View>
  );
}
export function Feedback({ message, error = false }: { message: string; error?: boolean }) {
  return (
    <Text
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={{ color: error ? colors.primary : "#246442" }}
    >
      {message}
    </Text>
  );
}
export function Empty({ title, body }: { title: string; body: string }) {
  return (
    <Card>
      <Icon name="sparkles-outline" />
      <Text weight="bold">{title}</Text>
      <Text style={s.muted}>{body}</Text>
    </Card>
  );
}
export const s = StyleSheet.create({
  scroll: { flexGrow: 1, alignItems: "center" },
  body: { width: "100%", maxWidth: 680, padding: 20, paddingBottom: 36, gap: 20 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  title: { fontSize: 29, lineHeight: 40, letterSpacing: -0.7 },
  muted: { color: colors.muted },
  small: { color: colors.muted, fontSize: 11, lineHeight: 18 },
  card: {
    backgroundColor: "white",
    borderRadius: 24,
    padding: 20,
    gap: 14,
    borderWidth: 1,
    borderColor: "#f0e9e6",
    boxShadow: "0px 5px 18px rgba(65,29,25,0.035)",
  },
  iconButton: { width: 44, height: 44, justifyContent: "center", alignItems: "center" },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: colors.goldSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  button: {
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: colors.primary,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  secondary: { backgroundColor: colors.primarySoft },
  linkRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 60 },
  iconTile: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: colors.primarySoft,
    justifyContent: "center",
    alignItems: "center",
  },
  badge: {
    backgroundColor: colors.goldSoft,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  chip: {
    minHeight: 44,
    borderRadius: 22,
    paddingHorizontal: 16,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "white",
  },
  input: {
    backgroundColor: "#faf8f7",
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    borderRadius: 14,
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.text,
    minHeight: 50,
  },
});

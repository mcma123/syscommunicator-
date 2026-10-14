import type { ReactNode } from "react";
import { Image, ScrollView, StyleSheet, Text, View, type TextProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { schoolConfig } from "@school-connect/core";
import { colors, fonts } from "@/theme/school";

export function SchoolText({
  style,
  weight = "regular",
  ...props
}: TextProps & { weight?: keyof typeof fonts }) {
  return <Text {...props} style={[styles.text, { fontFamily: fonts[weight] }, style]} />;
}

export function SchoolScreen({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.content}>
          <View style={styles.brand}>
            <Image
              source={require("../../assets/logo.png")}
              style={styles.crest}
              resizeMode="contain"
              accessibilityLabel={`${schoolConfig.name} crest`}
            />
            <View style={styles.brandText}>
              <SchoolText weight="bold" style={styles.schoolName}>
                {schoolConfig.name}
              </SchoolText>
              <SchoolText style={styles.tagline}>{schoolConfig.subtitle}</SchoolText>
            </View>
          </View>
          <SchoolText accessibilityRole="header" weight="bold" style={styles.title}>
            {title}
          </SchoolText>
          <SchoolText style={styles.description}>{description}</SchoolText>
          {children}
          <SchoolText style={styles.footer}>{schoolConfig.shortName} · Frontend demo</SchoolText>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, alignItems: "center" },
  content: { width: "100%", maxWidth: 920, padding: 20, gap: 16 },
  text: { color: colors.text, fontSize: 14, lineHeight: 22 },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  crest: { width: 60, height: 60 },
  brandText: { flex: 1 },
  schoolName: { fontSize: 17, lineHeight: 25 },
  tagline: { color: colors.muted, fontSize: 12 },
  title: { fontSize: 27, lineHeight: 36 },
  description: { color: colors.muted, marginTop: -10 },
  footer: { color: colors.muted, fontSize: 11, paddingTop: 16, textAlign: "center" },
});

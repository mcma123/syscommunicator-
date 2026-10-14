import { Link, Stack } from "expo-router";
import { StyleSheet, View } from "react-native";
import { SchoolScreen, SchoolText } from "@/components/school-screen";
import { colors, fonts } from "@/theme/school";
import { modules, type ModuleId } from "./modules";

export function ModulePlaceholder({ moduleId }: { moduleId: ModuleId }) {
  const module = modules.find((item) => item.id === moduleId)!;
  return (
    <>
      <Stack.Screen options={{ title: module.title }} />
      <SchoolScreen title={module.title} description={module.description}>
        <View style={styles.card}>
          <SchoolText weight="bold">Ready for native development</SchoolText>
          <SchoolText>
            This module has its own route on Android, iOS, and Expo web. Its native screens and
            interactions will be built here.
          </SchoolText>
          <SchoolText style={styles.note}>
            The existing web app already contains the prototype workflow. This screen does not
            submit forms, process payments, or modify school records.
          </SchoolText>
        </View>
        <Link href="/" style={styles.link}>
          ← Back to school home
        </Link>
      </SchoolScreen>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 20,
    gap: 12,
  },
  note: { fontSize: 12, color: colors.muted },
  link: { color: colors.primary, paddingVertical: 12, fontFamily: fonts.semibold },
});

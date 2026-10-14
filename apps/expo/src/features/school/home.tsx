import { Link, type Href } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { visibleNotices, type Role } from "@school-connect/core";
import { SchoolScreen, SchoolText } from "@/components/school-screen";
import { colors } from "@/theme/school";
import { modules } from "./modules";
import { useSchool } from "./store";

const roles: Role[] = ["Parent", "Teacher", "Principal", "Finance", "Administrator"];

export default function HomeScreen() {
  const { state, role, setRole } = useSchool();
  const notices = visibleNotices(state, role, "all");
  return (
    <SchoolScreen
      title={role === "Parent" ? "Parent home" : "Staff overview"}
      description="Your school updates, all in one place."
    >
      <View style={styles.roles}>
        <SchoolText weight="semibold">Demo role</SchoolText>
        <View style={styles.roleButtons}>
          {roles.map((value) => (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityState={{ selected: role === value }}
              onPress={() => setRole(value)}
              style={[styles.roleButton, role === value && styles.selectedRole]}
            >
              <SchoolText style={role === value ? styles.selectedText : styles.roleText}>
                {value}
              </SchoolText>
            </Pressable>
          ))}
        </View>
      </View>
      <View style={styles.summary}>
        <SchoolText weight="bold" style={styles.summaryNumber}>
          {notices.length}
        </SchoolText>
        <SchoolText>school updates</SchoolText>
        <SchoolText style={styles.hint}>
          Shared demo data · Native module screens are ready for development
        </SchoolText>
      </View>
      <SchoolText accessibilityRole="header" weight="bold" style={styles.sectionTitle}>
        Latest notices
      </SchoolText>
      {notices.slice(0, 3).map((notice) => (
        <View key={notice.id} style={styles.card}>
          <View style={styles.noticeTop}>
            <SchoolText style={styles.category}>{notice.category}</SchoolText>
            <SchoolText style={styles.hint}>{notice.date}</SchoolText>
          </View>
          <SchoolText weight="bold">{notice.title}</SchoolText>
          <SchoolText style={styles.body}>{notice.body}</SchoolText>
          <SchoolText style={styles.hint}>
            {notice.author} · {notice.status}
          </SchoolText>
        </View>
      ))}
      <SchoolText accessibilityRole="header" weight="bold" style={styles.sectionTitle}>
        School modules
      </SchoolText>
      <View style={styles.moduleGrid}>
        {modules.map((module) => (
          <Link key={module.id} href={`/${module.id}` as Href} asChild>
            <Pressable
              accessibilityRole="link"
              style={({ pressed }) => [styles.moduleCard, pressed && styles.pressed]}
            >
              <SchoolText weight="semibold" style={styles.moduleTitle}>
                {module.title} →
              </SchoolText>
              <SchoolText style={styles.hint}>{module.description}</SchoolText>
            </Pressable>
          </Link>
        ))}
      </View>
    </SchoolScreen>
  );
}

const styles = StyleSheet.create({
  roles: { gap: 9 },
  roleButtons: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  roleButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  selectedRole: { backgroundColor: colors.primary, borderColor: colors.primary },
  selectedText: { color: colors.surface, fontSize: 12 },
  roleText: { color: colors.primary, fontSize: 12 },
  summary: { padding: 20, borderRadius: 8, backgroundColor: colors.goldSoft, gap: 4 },
  summaryNumber: { fontSize: 30, lineHeight: 38, color: colors.deepRed },
  hint: { fontSize: 11, lineHeight: 18, color: colors.muted },
  sectionTitle: { fontSize: 18, marginTop: 8 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 18,
    gap: 8,
  },
  noticeTop: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  category: {
    fontSize: 11,
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  body: { fontSize: 12, lineHeight: 21, color: colors.muted },
  moduleGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  moduleCard: {
    flexGrow: 1,
    flexBasis: 220,
    padding: 18,
    gap: 6,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  moduleTitle: { color: colors.primary },
  pressed: { backgroundColor: colors.primarySoft },
});

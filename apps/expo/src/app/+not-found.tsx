import { Link } from "expo-router";
import { SchoolScreen, SchoolText } from "@/components/school-screen";
import { colors } from "@/theme/school";

export default function NotFound() {
  return (
    <SchoolScreen title="Page not found" description="This school module could not be found.">
      <SchoolText>Choose a module from school home to continue.</SchoolText>
      <Link href="/" style={{ color: colors.primary }}>
        Back to school home
      </Link>
    </SchoolScreen>
  );
}

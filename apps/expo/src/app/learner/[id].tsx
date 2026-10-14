export { LearnerScreen as default } from "@/features/school/parent-screens";
export function generateStaticParams() {
  return ["emma", "noah"].map((id) => ({ id }));
}

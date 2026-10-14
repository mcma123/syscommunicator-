export { EventScreen as default } from "@/features/school/parent-screens";
export function generateStaticParams() {
  return ["sports", "reading", "trip", "meeting"].map((id) => ({ id }));
}

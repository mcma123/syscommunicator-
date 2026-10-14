export { DocumentScreen as default } from "@/features/school/parent-screens";
export function generateStaticParams() {
  return ["0", "1", "2", "3", "attachment", "report"].map((id) => ({ id }));
}

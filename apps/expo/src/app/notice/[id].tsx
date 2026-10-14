export { NoticeScreen as default } from "@/features/school/parent-screens";
export function generateStaticParams() {
  return ["excursion", "sports", "newsletter", "reading"].map((id) => ({ id }));
}

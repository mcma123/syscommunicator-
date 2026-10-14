export { EnquiryScreen as default } from "@/features/school/parent-screens";
export function generateStaticParams() {
  return ["finance"].map((id) => ({ id }));
}

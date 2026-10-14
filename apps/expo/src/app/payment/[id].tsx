export { PaymentScreen as default } from "@/features/school/parent-screens";
export function generateStaticParams() {
  return ["excursion", "october"].map((id) => ({ id }));
}

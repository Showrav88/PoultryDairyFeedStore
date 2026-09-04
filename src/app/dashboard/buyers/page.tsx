import { redirect } from "next/navigation";

export default function BuyersRedirectPage() {
  redirect("/dashboard/suppliers");
}

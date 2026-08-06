import { redirect } from "next/navigation";
import { getMockRole } from "@/lib/mock-auth";

export default async function RootPage() {
  const role = await getMockRole();
  redirect(role ? "/dashboard" : "/login");
}

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/get-current-user";

// This route resolves the authenticated user from a request cookie, so
// it must never be statically prerendered (the production auth guard
// would otherwise fire during `next build`).
export const dynamic = "force-dynamic";

export default async function RootPage() {
  const user = await getCurrentUser();
  redirect(user ? "/dashboard" : "/login");
}
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { getCurrentUser } from "@/lib/get-current-user";

// Every dashboard route resolves the authenticated user from the request
// cookie, so the whole group must render dynamically — never statically
// prerendered (the production auth guard would otherwise fire during
// `next build`).
export const dynamic = "force-dynamic";

export default async function DashboardGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar role={user.role} />
      <div className="flex flex-1 flex-col">
        <Topbar fullName={user.fullName} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
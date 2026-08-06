import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { getMockRole } from "@/lib/mock-auth";

export default async function DashboardGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const role = await getMockRole();

  if (!role) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Topbar role={role} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}

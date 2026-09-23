import { redirect } from "next/navigation";
import { LanguageProvider } from "@/components/layout/language-provider";
import { SidebarShell } from "@/components/layout/sidebar-shell";
import { Topbar } from "@/components/layout/topbar";
import { getCurrentUser } from "@/lib/get-current-user";
import { prepareDatabase } from "@/lib/db";
import { getDashboardLanguage } from "@/lib/i18n/language";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function DashboardGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await prepareDatabase();
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const lang = await getDashboardLanguage();

  return (
    <LanguageProvider lang={lang}>
      <SidebarShell
        role={user.role}
        topbar={<Topbar fullName={user.fullName} role={user.role} />}
      >
        {children}
      </SidebarShell>
    </LanguageProvider>
  );
}

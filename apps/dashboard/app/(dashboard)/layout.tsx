import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { LanguageProvider } from "@/components/layout/language-provider";
import { getCurrentUser } from "@/lib/get-current-user";
import { getDashboardLanguage } from "@/lib/i18n/language";

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

  const lang = await getDashboardLanguage();

  return (
    <LanguageProvider lang={lang}>
      <Sidebar role={user.role} />
      {/* min-w-0 lets this flex column shrink below its content's intrinsic
          width; without it a wide table (internal scroll) forces the whole
          page to become wider than the viewport. */}
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar fullName={user.fullName} role={user.role} />
        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-6">{children}</main>
      </div>
    </LanguageProvider>
  );
}
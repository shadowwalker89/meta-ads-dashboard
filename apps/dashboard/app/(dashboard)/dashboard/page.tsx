import { StatCard } from "@/components/dashboard/stat-card";
import { Wallet, Eye, MousePointerClick, Link2 } from "lucide-react";
import { getCurrentUser } from "@/lib/get-current-user";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">داشبورد</h1>
        <p className="text-sm text-muted-foreground">
          نمای کلی عملکرد کمپین‌های تبلیغاتی
        </p>
        <p className="text-xs text-muted-foreground">
          {user ? `${user.fullName} (${user.email})` : "کاربر وارد نشده"}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="هزینه تبلیغات"
          value="۱۲٬۴۵۰٬۰۰۰ تومان"
          description="کل هزینه‌ی دوره"
          trend={{ value: 12.5, direction: "up", label: "نسبت به دوره قبل" }}
          icon={<Wallet />}
        />
        <StatCard
          title="نمایش‌ها"
          value="۲۳۴٬۵۶۷"
          description="تعداد کل نمایش‌ها"
          trend={{ value: 8.2, direction: "up" }}
          icon={<Eye />}
        />
        <StatCard
          title="کلیک‌ها"
          value="۴٬۸۹۰"
          description="تعداد کل کلیک‌ها"
          trend={{ value: 3.4, direction: "up" }}
          icon={<MousePointerClick />}
        />
        <StatCard
          title="کلیک روی لینک"
          value="۳٬۲۱۰"
          description="کلیک‌های روی لینک مقصد"
          trend={{ value: 1.8, direction: "down", label: "کاهش جزئی" }}
          icon={<Link2 />}
        />
      </div>

      <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold">روند عملکرد</h2>
          <p className="text-xs text-muted-foreground">
            نمودار این بخش در مراحل بعدی اضافه می‌شود.
          </p>
        </div>
        <div className="flex h-64 items-center justify-center rounded-lg border border-dashed bg-muted/40 text-sm text-muted-foreground">
          نمودار در مراحل بعدی
        </div>
      </section>
    </div>
  );
}

import Link from "next/link";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-4xl font-bold tracking-tight">۴۰۴</h1>
      <p className="text-muted-foreground">
        صفحه‌ای که دنبال آن بودید پیدا نشد.
      </p>
      <Button asChild>
        <Link href="/dashboard">بازگشت به داشبورد</Link>
      </Button>
    </div>
  );
}
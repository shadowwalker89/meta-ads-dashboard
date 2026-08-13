import { Button } from "@/components/ui/button";
import { loginAsMockUser } from "./actions";

// Seeded user emails are the stable identifiers (email is UNIQUE in
// the users table). Seed row ids are randomUUID()s generated at seed
// time, so the mock login selects users by their seeded email instead
// of inventing ids the dashboard cannot know.
export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6 rounded-lg border p-8 text-center">
        <h1 className="text-xl font-bold">ورود به پنل متا ادز</h1>
        <p className="text-sm text-muted-foreground">
          این صفحه فعلاً ورود آزمایشی (Mock) است؛ در فاز بعد با Supabase Auth
          واقعی جایگزین می‌شود.
        </p>
        <div className="space-y-3">
          <form
            action={async () => {
              "use server";
              await loginAsMockUser("superadmin@example.com", "super_admin");
            }}
          >
            <Button type="submit" className="w-full">
              ورود به عنوان مدیر کل
            </Button>
          </form>
          <form
            action={async () => {
              "use server";
              await loginAsMockUser("admin1@example.com", "admin");
            }}
          >
            <Button type="submit" variant="secondary" className="w-full">
              ورود به عنوان ادمین
            </Button>
          </form>
          <form
            action={async () => {
              "use server";
              await loginAsMockUser("client1user@example.com", "client");
            }}
          >
            <Button type="submit" variant="outline" className="w-full">
              ورود به عنوان مشتری
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
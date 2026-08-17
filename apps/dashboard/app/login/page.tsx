import { Button } from "@/components/ui/button";
import { resolveAuthProviderName } from "@/lib/auth/config";
import { signIn } from "./actions";

// Request-scoped (reads process.env for the provider and submits a server
// action); never statically prerendered.
export const dynamic = "force-dynamic";

// Seeded user emails are the stable dev identities (email is UNIQUE in
// the users table). The mock provider accepts ONLY these accounts —
// signIn validates the email against the repository, so an arbitrary
// identity can never be asserted.
const MOCK_LOGIN_OPTIONS = [
  {
    email: "superadmin@example.com",
    label: "ورود به عنوان مدیر کل",
    variant: "default",
  },
  {
    email: "admin1@example.com",
    label: "ورود به عنوان ادمین",
    variant: "secondary",
  },
  {
    email: "client1user@example.com",
    label: "ورود به عنوان مشتری",
    variant: "outline",
  },
  {
    email: "democlient@example.com",
    label: "ورود به عنوان مشتری (دمو)",
    variant: "outline",
  },
] as const;

export default function LoginPage() {
  const isMock = resolveAuthProviderName(process.env) === "mock";

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6 rounded-lg border p-8 text-center">
        <h1 className="text-xl font-bold">ورود به پنل متا ادز</h1>
        <p className="text-sm text-muted-foreground">
          {isMock
            ? "این صفحه فعلاً ورود آزمایشی (Mock) است؛ در فاز بعد با Supabase Auth واقعی جایگزین می‌شود."
            : "ورود با Supabase Auth هنوز راه‌اندازی نشده است (فاز استقرار)."}
        </p>
        {isMock && (
          <div className="space-y-3">
            {MOCK_LOGIN_OPTIONS.map((option) => (
              <form
                key={option.email}
                action={signIn.bind(null, option.email)}
              >
                <Button
                  type="submit"
                  variant={option.variant}
                  className="w-full"
                >
                  {option.label}
                </Button>
              </form>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
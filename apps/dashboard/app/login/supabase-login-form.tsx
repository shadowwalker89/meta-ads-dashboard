"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { signInWithPassword, type SignInResult } from "./actions";

const INITIAL_STATE: SignInResult = undefined;

export function SupabaseLoginForm() {
  const [state, action, pending] = useActionState(
    signInWithPassword,
    INITIAL_STATE
  );

  return (
    <form action={action} className="space-y-4 text-right">
      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium">
          ایمیل
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium">
          رمز عبور
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        />
      </div>
      {state?.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "در حال ورود..." : "ورود"}
      </Button>
    </form>
  );
}

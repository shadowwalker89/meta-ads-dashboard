import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { resolveAuthProviderName } from "@/lib/auth/config";
import { updateSupabaseSession } from "@/lib/auth/supabase-middleware";
import { MOCK_SESSION_COOKIE } from "@/lib/mock-auth";

export function middleware(request: NextRequest) {
  // resolveAuthProviderName is a pure function on process.env (Edge
  // runtime supports process.env). An unparseable/unknown config fails
  // open at the edge on purpose: the real boundary is access.ts, which
  // fails closed — no mock cookie and no Supabase session means
  // unauthenticated, redirect to /login, deny.
  let provider: "mock" | "supabase";
  try {
    provider = resolveAuthProviderName(process.env);
  } catch {
    return NextResponse.next();
  }

  // Mock provider: protect the dashboard with a cookie-presence check.
  // The cookie holds only an identity handle; role and client rights are
  // resolved from the User row by access.ts on every request.
  if (provider === "mock") {
    const session = request.cookies.get(MOCK_SESSION_COOKIE)?.value;
    if (!session && request.nextUrl.pathname.startsWith("/dashboard")) {
      const loginUrl = new URL("/login", request.url);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return updateSupabaseSession(request);
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
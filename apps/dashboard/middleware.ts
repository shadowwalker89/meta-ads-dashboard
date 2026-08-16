import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { resolveAuthProviderName } from "@/lib/auth/config";
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
  }

  // Supabase provider: real session validation/refresh lives in the
  // deployment-phase middleware (@supabase/ssr). There is deliberately
  // NO fake Supabase implementation here — the provider boundary stays
  // clean and the app fails loudly until real auth is wired.
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
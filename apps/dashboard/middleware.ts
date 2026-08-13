import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { MOCK_SESSION_COOKIE } from "@/lib/mock-auth";

export function middleware(request: NextRequest) {
  const session = request.cookies.get(MOCK_SESSION_COOKIE)?.value;

  if (!session && request.nextUrl.pathname.startsWith("/dashboard")) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
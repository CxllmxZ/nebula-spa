import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // TODO: check Better Auth session for /admin/* routes
  // For now, pass through all requests
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all admin routes except login
    "/admin/:path*",
  ],
};

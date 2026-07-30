import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/*export function middleware(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);

  // No cookie → redirect to login
  if (!sessionCookie) {
    const loginUrl = new URL("/admin/login", request.url);
    // Preserve intended destination for post-login redirect
    loginUrl.searchParams.set("callbackUrl", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Cookie exists → allow (Server Component จะ validate จริงอีกที)
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Protect ทุกหน้าใน /admin/* **ยกเว้น** /admin/login
    "/admin/((?!login).*)",
  ],
};*/

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Skip login page — no auth required
  if (pathname === "/admin/login") {
    return NextResponse.next();
  }

  const sessionCookie = getSessionCookie(request);

  if (!sessionCookie) {
    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};

import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";

// Define which roles can access which route prefixes
const ROLE_ACCESS: Record<string, string[]> = {
  "/dashboard":    ["ADMIN", "USER"],
  "/daily-status": ["ADMIN", "USER"],
  "/test-cases":   ["ADMIN", "USER", "TL", "DEV"],
  "/tasks":        ["ADMIN", "USER"],
  "/admin":        ["ADMIN"],
};

function getDefaultRoute(role: string): string {
  if (role === "TL" || role === "DEV") return "/test-cases";
  return "/dashboard";
}

export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const { pathname } = req.nextUrl;

  // 1. Allow auth-related paths and public files
  if (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/") ||
    pathname.includes("/_next") ||
    pathname.includes("/favicon.ico")
  ) {
    return NextResponse.next();
  }

  // 2. Redirect to login if not authenticated
  if (!token && pathname !== "/login") {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // 3. Redirect authenticated users away from login
  if (token && pathname === "/login") {
    const defaultRoute = getDefaultRoute(token.role as string);
    return NextResponse.redirect(new URL(defaultRoute, req.url));
  }

  // 4. Redirect root to default route
  if (token && pathname === "/") {
    const defaultRoute = getDefaultRoute(token.role as string);
    return NextResponse.redirect(new URL(defaultRoute, req.url));
  }

  // 5. Role-based access control
  if (token) {
    const userRole = (token.role as string) || "USER";
    
    // Find matching route rule
    for (const [routePrefix, allowedRoles] of Object.entries(ROLE_ACCESS)) {
      if (pathname.startsWith(routePrefix)) {
        if (!allowedRoles.includes(userRole)) {
          const defaultRoute = getDefaultRoute(userRole);
          return NextResponse.redirect(new URL(defaultRoute, req.url));
        }
        break;
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$|favicon.ico).*)"],
};

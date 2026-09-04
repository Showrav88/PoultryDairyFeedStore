import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { COOKIE_NAME, verifySession } from "@/lib/auth";

const publicPaths = ["/", "/login", "/register"];
const publicApiPaths = ["/api/auth/register", "/api/auth/login", "/api/health", "/api/deploy"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublicPage = publicPaths.includes(pathname);
  const isPublicApi = publicApiPaths.some((p) => pathname.startsWith(p));

  const token = request.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verifySession(token) : null;

  if (pathname.startsWith("/api/") && !isPublicApi && !session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isPublicPage && !pathname.startsWith("/api/") && !session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (session && (pathname === "/login" || pathname === "/register")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

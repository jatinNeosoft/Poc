import { NextResponse } from "next/server"
import { getToken } from "next-auth/jwt"

// Protects every /admin page and /api/admin endpoint
export async function middleware(req) {
  const { pathname, search } = req.nextUrl
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })

  if (pathname === "/admin/login") {
    // Already logged in → go to dashboard
    return token ? NextResponse.redirect(new URL("/admin", req.url)) : NextResponse.next()
  }

  if (token) return NextResponse.next()

  if (pathname.startsWith("/api/admin")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const loginUrl = new URL("/admin/login", req.url)
  loginUrl.searchParams.set("callbackUrl", pathname + search)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
}

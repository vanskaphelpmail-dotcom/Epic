import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PREFERRED_HOST = "www.epicvanskap.com";
const SITE_ORIGIN = "https://www.epicvanskap.com";

const ROBOTS_BODY = `User-agent: *
Allow: /
Disallow: /admin
Disallow: /admin/
Disallow: /cart
Disallow: /checkout
Disallow: /account
Disallow: /auth
Disallow: /order-success
Disallow: /seller
Disallow: /api/

Host: ${SITE_ORIGIN}
Sitemap: ${SITE_ORIGIN}/sitemap.xml
`;

/**
 * Force HTTPS + www for production hostnames.
 * Also serve robots.txt / rewrite sitemap.xml so the SPA catch-all cannot swallow them.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = (request.headers.get("host") || "").toLowerCase().split(":")[0];
  const proto = (request.headers.get("x-forwarded-proto") || "https").toLowerCase();

  // Always serve robots.txt as plain text (never SPA HTML)
  if (pathname === "/robots.txt") {
    return new NextResponse(ROBOTS_BODY, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  }

  // Rewrite sitemap.xml to API route (avoids [[...slug]] catch-all)
  if (pathname === "/sitemap.xml") {
    const url = request.nextUrl.clone();
    url.pathname = "/api/seo/sitemap";
    return NextResponse.rewrite(url);
  }

  if (
    !host ||
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.endsWith(".vercel.app") ||
    host.endsWith(".localhost")
  ) {
    return NextResponse.next();
  }

  const isEpic =
    host === "epicvanskap.com" ||
    host === "www.epicvanskap.com" ||
    host.endsWith(".epicvanskap.com");

  if (!isEpic) return NextResponse.next();

  const needsHostFix = host !== PREFERRED_HOST;
  const needsHttps = proto !== "https";

  if (needsHostFix || needsHttps) {
    const url = request.nextUrl.clone();
    url.protocol = "https:";
    url.host = PREFERRED_HOST;
    return NextResponse.redirect(url, 308);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

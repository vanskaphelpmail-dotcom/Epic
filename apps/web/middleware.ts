import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PREFERRED_HOST = "www.epicvanskap.com";

/**
 * Force HTTPS + www for production hostnames.
 * Skip localhost, Vercel previews, and already-correct hosts.
 */
export function middleware(request: NextRequest) {
  const host = (request.headers.get("host") || "").toLowerCase().split(":")[0];
  const proto = (request.headers.get("x-forwarded-proto") || "https").toLowerCase();

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
    /*
     * Run on all paths except Next internals and static assets that
     * should not be redirected (still OK if they are — matcher is broad).
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

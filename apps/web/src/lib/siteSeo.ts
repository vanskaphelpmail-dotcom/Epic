/** Production site SEO constants — never use Vercel preview URLs here. */
export const SITE_ORIGIN = "https://www.epicvanskap.com";
export const SITE_NAME = "Epic Vanskap";
export const SITE_TITLE = "Epic Vanskap — Authentic Football Jerseys";
export const SITE_DESCRIPTION =
  "Shop authentic football jerseys at Epic Vanskap — classic and modern kits for fans and collectors. Browse Premier League, Retro, Player Edition, and club collections. Verified stock online and at our Bangladesh outlet.";
export const SITE_OG_IMAGE = `${SITE_ORIGIN}/epic-vanskap-logo.png`;
export const SITE_LOGO = `${SITE_ORIGIN}/epic-vanskap-logo.png`;

export function absoluteUrl(path = "/"): string {
  if (!path || path === "/") return `${SITE_ORIGIN}/`;
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_ORIGIN}${clean}`;
}

export function isNoIndexPath(segments: string[]): boolean {
  const root = (segments[0] || "").toLowerCase();
  return (
    root === "admin" ||
    root === "cart" ||
    root === "checkout" ||
    root === "account" ||
    root === "auth" ||
    root === "order-success" ||
    root === "seller" ||
    root === "dashboard"
  );
}

/**
 * Old WordPress / WooCommerce paths still in Google's index.
 * These must 301 to the www homepage — never soft-404 through the SPA.
 */
export function isLegacyWordpressPath(pathname: string): boolean {
  const path = (pathname || "/").toLowerCase().split("?")[0].replace(/\/+$/, "") || "/";
  if (path === "/category") return true;
  if (path.startsWith("/category/")) return true;
  if (path === "/product-category") return true;
  if (path.startsWith("/product-category/")) return true;
  if (path === "/product-tag") return true;
  if (path.startsWith("/product-tag/")) return true;
  if (path.startsWith("/wp-admin")) return true;
  if (path.startsWith("/wp-content")) return true;
  if (path.startsWith("/wp-includes")) return true;
  if (path.startsWith("/wp-json")) return true;
  if (path === "/feed" || path.startsWith("/feed/")) return true;
  if (path === "/xmlrpc.php" || path.endsWith("/xmlrpc.php")) return true;
  // WooCommerce my-account leftovers
  if (path === "/my-account" || path.startsWith("/my-account/")) return true;
  return false;
}

export function homepageJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_ORIGIN}/#organization`,
        name: SITE_NAME,
        url: `${SITE_ORIGIN}/`,
        logo: {
          "@type": "ImageObject",
          url: SITE_LOGO,
        },
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_ORIGIN}/#website`,
        name: SITE_NAME,
        url: `${SITE_ORIGIN}/`,
        publisher: { "@id": `${SITE_ORIGIN}/#organization` },
        inLanguage: "en",
      },
    ],
  };
}

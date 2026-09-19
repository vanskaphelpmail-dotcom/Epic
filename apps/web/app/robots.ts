import type { MetadataRoute } from "next";
import { SITE_ORIGIN } from "@/src/lib/siteSeo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/admin/",
          "/cart",
          "/checkout",
          "/account",
          "/auth",
          "/order-success",
          "/seller",
          "/api/",
        ],
      },
    ],
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
    host: SITE_ORIGIN,
  };
}

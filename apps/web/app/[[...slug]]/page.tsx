import type { Metadata } from "next";
import { prisma } from "@jab/db";
import { StorefrontShell } from "@/src/components/StorefrontShell";
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_OG_IMAGE,
  SITE_TITLE,
  absoluteUrl,
  homepageJsonLd,
  isNoIndexPath,
} from "@/src/lib/siteSeo";

type PageProps = {
  params: Promise<{ slug?: string[] }>;
};

function decodeSeg(value?: string) {
  if (!value) return "";
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

async function loadProduct(key: string) {
  try {
    return await prisma.product.findFirst({
      where: {
        deletedAt: null,
        status: "ACTIVE",
        OR: [{ id: key }, { slug: key }, { sku: key }],
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        shortDescription: true,
        price: true,
        originalPrice: true,
        imageUrl: true,
        galleryUrls: true,
      },
    });
  } catch (err) {
    console.error("[seo] product lookup failed", err);
    return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug = [] } = await params;
  const segments = slug.map(decodeSeg);
  const root = (segments[0] || "").toLowerCase();

  if (isNoIndexPath(segments)) {
    const path = `/${segments.join("/")}`;
    return {
      title: SITE_NAME,
      robots: { index: false, follow: false },
      alternates: { canonical: absoluteUrl(path) },
    };
  }

  // Homepage
  if (segments.length === 0) {
    return {
      title: { absolute: SITE_TITLE },
      description: SITE_DESCRIPTION,
      alternates: {
        // Relative "/" resolves against metadataBase → preferred www homepage
        canonical: "/",
      },
      openGraph: {
        type: "website",
        url: absoluteUrl("/"),
        siteName: SITE_NAME,
        title: SITE_TITLE,
        description: SITE_DESCRIPTION,
        images: [{ url: SITE_OG_IMAGE, alt: SITE_NAME }],
      },
      twitter: {
        card: "summary_large_image",
        title: SITE_TITLE,
        description: SITE_DESCRIPTION,
        images: [SITE_OG_IMAGE],
      },
      robots: { index: true, follow: true },
    };
  }

  // Product detail — self-canonical
  if (root === "product" && segments[1]) {
    const key = segments[1];
    const product = await loadProduct(key);
    const path = `/product/${encodeURIComponent(product?.slug || key)}`;
    const title = product?.name
      ? `${product.name} | ${SITE_NAME}`
      : `Product | ${SITE_NAME}`;
    const description =
      (product?.shortDescription || product?.description || "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 160) ||
      `Buy ${product?.name || "authentic football jerseys"} at ${SITE_NAME}.`;
    const image = product?.imageUrl || product?.galleryUrls?.[0] || SITE_OG_IMAGE;

    return {
      title: { absolute: title },
      description,
      alternates: { canonical: absoluteUrl(path) },
      openGraph: {
        type: "website",
        url: absoluteUrl(path),
        siteName: SITE_NAME,
        title,
        description,
        images: [{ url: image, alt: product?.name || SITE_NAME }],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [image],
      },
      robots: { index: true, follow: true },
    };
  }

  // Shop / category listing — self-canonical
  if (root === "shop") {
    const category = segments[1] || "";
    const path = category ? `/shop/${encodeURIComponent(category)}` : "/shop";
    const label = category || "Shop";
    const title = category
      ? `${category} Football Jerseys | ${SITE_NAME}`
      : `Shop Football Jerseys | ${SITE_NAME}`;
    const description = category
      ? `Browse ${category} authentic football jerseys at ${SITE_NAME}. Verified classic and modern kits for fans and collectors.`
      : `Browse authentic football jerseys at ${SITE_NAME} — clubs, leagues, Retro, Player Edition, and more.`;

    return {
      title: { absolute: title },
      description,
      alternates: { canonical: absoluteUrl(path) },
      openGraph: {
        type: "website",
        url: absoluteUrl(path),
        siteName: SITE_NAME,
        title,
        description,
        images: [{ url: SITE_OG_IMAGE, alt: SITE_NAME }],
      },
      robots: { index: true, follow: true },
    };
  }

  // Info / CMS-style pages
  const infoPages = new Set([
    "about",
    "contact",
    "faq",
    "authenticity",
    "shipping",
    "privacy",
    "terms",
    "refund",
  ]);
  if (infoPages.has(root) && segments.length === 1) {
    const label = root.charAt(0).toUpperCase() + root.slice(1);
    const path = `/${root}`;
    const title = `${label} | ${SITE_NAME}`;
    return {
      title: { absolute: title },
      description: SITE_DESCRIPTION,
      alternates: { canonical: absoluteUrl(path) },
      openGraph: {
        type: "website",
        url: absoluteUrl(path),
        siteName: SITE_NAME,
        title,
        description: SITE_DESCRIPTION,
        images: [{ url: SITE_OG_IMAGE, alt: SITE_NAME }],
      },
      robots: { index: true, follow: true },
    };
  }

  // Legacy category-as-first-segment URLs → treat as shop listing
  if (segments.length === 1) {
    const category = segments[0];
    const path = `/${encodeURIComponent(category)}`;
    const title = `${category} Football Jerseys | ${SITE_NAME}`;
    const description = `Browse ${category} authentic football jerseys at ${SITE_NAME}.`;
    return {
      title: { absolute: title },
      description,
      alternates: { canonical: absoluteUrl(path) },
      openGraph: {
        type: "website",
        url: absoluteUrl(path),
        siteName: SITE_NAME,
        title,
        description,
        images: [{ url: SITE_OG_IMAGE, alt: SITE_NAME }],
      },
      robots: { index: true, follow: true },
    };
  }

  return {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    alternates: { canonical: absoluteUrl("/") },
    robots: { index: true, follow: true },
  };
}

export default async function SpaCatchAllPage({ params }: PageProps) {
  const { slug = [] } = await params;
  const segments = slug.map(decodeSeg);
  const isHome = segments.length === 0;
  const isProduct = (segments[0] || "").toLowerCase() === "product" && !!segments[1];
  const product = isProduct ? await loadProduct(segments[1]) : null;

  const productJsonLd =
    product
      ? {
          "@context": "https://schema.org",
          "@type": "Product",
          name: product.name,
          description: (product.shortDescription || product.description || "")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 300),
          image: product.imageUrl || product.galleryUrls?.[0] || SITE_OG_IMAGE,
          sku: product.slug || product.id,
          brand: { "@type": "Brand", name: SITE_NAME },
          url: absoluteUrl(`/product/${encodeURIComponent(product.slug || product.id)}`),
          offers: {
            "@type": "Offer",
            url: absoluteUrl(`/product/${encodeURIComponent(product.slug || product.id)}`),
            priceCurrency: "BDT",
            price: String(product.price ?? ""),
            availability: "https://schema.org/InStock",
            seller: { "@type": "Organization", name: SITE_NAME },
          },
        }
      : null;

  return (
    <>
      {isHome ? (
        <>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(homepageJsonLd()) }}
          />
          <section className="sr-only" aria-label="Epic Vanskap homepage">
            <h1>Epic Vanskap — Authentic Football Jerseys</h1>
            <p>{SITE_DESCRIPTION}</p>
            <p>
              Epic Vanskap is an authentic football jersey store for fans and collectors —
              Premier League, Retro, Player Edition, club kits, and more.
            </p>
            <nav>
              <a href="/">Home</a>
              <a href="/shop">Shop</a>
              <a href="/about">About</a>
              <a href="/contact">Contact</a>
            </nav>
          </section>
        </>
      ) : null}
      {productJsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
        />
      ) : null}
      <StorefrontShell />
    </>
  );
}

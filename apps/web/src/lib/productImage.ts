/** True when a product image string can be used as an <img src>. */
export function isRenderableImageSrc(src?: string | null): boolean {
  if (!src || typeof src !== "string") return false;
  const s = src.trim();
  if (!s) return false;
  if (s.startsWith("data:") || s.startsWith("blob:")) return true;
  if (/^https?:\/\//i.test(s)) return true;
  // Allow real static paths like /images/foo.jpg — not catalog keys like argentina_home_1990
  if (s.startsWith("/") && /\.[a-z0-9]+($|\?)/i.test(s)) return true;
  return false;
}

/** First usable photo from a product snapshot (cart / bag / wishlist). */
export function getProductImageSrc(product?: {
  uploadedImage?: string | null;
  image?: string | null;
  gallery?: string[] | null;
  images?: string[] | null;
} | null): string | undefined {
  if (!product) return undefined;
  return [
    product.uploadedImage,
    ...(product.gallery || []),
    ...(product.images || []),
    product.image,
  ].find(isRenderableImageSrc);
}

/** Map seed catalog image keys → JerseyRenderer style ids. */
const IMAGE_KEY_STYLE: Record<string, string> = {
  spain_home_2026: "shirt-1",
  england_home_2004: "shirt-2",
  argentina_home_1990: "shirt-3",
  argentina_home_1990_back: "shirt-3",
  brazil_away_2002: "shirt-4",
  man_united_home_1998: "shirt-5",
  juventus_home_2026: "shirt-6",
  arsenal_highbury_2005: "shirt-8",
};

export function resolveJerseyStyleId(
  productId?: string | null,
  imageKey?: string | null,
): string {
  if (productId && /^shirt-\d+$/.test(productId)) return productId;
  if (productId === "brazil-2002-home" || productId === "bulgaria-1994-home") {
    return productId;
  }
  const key = (imageKey || "").replace(/_back$/i, "");
  if (key && IMAGE_KEY_STYLE[key]) return IMAGE_KEY_STYLE[key];
  if (productId && IMAGE_KEY_STYLE[productId]) return IMAGE_KEY_STYLE[productId];
  return productId || "shirt-1";
}

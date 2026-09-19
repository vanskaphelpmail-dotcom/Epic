import type { CartItem, Order, Product } from "../types";
import { parseSelectedBadgeIds } from "./productAddons";
import { parseBkashPaymentMeta } from "./bkashPayment";

const STATUS_MAP: Record<string, Order["status"]> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  PROCESSING: "Processing",
  PACKED: "Packed",
  READY_TO_SHIP: "Ready to Ship",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  RETURNED: "Returned",
  REFUND_REQUEST: "Refund Request",
  REFUNDED: "Cancelled",
};

export function mapOrderStatus(raw?: string | null): Order["status"] {
  if (!raw) return "Pending";
  const key = String(raw).trim();
  if (STATUS_MAP[key.toUpperCase().replace(/\s+/g, "_")]) {
    return STATUS_MAP[key.toUpperCase().replace(/\s+/g, "_")];
  }
  // Already SPA-cased
  const titled = key as Order["status"];
  return titled || "Pending";
}

function mapLineProduct(line: any, fromCart?: Product): Product {
  if (fromCart) return fromCart;
  const linked = line.product || {};
  return {
    id: line.productId || linked.id || `line-${line.id}`,
    name: line.productName || linked.name || "Item",
    slug: linked.slug || line.productSku?.toLowerCase?.() || "item",
    price: Number(line.unitPrice ?? linked.price ?? 0),
    image: line.productImageUrl || linked.imageUrl || "",
    images: line.productImageUrl
      ? [line.productImageUrl]
      : linked.imageUrl
        ? [linked.imageUrl]
        : [],
    brand: linked.brandName || "",
    season: linked.season || "",
    year: linked.year || new Date().getFullYear(),
    condition: "Mint",
    conditionDetail: "",
    color: linked.color || "",
    sizes: line.selectedSize ? [line.selectedSize] : linked.sizes || ["M"],
    sku: line.productSku || linked.sku || "",
    badgeAvailable: !!linked.badgeAvailable,
    printAvailable: !!linked.printAvailable,
    namesetPriceBdt: linked.namesetPriceBdt ?? undefined,
    badgePriceBdt: linked.badgePriceBdt ?? undefined,
    namesetLabel: linked.namesetLabel ?? undefined,
    badgeOptions: linked.badgeOptions ?? undefined,
    rating: Number(linked.rating || 0),
    reviewsCount: linked.reviewsCount || 0,
    description: linked.description || "",
    specification: {
      material: linked.material || "",
      madeIn: linked.madeIn || "",
      fit: linked.fit || "",
    },
    category: linked.brandName || linked.categoryId || "",
    club: linked.club || undefined,
    country: linked.country || undefined,
    league: linked.league || undefined,
    stock: linked.stock ?? 0,
    uploadedImage: undefined,
  } as Product;
}

/** Map Neon/Prisma order payload → SPA Order used by invoice UI */
export function mapApiOrderToSpa(apiOrder: any, cartFallback: CartItem[] = []): Order {
  const items: CartItem[] = (apiOrder?.items || []).map((line: any) => {
    const fromCart = cartFallback.find(
      (c) =>
        c.product.id === line.productId &&
        c.selectedSize === line.selectedSize &&
        (line.customPrintName || '') === (c.customPrint?.name || '') &&
        (line.customPrintNum ?? 0) === (c.customPrint?.number ?? 0),
    );
    return {
      product: mapLineProduct(line, fromCart?.product),
      selectedSize: line.selectedSize || 'M',
      quantity: Math.max(1, Number(line.quantity) || 1),
      customPrint: line.customPrintName
        ? { name: line.customPrintName, number: line.customPrintNum || 0 }
        : undefined,
      selectedBadges: parseSelectedBadgeIds(line.selectedBadgeIds),
      addBadge: !!line.addBadge || !!line.selectedBadgeIds,
    };
  });

  const region =
    String(apiOrder?.deliveryRegion || "").toUpperCase() === "OUTSIDE" ? "outside" : "inside";

  const created = apiOrder?.createdAt ? new Date(apiOrder.createdAt) : new Date();
  const deliveryCharge = Number(apiOrder?.deliveryCharge ?? apiOrder?.shipping ?? 0);
  const bkashMeta = parseBkashPaymentMeta(apiOrder?.customerNotes, apiOrder?.payments);

  return {
    id: apiOrder?.id || apiOrder?.orderNumber || `order-${Date.now()}`,
    orderNumber: apiOrder?.orderNumber || apiOrder?.id || undefined,
    date: created.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    createdAt: apiOrder?.createdAt || created.toISOString(),
    deliveryRegion: region,
    deliveryCharge,
    items,
    subtotal: Number(apiOrder?.subtotal ?? 0),
    tax: Number(apiOrder?.tax ?? 0),
    shipping: Number(apiOrder?.shipping ?? deliveryCharge),
    total: Number(apiOrder?.total ?? 0),
    status: mapOrderStatus(apiOrder?.status),
    trackingNumber: apiOrder?.trackingNumber || apiOrder?.orderNumber,
    carrier: apiOrder?.carrier || undefined,
    trackingUrl: apiOrder?.trackingUrl || undefined,
    shippedDate: apiOrder?.shippedAt
      ? new Date(apiOrder.shippedAt).toISOString().slice(0, 10)
      : undefined,
    internalNotes: apiOrder?.internalNotes || undefined,
    customerNotes: apiOrder?.customerNotes || undefined,
    shippingAddress: {
      fullName: apiOrder?.shipFullName || "Customer",
      email: apiOrder?.shipEmail || undefined,
      addressLine1: apiOrder?.shipAddressLine1 || "",
      addressLine2: apiOrder?.shipAddressLine2 || undefined,
      city: apiOrder?.shipCity || "",
      postalCode: apiOrder?.shipPostalCode || "N/A",
      country: apiOrder?.shipCountry || "Bangladesh",
      phone: apiOrder?.shipPhone || "",
    },
    paymentMethod: apiOrder?.paymentMethod || "CASH ON DELIVERY",
    paymentStatus:
      String(apiOrder?.paymentStatus || "").toUpperCase() === "PAID" ? "Paid" : "Unpaid",
    bkashNumber: apiOrder?.bkashNumber || undefined,
    bkashTransactionId: apiOrder?.bkashTransactionId || undefined,
    bkashPaymentType: bkashMeta?.type,
    bkashPaidAmount: bkashMeta?.paidAmount,
  };
}

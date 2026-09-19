/**
 * Frontend API client — same-origin Next.js App Router `/api/*`.
 * Auth token is stored in localStorage and has no server-side expiry —
 * the session lasts until the user explicitly logs out.
 */

const API_BASE =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_URL
    ? process.env.NEXT_PUBLIC_API_URL
    : ""
  ).replace(/\/$/, "");

const TOKEN_KEY = "jab_auth_token";
const REMEMBER_KEY = "jab_auth_remember";
const USER_KEY = "vault_current_user";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function isApiEnabled() {
  // Default ON. Set NEXT_PUBLIC_USE_API=false to force offline/demo mode.
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_USE_API === "false") return false;
  return true;
}

function apiRoot() {
  return API_BASE || "";
}

export function getToken() {
  if (typeof window === "undefined") return null;
  return (
    localStorage.getItem(TOKEN_KEY) ||
    sessionStorage.getItem(TOKEN_KEY) ||
    null
  );
}

export function setToken(token: string | null, _opts?: { persist?: boolean }) {
  if (typeof window === "undefined") return;
  if (!token) {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REMEMBER_KEY);
    return;
  }
  // Always persist — session ends only on explicit logout
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(REMEMBER_KEY, "1");
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function getStoredUser<T = unknown>(): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    localStorage.removeItem(USER_KEY);
    return null;
  }
}

export function setStoredUser(user: unknown | null) {
  if (typeof window === "undefined") return;
  try {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  } catch {
    /* ignore quota */
  }
}

export function clearSession() {
  setToken(null);
  setStoredUser(null);
}

export function hasApiSession(): boolean {
  return !!getToken();
}

export function isUnauthorizedError(err: unknown): boolean {
  return err instanceof ApiError && (err.status === 401 || err.status === 403);
}

type ApiResult<T> = { success: true; data: T } | { success: false; error: { message: string } };

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers || {});
  if (!headers.has("Content-Type") && init.body) headers.set("Content-Type", "application/json");
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let res: Response;
  try {
    res = await fetch(`${apiRoot()}${path}`, { ...init, headers });
  } catch {
    throw new ApiError("Failed to fetch. Check your connection and try again.", 0);
  }

  const raw = await res.text();
  let json: ApiResult<T> | null = null;
  try {
    json = raw ? (JSON.parse(raw) as ApiResult<T>) : null;
  } catch {
    if (res.status === 413 || /^Request En/i.test(raw)) {
      throw new ApiError(
        "Image too large for upload. Compress the photo and try again (under ~1MB after compression).",
        res.status,
      );
    }
    throw new ApiError(raw?.slice(0, 120) || `Request failed (${res.status})`, res.status);
  }

  if (!res.ok || !json?.success) {
    const rawMsg: unknown = json && "error" in json ? json.error?.message : undefined;
    let message = `Request failed (${res.status})`;
    if (typeof rawMsg === "string" && rawMsg && rawMsg !== "[object Object]") {
      message = rawMsg;
    } else if (rawMsg !== null && rawMsg !== undefined && typeof rawMsg === "object") {
      const nested = (rawMsg as { message?: unknown }).message;
      if (typeof nested === "string" && nested) message = nested;
    }
    throw new ApiError(message === "[object Object]" ? `Request failed (${res.status})` : message, res.status);
  }
  return json.data;
}

export const api = {
  health: () => fetch(`${apiRoot()}/api/health`).then((r) => r.json()),
  login: (email: string, password: string) =>
    request<{ token: string; user: any }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  register: (payload: {
    email: string;
    password: string;
    fullName: string;
    phone: string;
    address: string;
    city?: string;
  }) =>
    request<{ token: string; user: any }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  forgotPassword: (email: string) =>
    request<{ message: string; devResetToken?: string }>("/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),
  resetPassword: (token: string, password: string) =>
    request<{ message: string }>("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    }),
  /** Logged-in user: change password (requires current password). */
  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ message: string }>("/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
  me: () => request<any>("/api/auth/me"),
  /** Re-bind JWT to current Neon user by email (after DB switch / re-seed). */
  rebindSession: () =>
    request<{ token: string; user: any }>("/api/auth/rebind", { method: "POST", body: "{}" }),
  updateProfile: (body: { fullName?: string; phone?: string }) =>
    request<any>("/api/auth/me", { method: "PATCH", body: JSON.stringify(body) }),

  listProducts: (params?: Record<string, string | number>) => {
    const q = new URLSearchParams();
    Object.entries(params || {}).forEach(([k, v]) => q.set(k, String(v)));
    const qs = q.toString();
    return request<{ items: any[]; total: number }>(`/api/products${qs ? `?${qs}` : ""}`);
  },
  /** Fetch every product page until the catalog is complete (no 100-item ceiling). */
  listAllProducts: async (params?: { all?: boolean; q?: string }) => {
    const pageSize = 500;
    const collected: any[] = [];
    let page = 1;
    let total = Number.POSITIVE_INFINITY;
    while (collected.length < total && page <= 40) {
      const res = await request<{ items: any[]; total: number }>(
        `/api/products?${new URLSearchParams({
          limit: String(pageSize),
          page: String(page),
          ...(params?.all ? { all: "1" } : {}),
          ...(params?.q ? { q: params.q } : {}),
        }).toString()}`,
      );
      const items = Array.isArray(res.items) ? res.items : [];
      total = typeof res.total === "number" ? res.total : collected.length + items.length;
      collected.push(...items);
      if (items.length === 0 || items.length < pageSize) break;
      page += 1;
    }
    return { items: collected, total: collected.length };
  },
  getProduct: (idOrSlug: string) => request<any>(`/api/products/${encodeURIComponent(idOrSlug)}`),
  createProduct: (body: unknown) =>
    request<any>("/api/products", { method: "POST", body: JSON.stringify(body) }),
  updateProduct: (id: string, body: unknown) =>
    request<any>(`/api/products/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  deleteProduct: (id: string) =>
    request<{ id: string }>(`/api/products/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),

  listOrders: (opts?: { limit?: number; scope?: "mine" | "all" }) => {
    const params = new URLSearchParams();
    if (opts?.limit != null && Number.isFinite(opts.limit)) {
      params.set("limit", String(Math.min(Math.max(Math.trunc(opts.limit), 1), 100)));
    }
    if (opts?.scope === "mine" || opts?.scope === "all") {
      params.set("scope", opts.scope);
    }
    const q = params.toString() ? `?${params.toString()}` : "";
    return request<{ items: any[] }>(`/api/orders${q}`);
  },
  createOrder: (body: unknown) =>
    request<any>("/api/orders", { method: "POST", body: JSON.stringify(body) }),
  updateOrderStatus: (id: string, status: string, note?: string) =>
    request<any>(`/api/orders/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, note }),
    }),
  updateOrderLogistics: (
    id: string,
    body: {
      carrier?: string;
      trackingNumber?: string;
      trackingUrl?: string;
      shippedAt?: string;
      estimatedDelivery?: string;
      internalNotes?: string;
      customerNotes?: string;
      note?: string;
    },
  ) =>
    request<any>(`/api/orders/${id}/logistics`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  listUsers: (role?: "staff" | "customers" | "all") => {
    const q = role && role !== "all" ? `?role=${role === "customers" ? "customers" : role}` : "";
    return request<any>(`/api/users${q}`);
  },
  createUser: (body: unknown) =>
    request<any>("/api/users", { method: "POST", body: JSON.stringify(body) }),
  updateUser: (id: string, body: unknown) =>
    request<any>(`/api/users/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteUser: (id: string) =>
    request<{ id: string }>(`/api/users/${id}`, { method: "DELETE" }),

  listSellerRequests: () => request<{ items: any[] }>("/api/sellers"),
  updateSellerRequest: (id: string, body: { status?: string; adminNote?: string }) =>
    request<any>(`/api/sellers/${id}`, { method: "PATCH", body: JSON.stringify(body) }),

  getCart: () => request<{ items: any[] }>("/api/cart"),
  syncCart: (items: unknown[]) =>
    request<{ synced: number }>("/api/cart", { method: "PUT", body: JSON.stringify({ items }) }),
  clearCart: () => request<{ cleared: boolean }>("/api/cart", { method: "DELETE" }),

  getWishlist: () => request<{ items: any[] }>("/api/wishlist"),
  addWishlist: (productId: string) =>
    request<{ product: any }>("/api/wishlist", {
      method: "POST",
      body: JSON.stringify({ productId }),
    }),
  removeWishlist: (productId: string) =>
    request<{ productId: string }>(`/api/wishlist/${encodeURIComponent(productId)}`, {
      method: "DELETE",
    }),

  listAddresses: () => request<{ items: any[] }>("/api/addresses"),
  createAddress: (body: unknown) =>
    request<any>("/api/addresses", { method: "POST", body: JSON.stringify(body) }),
  updateAddress: (id: string, body: unknown) =>
    request<any>(`/api/addresses/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteAddress: (id: string) =>
    request<{ id: string }>(`/api/addresses/${id}`, { method: "DELETE" }),

  listReviews: (productId?: string, all?: boolean) => {
    const q = new URLSearchParams();
    if (productId) q.set("productId", productId);
    if (all) q.set("all", "1");
    const qs = q.toString();
    return request<{ items: any[] }>(`/api/reviews${qs ? `?${qs}` : ""}`);
  },
  createReview: (body: { productId: string; rating: number; comment: string }) =>
    request<any>("/api/reviews", { method: "POST", body: JSON.stringify(body) }),
  approveReview: (id: string, approved: boolean) =>
    request<any>(`/api/reviews/${id}/approve`, {
      method: "PATCH",
      body: JSON.stringify({ approved }),
    }),
  deleteReview: (id: string) =>
    request<{ id: string }>(`/api/reviews/${id}`, { method: "DELETE" }),

  listCoupons: () => request<{ items: any[] }>("/api/coupons"),
  validateCoupon: (code: string, orderTotal?: number) =>
    request<any>("/api/coupons/validate", {
      method: "POST",
      body: JSON.stringify({ code, orderTotal }),
    }),
  createCoupon: (body: unknown) =>
    request<any>("/api/coupons", { method: "POST", body: JSON.stringify(body) }),
  updateCoupon: (id: string, body: unknown) =>
    request<any>(`/api/coupons/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteCoupon: (id: string) =>
    request<{ id: string }>(`/api/coupons/${id}`, { method: "DELETE" }),

  listBrands: () => request<{ items: any[] }>("/api/catalog/brands"),
  createBrand: (name: string) =>
    request<any>("/api/catalog/brands", { method: "POST", body: JSON.stringify({ name }) }),
  listLeagues: () => request<{ items: any[] }>("/api/catalog/leagues"),
  createLeague: (body: unknown) =>
    request<any>("/api/catalog/leagues", { method: "POST", body: JSON.stringify(body) }),
  listCategories: () => request<{ items: any[] }>("/api/catalog/categories"),
  createCategory: (body: unknown) =>
    request<any>("/api/catalog/categories", { method: "POST", body: JSON.stringify(body) }),

  homepageCms: () => request<any>("/api/cms/homepage"),
  updateCmsSettings: (body: unknown) =>
    request<any>("/api/cms/settings", { method: "PUT", body: JSON.stringify(body) }),
  updateTournamentPatches: (tournamentPatches: unknown[]) =>
    request<{ tournamentPatches: unknown; syncedProducts?: boolean }>(
      "/api/cms/tournament-patches",
      { method: "PUT", body: JSON.stringify({ tournamentPatches }) },
    ),
  updateCommunityGallery: (communityGallery: unknown) =>
    request<{ communityGallery: unknown }>("/api/cms/community-gallery", {
      method: "PUT",
      body: JSON.stringify({ communityGallery }),
    }),
  updateCustomerFeedbackGallery: (customerFeedbackGallery: unknown) =>
    request<{ customerFeedbackGallery: unknown }>("/api/cms/customer-feedback-gallery", {
      method: "PUT",
      body: JSON.stringify({ customerFeedbackGallery }),
    }),

  listBanners: () => request<{ items: any[] }>("/api/cms/banners"),
  createBanner: (body: unknown) =>
    request<any>("/api/cms/banners", { method: "POST", body: JSON.stringify(body) }),
  updateBanner: (id: string, body: unknown) =>
    request<any>(`/api/cms/banners/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteBanner: (id: string) =>
    request<{ id: string }>(`/api/cms/banners/${id}`, { method: "DELETE" }),
  reorderBanners: (ids: string[]) =>
    request<{ reordered: number }>("/api/cms/banners/reorder", {
      method: "PUT",
      body: JSON.stringify({ ids }),
    }),
  saveCarousel: (slides: unknown[]) =>
    request<{ slides: any[] }>("/api/cms/carousel", {
      method: "PUT",
      body: JSON.stringify({ slides }),
    }),
  saveHomepageSections: (sections: unknown[], categoryItems?: unknown) =>
    request<{ homepageSections: any[] }>("/api/cms/homepage-sections", {
      method: "PUT",
      body: JSON.stringify({ sections, categoryItems }),
    }),

  listPages: () => request<{ items: any[] }>("/api/cms/pages"),
  createPage: (body: unknown) =>
    request<any>("/api/cms/pages", { method: "POST", body: JSON.stringify(body) }),
  updatePage: (id: string, body: unknown) =>
    request<any>(`/api/cms/pages/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deletePage: (id: string) =>
    request<{ id: string }>(`/api/cms/pages/${id}`, { method: "DELETE" }),

  adminStats: () => request<any>("/api/admin/stats"),
  listStockLogs: (productId: string) =>
    request<{ items: any[] }>(`/api/products/${productId}/stock-logs`),

  uploadStatus: () =>
    request<{ configured: boolean; provider: string }>("/api/uploads/status"),
  uploadImage: (body: {
    dataUrl: string;
    folder?: "products" | "banners" | "media" | "avatars" | "categories" | "patches";
    fileName?: string;
  }) =>
    request<{
      url: string;
      publicId: string;
      width?: number;
      height?: number;
      format?: string;
      bytes?: number;
      folder: string;
    }>("/api/uploads/image", { method: "POST", body: JSON.stringify(body) }),
  /** Multipart JPEG upload — preferred on iOS/Android (smaller + more reliable than JSON base64). */
  uploadImageFile: async (opts: {
    file: Blob;
    fileName?: string;
    folder?: "products" | "banners" | "media" | "avatars" | "categories" | "patches";
  }) => {
    const form = new FormData();
    form.append("file", opts.file, opts.fileName || "photo.jpg");
    form.append("folder", opts.folder || "products");
    if (opts.fileName) form.append("fileName", opts.fileName);

    const headers = new Headers();
    const token = getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    // Do NOT set Content-Type — browser sets multipart boundary.

    let res: Response;
    try {
      res = await fetch(`${apiRoot()}/api/uploads/image`, {
        method: "POST",
        headers,
        body: form,
      });
    } catch {
      throw new ApiError("Failed to fetch. Check your connection and try again.", 0);
    }

    const raw = await res.text();
    let json: ApiResult<{
      url: string;
      publicId: string;
      width?: number;
      height?: number;
      format?: string;
      bytes?: number;
      folder: string;
    }> | null = null;
    try {
      json = raw ? (JSON.parse(raw) as typeof json) : null;
    } catch {
      if (res.status === 413) {
        throw new ApiError(
          "Image too large for upload. Compress the photo and try again.",
          res.status,
        );
      }
      throw new ApiError(raw?.slice(0, 120) || `Request failed (${res.status})`, res.status);
    }

    if (!res.ok || !json?.success) {
      const rawMsg = json && "error" in json ? json.error?.message : undefined;
      const message =
        typeof rawMsg === "string" && rawMsg && rawMsg !== "[object Object]"
          ? rawMsg
          : `Request failed (${res.status})`;
      throw new ApiError(message, res.status);
    }
    return json.data;
  },
  deleteUploadedImage: (publicId: string) =>
    request<{ deleted: string }>("/api/uploads/image", {
      method: "DELETE",
      body: JSON.stringify({ publicId }),
    }),
};

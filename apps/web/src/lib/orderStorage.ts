import type { Order } from '../types';
import { isApiEnabled } from './apiClient';

const STORAGE_KEY = 'vault_orders';
const MAX_ORDERS = 30;

function slimProduct(product: Order['items'][number]['product']) {
  const image =
    typeof product.image === 'string' && product.image.startsWith('data:') ? '' : product.image;
  const images = (product.images || [])
    .filter((url) => typeof url === 'string' && !url.startsWith('data:'))
    .slice(0, 3);

  return {
    ...product,
    image,
    images,
    gallery: undefined,
    uploadedImage: undefined,
  };
}

function slimOrder(order: Order): Order {
  return {
    ...order,
    items: (order.items || []).map((item) => ({
      ...item,
      product: slimProduct(item.product),
    })),
  };
}

export function clearStoredOrders(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* private mode / disabled storage */
  }
}

/** Persist orders only in offline/demo mode — never when Neon API is active. */
export function persistOrders(orders: Order[]): void {
  if (isApiEnabled()) {
    clearStoredOrders();
    return;
  }

  try {
    const payload = orders.slice(0, MAX_ORDERS).map(slimOrder);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn('[orderStorage] Could not save orders to localStorage', err);
    clearStoredOrders();
  }
}

export function loadStoredOrders(): Order[] {
  if (isApiEnabled()) {
    clearStoredOrders();
    return [];
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((o: Order) => o?.id && !String(o.id).startsWith('ORD-SIM-'));
  } catch {
    clearStoredOrders();
    return [];
  }
}

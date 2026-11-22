import { ApiResponse, Cart } from '../types/index.ts';
import { getStoredToken } from './auth.ts';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const buildUrl = (endpoint: string, params?: Record<string, string | undefined>): string => {
  const cleanBase = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL;
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = new URL(`${cleanBase}${cleanEndpoint}`, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        url.searchParams.append(key, val);
      }
    });
  }
  return url.toString();
};

const getAuthHeaders = (): Record<string, string> => {
  const token = getStoredToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

/**
 * Fetch authenticated customer's persistent PostgreSQL cart.
 * Optionally passes city to compute city warehouse availability.
 */
export const getCart = async (city?: string): Promise<Cart> => {
  const url = buildUrl('/cart', city ? { city } : undefined);
  const res = await fetch(url, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  const json: ApiResponse<Cart> = await res.json().catch(() => ({
    status: 'error',
    message: `Cart request failed (HTTP ${res.status})`,
    data: null as unknown as Cart,
  }));

  if (!res.ok || json.status !== 'ok') {
    throw new Error(json.message || 'Failed to retrieve cart.');
  }

  return json.data;
};

/**
 * Add product item to cart.
 */
export const addCartItem = async (
  productId: string,
  quantity = 1,
  city?: string
): Promise<Cart> => {
  const url = buildUrl('/cart/items');
  const res = await fetch(url, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      productId,
      quantity,
      ...(city ? { city } : {}),
    }),
  });

  const json: ApiResponse<Cart> = await res.json().catch(() => ({
    status: 'error',
    message: `Add to cart failed (HTTP ${res.status})`,
    data: null as unknown as Cart,
  }));

  if (!res.ok || json.status !== 'ok') {
    throw new Error(json.message || 'Failed to add item to cart.');
  }

  return json.data;
};

/**
 * Update quantity of an existing item in cart.
 */
export const updateCartItem = async (
  productId: string,
  quantity: number,
  city?: string
): Promise<Cart> => {
  const url = buildUrl(`/cart/items/${productId}`);
  const res = await fetch(url, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify({
      quantity,
      ...(city ? { city } : {}),
    }),
  });

  const json: ApiResponse<Cart> = await res.json().catch(() => ({
    status: 'error',
    message: `Update cart failed (HTTP ${res.status})`,
    data: null as unknown as Cart,
  }));

  if (!res.ok || json.status !== 'ok') {
    throw new Error(json.message || 'Failed to update item quantity.');
  }

  return json.data;
};

/**
 * Remove an item from the cart.
 */
export const removeCartItem = async (productId: string): Promise<{ message: string }> => {
  const url = buildUrl(`/cart/items/${productId}`);
  const res = await fetch(url, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });

  const json: ApiResponse<null> = await res.json().catch(() => ({
    status: 'error',
    message: `Remove cart item failed (HTTP ${res.status})`,
    data: null,
  }));

  if (!res.ok || json.status !== 'ok') {
    throw new Error(json.message || 'Failed to remove item from cart.');
  }

  return { message: json.message || 'Item removed from cart.' };
};

/**
 * Clears all items from the customer's cart.
 */
export const clearCart = async (): Promise<{ message: string }> => {
  const url = buildUrl('/cart');
  const res = await fetch(url, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });

  const json: ApiResponse<null> = await res.json().catch(() => ({
    status: 'error',
    message: `Clear cart failed (HTTP ${res.status})`,
    data: null,
  }));

  if (!res.ok || json.status !== 'ok') {
    throw new Error(json.message || 'Failed to clear cart.');
  }

  return { message: json.message || 'Cart cleared successfully.' };
};


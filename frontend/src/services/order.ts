import { ApiResponse, CheckoutPayload, Order, OrderSummary } from '../types/index.ts';
import { getStoredToken } from './auth.ts';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const buildUrl = (endpoint: string): string => {
  const cleanBase = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL;
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return new URL(`${cleanBase}${cleanEndpoint}`, window.location.origin).toString();
};

const getAuthHeaders = (): Record<string, string> => {
  const token = getStoredToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

/**
 * Execute atomic checkout transaction in PostgreSQL.
 * Deducts stock, locks rows with SELECT FOR UPDATE, creates order and order_items,
 * writes to outbox_events, and clears cart items.
 */
export const placeOrder = async (
  payload: CheckoutPayload
): Promise<{ order: Order; is_idempotent_replay?: boolean }> => {
  const url = buildUrl('/checkout');
  const res = await fetch(url, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  const json: ApiResponse<Order> = await res.json().catch(() => ({
    status: 'error',
    message: `Checkout failed with status ${res.status}`,
    data: null as unknown as Order,
  }));

  if (!res.ok || json.status !== 'ok') {
    throw new Error(json.message || 'Checkout failed. Please review your cart and try again.');
  }

  const isReplay = res.status === 200 || json.message?.includes('Idempotent replay');
  return {
    order: json.data,
    is_idempotent_replay: isReplay,
  };
};

/**
 * Retrieve list of orders placed by authenticated user.
 */
export const getOrders = async (): Promise<OrderSummary[]> => {
  const url = buildUrl('/orders');
  const res = await fetch(url, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  const json: ApiResponse<OrderSummary[]> = await res.json().catch(() => ({
    status: 'error',
    message: `Orders request failed (HTTP ${res.status})`,
    data: [],
  }));

  if (!res.ok || json.status !== 'ok') {
    throw new Error(json.message || 'Failed to retrieve order history.');
  }

  return json.data || [];
};

/**
 * Retrieve specific order by ID (with cross-user isolation).
 */
export const getOrderById = async (orderId: string): Promise<Order> => {
  const url = buildUrl(`/orders/${orderId}`);
  const res = await fetch(url, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  const json: ApiResponse<Order> = await res.json().catch(() => ({
    status: 'error',
    message: `Order request failed (HTTP ${res.status})`,
    data: null as unknown as Order,
  }));

  if (!res.ok || json.status !== 'ok') {
    throw new Error(json.message || 'Order not found.');
  }

  return json.data;
};


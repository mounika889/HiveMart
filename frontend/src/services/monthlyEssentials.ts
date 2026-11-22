import {
  MonthlyEssentialList,
  MonthlyEssentialItem,
  MonthlyReminder,
  AddEssentialsToCartResult,
} from '../types/index.ts';
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
 * Get all monthly essentials lists for the authenticated customer.
 */
export async function getMonthlyLists(): Promise<MonthlyEssentialList[]> {
  const url = buildUrl('/customer/monthly-essentials');
  const res = await fetch(url, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.message || 'Failed to retrieve monthly essentials lists.');
  }

  return json.data || [];
}

/**
 * Get details of a single monthly essentials list with live items, prices, and city stock.
 */
export async function getMonthlyList(listId: string, city = 'Bengaluru'): Promise<MonthlyEssentialList> {
  const url = buildUrl(`/customer/monthly-essentials/${listId}`, { city });
  const res = await fetch(url, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.message || 'Failed to retrieve monthly list details.');
  }

  return json.data;
}

/**
 * Create a new monthly essentials list.
 */
export async function createMonthlyList(data: {
  name: string;
  shopping_day: number;
  reminder_days_before?: number;
}): Promise<MonthlyEssentialList> {
  const url = buildUrl('/customer/monthly-essentials');
  const res = await fetch(url, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.message || 'Failed to create monthly essentials list.');
  }

  return json.data;
}

/**
 * Update monthly essentials list settings (name, shopping_day, reminder_days_before).
 */
export async function updateMonthlyList(
  listId: string,
  data: {
    name?: string;
    shopping_day?: number;
    reminder_days_before?: number;
  }
): Promise<MonthlyEssentialList> {
  const url = buildUrl(`/customer/monthly-essentials/${listId}`);
  const res = await fetch(url, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.message || 'Failed to update monthly essentials list.');
  }

  return json.data;
}

/**
 * Toggle active / paused status of a monthly list.
 */
export async function toggleMonthlyListStatus(listId: string, isActive: boolean): Promise<MonthlyEssentialList> {
  const url = buildUrl(`/customer/monthly-essentials/${listId}/status`);
  const res = await fetch(url, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify({ is_active: isActive }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.message || 'Failed to update list status.');
  }

  return json.data;
}

/**
 * Delete a monthly essentials list.
 */
export async function deleteMonthlyList(listId: string): Promise<void> {
  const url = buildUrl(`/customer/monthly-essentials/${listId}`);
  const res = await fetch(url, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.message || 'Failed to delete monthly list.');
  }
}

/**
 * Add product to monthly essentials list.
 */
export async function addMonthlyItem(
  listId: string,
  data: { productId: string; quantity: number }
): Promise<MonthlyEssentialItem> {
  const url = buildUrl(`/customer/monthly-essentials/${listId}/items`);
  const res = await fetch(url, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.message || 'Failed to add item to monthly list.');
  }

  return json.data;
}

/**
 * Update quantity of an item in a monthly list.
 */
export async function updateMonthlyItemQuantity(
  listId: string,
  itemId: string,
  quantity: number
): Promise<MonthlyEssentialItem> {
  const url = buildUrl(`/customer/monthly-essentials/${listId}/items/${itemId}`);
  const res = await fetch(url, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({ quantity }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.message || 'Failed to update item quantity.');
  }

  return json.data;
}

/**
 * Remove an item from a monthly list.
 */
export async function removeMonthlyItem(listId: string, itemId: string): Promise<void> {
  const url = buildUrl(`/customer/monthly-essentials/${listId}/items/${itemId}`);
  const res = await fetch(url, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.message || 'Failed to remove item from monthly list.');
  }
}

/**
 * Fetch due reminders for the customer.
 */
export async function getMonthlyReminders(): Promise<MonthlyReminder[]> {
  const url = buildUrl('/customer/monthly-essentials/reminders');
  const res = await fetch(url, {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.message || 'Failed to retrieve reminders.');
  }

  return json.data || [];
}

/**
 * Mark a reminder as read.
 */
export async function markMonthlyReminderRead(reminderId: string): Promise<MonthlyReminder> {
  const url = buildUrl(`/customer/monthly-essentials/reminders/${reminderId}/read`);
  const res = await fetch(url, {
    method: 'PATCH',
    headers: getAuthHeaders(),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.message || 'Failed to mark reminder as read.');
  }

  return json.data;
}

/**
 * Add all items from a monthly list to customer's active cart.
 */
export async function addMonthlyEssentialsToCart(
  listId: string,
  city = 'Bengaluru'
): Promise<AddEssentialsToCartResult> {
  const url = buildUrl(`/customer/monthly-essentials/${listId}/add-to-cart`);
  const res = await fetch(url, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ city }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.message || 'Failed to add essentials to cart.');
  }

  return json;
}


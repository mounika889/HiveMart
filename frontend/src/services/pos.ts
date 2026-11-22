import {
  AdminOfflineOverviewData,
  ApiResponse,
  FinalizeBillResponse,
  InventoryMovement,
  OfflineBill,
  OfflineBillItem,
  PaginationMetadata,
} from '../types/index.ts';
import { getStoredToken } from './auth.ts';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const buildUrl = (endpoint: string, params?: Record<string, string | number | undefined>): string => {
  const cleanBase = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL;
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = new URL(`${cleanBase}${cleanEndpoint}`, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        url.searchParams.append(key, String(val));
      }
    });
  }
  return url.toString();
};

const getAuthHeaders = (): HeadersInit => {
  const token = getStoredToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

/**
 * Create a new DRAFT bill for retailer POS
 */
export const createDraftBill = async (payload?: {
  paymentMethod?: string;
  notes?: string;
  items?: { productId: string; quantity: number }[];
}): Promise<{ bill: OfflineBill; items: OfflineBillItem[] }> => {
  const res = await fetch(buildUrl('/retailer/pos/bills'), {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload || {}),
  });

  const json: ApiResponse<{ bill: OfflineBill; items: OfflineBillItem[] }> = await res.json().catch(() => ({
    status: 'error',
    message: `HTTP error ${res.status}`,
    data: { bill: null as unknown as OfflineBill, items: [] },
  }));

  if (!res.ok || json.status !== 'ok') {
    throw new Error(json.message || 'Failed to initialize draft bill.');
  }

  return json.data;
};

/**
 * Get active DRAFT bill for retailer (if any)
 */
export const getActiveDraftBill = async (): Promise<{ bill: OfflineBill; items: OfflineBillItem[] } | null> => {
  const res = await fetch(buildUrl('/retailer/pos/bills/draft'), {
    headers: getAuthHeaders(),
  });

  const json: ApiResponse<{ bill: OfflineBill; items: OfflineBillItem[] } | null> = await res.json().catch(() => ({
    status: 'error',
    message: `HTTP error ${res.status}`,
    data: null,
  }));

  if (!res.ok || json.status !== 'ok') {
    throw new Error(json.message || 'Failed to retrieve active draft bill.');
  }

  return json.data;
};

/**
 * Update items in an existing DRAFT bill
 */
export const updateDraftItems = async (
  billId: string,
  payload: {
    items: { productId: string; quantity: number }[];
    notes?: string;
    paymentMethod?: string;
  }
): Promise<{ bill: OfflineBill; items: OfflineBillItem[] }> => {
  const res = await fetch(buildUrl(`/retailer/pos/bills/${billId}/items`), {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  const json: ApiResponse<{ bill: OfflineBill; items: OfflineBillItem[] }> = await res.json().catch(() => ({
    status: 'error',
    message: `HTTP error ${res.status}`,
    data: { bill: null as unknown as OfflineBill, items: [] },
  }));

  if (!res.ok || json.status !== 'ok') {
    throw new Error(json.message || 'Failed to update draft bill items.');
  }

  return json.data;
};

/**
 * Cancel a DRAFT bill
 */
export const cancelDraftBill = async (billId: string): Promise<OfflineBill> => {
  const res = await fetch(buildUrl(`/retailer/pos/bills/${billId}/cancel`), {
    method: 'POST',
    headers: getAuthHeaders(),
  });

  const json: ApiResponse<OfflineBill> = await res.json().catch(() => ({
    status: 'error',
    message: `HTTP error ${res.status}`,
    data: null as unknown as OfflineBill,
  }));

  if (!res.ok || json.status !== 'ok') {
    throw new Error(json.message || 'Failed to cancel draft bill.');
  }

  return json.data;
};

/**
 * ATOMIC BILL FINALIZATION:
 * Commits finalized bill, creates offline sale, deducts city warehouse inventory,
 * and records inventory movements in one PostgreSQL transaction.
 */
export const finalizeBill = async (
  billId: string,
  payload: { idempotencyKey: string; paymentMethod?: string; notes?: string }
): Promise<FinalizeBillResponse> => {
  const res = await fetch(buildUrl(`/retailer/pos/bills/${billId}/finalize`), {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  const json: ApiResponse<FinalizeBillResponse> = await res.json().catch(() => ({
    status: 'error',
    message: `HTTP error ${res.status}`,
    data: null as unknown as FinalizeBillResponse,
  }));

  if (!res.ok || json.status !== 'ok') {
    throw new Error(json.message || 'Failed to finalize bill.');
  }

  return json.data;
};

/**
 * List retailer bills history
 */
export const listRetailerBills = async (params?: {
  status?: string;
  page?: number;
  limit?: number;
}): Promise<{ bills: OfflineBill[]; pagination: PaginationMetadata | undefined }> => {
  const res = await fetch(buildUrl('/retailer/pos/bills', params), {
    headers: getAuthHeaders(),
  });

  const json: ApiResponse<OfflineBill[]> = await res.json().catch(() => ({
    status: 'error',
    message: `HTTP error ${res.status}`,
    data: [],
  }));

  if (!res.ok || json.status !== 'ok') {
    throw new Error(json.message || 'Failed to fetch bills.');
  }

  return {
    bills: json.data || [],
    pagination: json.pagination,
  };
};

export const getRetailerBills = listRetailerBills;

/**
 * Get bill receipt details by ID
 */
export const getRetailerBillById = async (
  billId: string
): Promise<{ bill: OfflineBill; items: OfflineBillItem[]; sale: unknown }> => {
  const res = await fetch(buildUrl(`/retailer/pos/bills/${billId}`), {
    headers: getAuthHeaders(),
  });

  const json: ApiResponse<{ bill: OfflineBill; items: OfflineBillItem[]; sale: unknown }> = await res
    .json()
    .catch(() => ({
      status: 'error',
      message: `HTTP error ${res.status}`,
      data: { bill: null as unknown as OfflineBill, items: [], sale: null },
    }));

  if (!res.ok || json.status !== 'ok') {
    throw new Error(json.message || 'Failed to load bill receipt details.');
  }

  return json.data;
};

/**
 * Admin: Get overview of offline sales across all hubs
 */
export const getAdminOfflineOverview = async (): Promise<AdminOfflineOverviewData> => {
  const res = await fetch(buildUrl('/admin/offline/overview'), {
    headers: getAuthHeaders(),
  });

  const json: ApiResponse<AdminOfflineOverviewData> = await res.json().catch(() => ({
    status: 'error',
    message: `HTTP error ${res.status}`,
    data: null as unknown as AdminOfflineOverviewData,
  }));

  if (!res.ok || json.status !== 'ok') {
    throw new Error(json.message || 'Failed to fetch offline overview.');
  }

  return json.data;
};

/**
 * Admin: Get immutable inventory movements audit log
 */
export const getAdminInventoryMovements = async (params?: {
  page?: number;
  limit?: number;
  city?: string;
  movementType?: string;
}): Promise<{ movements: InventoryMovement[]; pagination: PaginationMetadata | undefined }> => {
  const res = await fetch(buildUrl('/admin/inventory/movements', params), {
    headers: getAuthHeaders(),
  });

  const json: ApiResponse<InventoryMovement[]> = await res.json().catch(() => ({
    status: 'error',
    message: `HTTP error ${res.status}`,
    data: [],
  }));

  if (!res.ok || json.status !== 'ok') {
    throw new Error(json.message || 'Failed to fetch inventory movements.');
  }

  return {
    movements: json.data || [],
    pagination: json.pagination,
  };
};

/**
 * Admin: Get single bill by ID
 */
export const getAdminBillById = async (
  billId: string
): Promise<{ bill: OfflineBill; items: OfflineBillItem[]; sale: unknown }> => {
  const res = await fetch(buildUrl(`/admin/offline/bills/${billId}`), {
    headers: getAuthHeaders(),
  });

  const json: ApiResponse<{ bill: OfflineBill; items: OfflineBillItem[]; sale: unknown }> = await res
    .json()
    .catch(() => ({
      status: 'error',
      message: `HTTP error ${res.status}`,
      data: { bill: null as unknown as OfflineBill, items: [], sale: null },
    }));

  if (!res.ok || json.status !== 'ok') {
    throw new Error(json.message || 'Failed to fetch bill.');
  }

  return json.data;
};

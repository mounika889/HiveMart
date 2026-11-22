import {
  AdminOverviewData,
  AdminRetailerItem,
  ApiResponse,
  CreateRetailerPayload,
  RetailerApprovalStatus,
  SupportedCity,
} from '../types/index.ts';
import { getStoredToken } from './auth.ts';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const buildUrl = (endpoint: string): string => {
  const cleanBase = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL;
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return new URL(`${cleanBase}${cleanEndpoint}`, window.location.origin).toString();
};

const getAuthHeaders = (): HeadersInit => {
  const token = getStoredToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

/**
 * Fetch platform overview statistics
 */
export const getAdminOverview = async (): Promise<AdminOverviewData> => {
  const res = await fetch(buildUrl('/admin/overview'), {
    headers: getAuthHeaders(),
  });

  const json: ApiResponse<AdminOverviewData> = await res.json().catch(() => ({
    status: 'error',
    message: `HTTP error ${res.status}`,
    data: null as unknown as AdminOverviewData,
  }));

  if (!res.ok || json.status !== 'ok') {
    throw new Error(json.message || 'Failed to fetch administrator overview data.');
  }

  return json.data;
};

/**
 * List all registered retailers
 */
export const getAdminRetailers = async (): Promise<AdminRetailerItem[]> => {
  const res = await fetch(buildUrl('/admin/retailers'), {
    headers: getAuthHeaders(),
  });

  const json: ApiResponse<AdminRetailerItem[]> = await res.json().catch(() => ({
    status: 'error',
    message: `HTTP error ${res.status}`,
    data: [],
  }));

  if (!res.ok || json.status !== 'ok') {
    throw new Error(json.message || 'Failed to fetch retailers list.');
  }

  return json.data;
};

/**
 * Create a new retailer account
 */
export const createRetailer = async (payload: CreateRetailerPayload): Promise<AdminRetailerItem> => {
  const res = await fetch(buildUrl('/admin/retailers'), {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  const json: ApiResponse<AdminRetailerItem> = await res.json().catch(() => ({
    status: 'error',
    message: `HTTP error ${res.status}`,
    data: null as unknown as AdminRetailerItem,
  }));

  if (!res.ok || json.status !== 'ok') {
    throw new Error(json.message || 'Failed to create retailer.');
  }

  return json.data;
};

/**
 * Update retailer approval status
 */
export const updateRetailerStatus = async (
  userId: string,
  approvalStatus: RetailerApprovalStatus
): Promise<void> => {
  const res = await fetch(buildUrl(`/admin/retailers/${userId}/status`), {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify({ approvalStatus }),
  });

  const json: ApiResponse<unknown> = await res.json().catch(() => ({
    status: 'error',
    message: `HTTP error ${res.status}`,
    data: null,
  }));

  if (!res.ok || json.status !== 'ok') {
    throw new Error(json.message || 'Failed to update retailer status.');
  }
};

/**
 * Update retailer assigned city
 */
export const updateRetailerCity = async (
  userId: string,
  assignedCity: SupportedCity
): Promise<void> => {
  const res = await fetch(buildUrl(`/admin/retailers/${userId}/city`), {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify({ assignedCity }),
  });

  const json: ApiResponse<unknown> = await res.json().catch(() => ({
    status: 'error',
    message: `HTTP error ${res.status}`,
    data: null,
  }));

  if (!res.ok || json.status !== 'ok') {
    throw new Error(json.message || 'Failed to update retailer city assignment.');
  }
};

/**
 * Toggle user active/deactivated state
 */
export const updateRetailerActive = async (userId: string, isActive: boolean): Promise<void> => {
  const res = await fetch(buildUrl(`/admin/retailers/${userId}/active`), {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify({ isActive }),
  });

  const json: ApiResponse<unknown> = await res.json().catch(() => ({
    status: 'error',
    message: `HTTP error ${res.status}`,
    data: null,
  }));

  if (!res.ok || json.status !== 'ok') {
    throw new Error(json.message || 'Failed to update user active status.');
  }
};


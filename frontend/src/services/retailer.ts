import { ApiResponse, RetailerDashboardData } from '../types/index.ts';
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
 * Fetch retailer dashboard data including assigned city inventory
 */
export const getRetailerDashboard = async (): Promise<RetailerDashboardData> => {
  const res = await fetch(buildUrl('/retailer/dashboard'), {
    headers: getAuthHeaders(),
  });

  const json: ApiResponse<RetailerDashboardData> = await res.json().catch(() => ({
    status: 'error',
    message: `HTTP error ${res.status}`,
    data: null as unknown as RetailerDashboardData,
  }));

  if (!res.ok || json.status !== 'ok') {
    throw new Error(json.message || 'Failed to fetch retailer dashboard data.');
  }

  return json.data;
};


import {
  NotificationItem,
  StockAlert,
  BestsellerReport,
  StockAlertSetting,
} from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

const getAuthHeaders = (): HeadersInit => {
  const token = localStorage.getItem('hivemart_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

/**
 * GET /api/retailer/notifications
 */
export const getRetailerNotifications = async (params: {
  isRead?: boolean | string;
  type?: string;
  page?: number;
  limit?: number;
} = {}): Promise<{
  notifications: NotificationItem[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
}> => {
  const query = new URLSearchParams();
  if (params.isRead !== undefined && params.isRead !== '') query.append('is_read', String(params.isRead));
  if (params.type && params.type !== 'ALL') query.append('type', params.type);
  if (params.page) query.append('page', String(params.page));
  if (params.limit) query.append('limit', String(params.limit));

  const res = await fetch(`${API_BASE}/retailer/notifications?${query.toString()}`, {
    headers: getAuthHeaders(),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || 'Failed to fetch notifications.');
  }

  return {
    notifications: json.data || [],
    pagination: json.pagination || { total: 0, page: 1, limit: 20, totalPages: 1 },
  };
};

/**
 * GET /api/retailer/notifications/unread-count
 */
export const getUnreadNotificationCount = async (): Promise<number> => {
  const res = await fetch(`${API_BASE}/retailer/notifications/unread-count`, {
    headers: getAuthHeaders(),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || 'Failed to fetch unread count.');
  }

  return json.data?.unread_count || 0;
};

/**
 * PATCH /api/retailer/notifications/:id/read
 */
export const markNotificationAsRead = async (id: string): Promise<NotificationItem> => {
  const res = await fetch(`${API_BASE}/retailer/notifications/${id}/read`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || 'Failed to mark notification as read.');
  }

  return json.data;
};

/**
 * PATCH /api/retailer/notifications/read-all
 */
export const markAllNotificationsAsRead = async (): Promise<{ markedCount: number }> => {
  const res = await fetch(`${API_BASE}/retailer/notifications/read-all`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || 'Failed to mark all as read.');
  }

  return json.data;
};

/**
 * PATCH /api/retailer/notifications/:id/acknowledge
 */
export const acknowledgeNotificationAlert = async (alertId: string): Promise<StockAlert> => {
  const res = await fetch(`${API_BASE}/retailer/notifications/${alertId}/acknowledge`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || 'Failed to acknowledge alert.');
  }

  return json.data;
};

/**
 * GET /api/retailer/stock-alerts
 */
export const getRetailerStockAlerts = async (params: {
  status?: string;
  severity?: string;
  page?: number;
  limit?: number;
} = {}): Promise<{
  alerts: StockAlert[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
}> => {
  const query = new URLSearchParams();
  if (params.status) query.append('status', params.status);
  if (params.severity) query.append('severity', params.severity);
  if (params.page) query.append('page', String(params.page));
  if (params.limit) query.append('limit', String(params.limit));

  const res = await fetch(`${API_BASE}/retailer/stock-alerts?${query.toString()}`, {
    headers: getAuthHeaders(),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || 'Failed to fetch retailer stock alerts.');
  }

  return {
    alerts: json.data || [],
    pagination: json.pagination || { total: 0, page: 1, limit: 20, totalPages: 1 },
  };
};

/**
 * GET /api/retailer/bestsellers
 */
export const getRetailerBestsellers = async (limit: number = 10): Promise<BestsellerReport> => {
  const res = await fetch(`${API_BASE}/retailer/bestsellers?limit=${limit}`, {
    headers: getAuthHeaders(),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || 'Failed to fetch bestsellers.');
  }

  return json.data;
};

/**
 * GET /api/admin/stock-alerts
 */
export const getAdminStockAlerts = async (params: {
  city?: string;
  severity?: string;
  status?: string;
  page?: number;
  limit?: number;
} = {}): Promise<{
  alerts: StockAlert[];
  overview: {
    bySeverity: { severity: string; count: number }[];
    byCity: {
      city: string;
      total_active: number;
      out_of_stock: number;
      critical_stock: number;
      low_stock: number;
      reorder_soon: number;
    }[];
  };
  pagination: { total: number; page: number; limit: number; totalPages: number };
}> => {
  const query = new URLSearchParams();
  if (params.city) query.append('city', params.city);
  if (params.severity) query.append('severity', params.severity);
  if (params.status) query.append('status', params.status);
  if (params.page) query.append('page', String(params.page));
  if (params.limit) query.append('limit', String(params.limit));

  const res = await fetch(`${API_BASE}/admin/stock-alerts?${query.toString()}`, {
    headers: getAuthHeaders(),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || 'Failed to fetch admin stock alerts.');
  }

  return {
    alerts: json.data || [],
    overview: json.overview || { bySeverity: [], byCity: [] },
    pagination: json.pagination || { total: 0, page: 1, limit: 50, totalPages: 1 },
  };
};

/**
 * GET /api/admin/bestsellers
 */
export const getAdminBestsellers = async (params: {
  city?: string;
  limit?: number;
} = {}): Promise<BestsellerReport | { cities: BestsellerReport[] }> => {
  const query = new URLSearchParams();
  if (params.city) query.append('city', params.city);
  if (params.limit) query.append('limit', String(params.limit));

  const res = await fetch(`${API_BASE}/admin/bestsellers?${query.toString()}`, {
    headers: getAuthHeaders(),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || 'Failed to fetch admin bestsellers.');
  }

  return json.data;
};

/**
 * GET /api/admin/stock-thresholds
 */
export const getAdminStockThresholds = async (params: {
  city?: string;
  productId?: string;
  page?: number;
  limit?: number;
} = {}): Promise<{
  settings: StockAlertSetting[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
}> => {
  const query = new URLSearchParams();
  if (params.city) query.append('city', params.city);
  if (params.productId) query.append('productId', params.productId);
  if (params.page) query.append('page', String(params.page));
  if (params.limit) query.append('limit', String(params.limit));

  const res = await fetch(`${API_BASE}/admin/stock-thresholds?${query.toString()}`, {
    headers: getAuthHeaders(),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || 'Failed to fetch stock thresholds.');
  }

  return {
    settings: json.data || [],
    pagination: json.pagination || { total: 0, page: 1, limit: 50, totalPages: 1 },
  };
};

/**
 * PATCH /api/admin/stock-thresholds/:id or PUT /api/admin/stock-thresholds
 */
export const updateAdminStockThreshold = async (payload: {
  productId: string;
  city: string;
  earlyWarningThreshold: number;
  minimumStockThreshold: number;
  criticalStockThreshold: number;
  enabled?: boolean;
}): Promise<StockAlertSetting> => {
  const res = await fetch(`${API_BASE}/admin/stock-thresholds/${payload.productId}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || 'Failed to update stock threshold.');
  }

  return json.data;
};

/**
 * POST /api/admin/analytics/refresh
 */
export const refreshAnalytics = async (): Promise<{ success: boolean; timestamp: string }> => {
  const res = await fetch(`${API_BASE}/admin/analytics/refresh`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || 'Failed to refresh analytics.');
  }

  return json.data;
};


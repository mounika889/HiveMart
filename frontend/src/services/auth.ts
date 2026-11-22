import { ApiResponse, AuthResponse, LoginData, RegisterData, User } from '../types/index.ts';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
const TOKEN_KEY = 'hivemart_token';

/**
 * Storage helpers for authentication token.
 */
export const getStoredToken = (): string | null => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setStoredToken = (token: string): void => {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch (err) {
    console.warn('Unable to persist auth token:', err);
  }
};

export const removeStoredToken = (): void => {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch (err) {
    console.warn('Unable to remove auth token:', err);
  }
};

/**
 * Normalizes API URL ensuring no double-slashes or missing slashes.
 */
const buildUrl = (endpoint: string): string => {
  const cleanBase = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL;
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return new URL(`${cleanBase}${cleanEndpoint}`, window.location.origin).toString();
};

/**
 * Register a new customer account.
 */
export const registerUser = async (data: RegisterData): Promise<AuthResponse> => {
  const res = await fetch(buildUrl('/auth/register'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  const json: ApiResponse<AuthResponse> = await res.json().catch(() => ({
    status: 'error',
    message: `HTTP error ${res.status}`,
    data: null as unknown as AuthResponse,
  }));

  if (!res.ok || json.status !== 'ok') {
    throw new Error(json.message || 'Registration failed. Please check your information and try again.');
  }

  return json.data;
};

/**
 * Login existing customer with email and password.
 */
export const loginUser = async (data: LoginData): Promise<AuthResponse> => {
  const res = await fetch(buildUrl('/auth/login'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  const json: ApiResponse<AuthResponse> = await res.json().catch(() => ({
    status: 'error',
    message: `HTTP error ${res.status}`,
    data: null as unknown as AuthResponse,
  }));

  if (!res.ok || json.status !== 'ok') {
    throw new Error(json.message || 'Invalid email or password.');
  }

  return json.data;
};

/**
 * Retrieve current user profile using JWT Bearer token.
 */
export const getCurrentUser = async (token?: string): Promise<User> => {
  const authToken = token || getStoredToken();
  if (!authToken) {
    throw new Error('No authorization token found.');
  }

  const res = await fetch(buildUrl('/auth/me'), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
  });

  const json: ApiResponse<{ user: User }> = await res.json().catch(() => ({
    status: 'error',
    message: `HTTP error ${res.status}`,
    data: null as unknown as { user: User },
  }));

  if (!res.ok || json.status !== 'ok') {
    throw new Error(json.message || 'Session expired or invalid.');
  }

  return json.data.user;
};


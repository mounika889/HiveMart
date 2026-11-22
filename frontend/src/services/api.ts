import { ApiResponse, CategoryInfo, Product, ProductQueryParams, SearchParams } from '../types/index.ts';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

/**
 * Normalizes API URL ensuring no double-slashes or missing slashes.
 */
const buildUrl = (endpoint: string, params?: Record<string, string | number | boolean | undefined>): string => {
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

/**
 * Fetch health status of the backend API.
 */
export const checkHealth = async (signal?: AbortSignal): Promise<boolean> => {
  try {
    const res = await fetch(buildUrl('/health'), { signal });
    return res.ok;
  } catch {
    return false;
  }
};

/**
 * Fetch distinct active categories with product counts.
 */
export const getCategories = async (signal?: AbortSignal): Promise<CategoryInfo[]> => {
  const res = await fetch(buildUrl('/categories'), { signal });
  if (!res.ok) {
    throw new Error(`Failed to fetch categories: HTTP ${res.status}`);
  }
  const json: ApiResponse<CategoryInfo[]> = await res.json();
  if (json.status !== 'ok') {
    throw new Error(json.message || 'Error fetching categories');
  }
  return json.data;
};

/**
 * Fetch paginated products from PostgreSQL catalog endpoint.
 */
export const getProducts = async (
  params: ProductQueryParams = {},
  signal?: AbortSignal
): Promise<{ products: Product[]; pagination: ApiResponse<Product[]>['pagination'] }> => {
  const queryMap: Record<string, string | number | undefined> = {
    page: params.page ?? 1,
    limit: params.limit ?? 8,
    category: params.category,
    city: params.city,
    minPrice: params.minPrice,
    maxPrice: params.maxPrice,
    sort: params.sort,
  };

  const res = await fetch(buildUrl('/products', queryMap), { signal });
  if (!res.ok) {
    throw new Error(`Failed to fetch products: HTTP ${res.status}`);
  }
  const json: ApiResponse<Product[]> = await res.json();
  if (json.status !== 'ok') {
    throw new Error(json.message || 'Error fetching products');
  }
  return {
    products: json.data || [],
    pagination: json.pagination,
  };
};

/**
 * Search products via OpenSearch endpoint (/api/search).
 * Supports typo-tolerant fuzzy matching, category, city stock, price range, inStock boolean, and sorting.
 */
export const searchProducts = async (
  params: SearchParams = {},
  signal?: AbortSignal
): Promise<{ products: Product[]; pagination: ApiResponse<Product[]>['pagination'] }> => {
  const queryMap: Record<string, string | number | boolean | undefined> = {
    q: params.q?.trim() || undefined,
    category: params.category?.trim() || undefined,
    city: params.city?.trim() || undefined,
    minPrice: params.minPrice,
    maxPrice: params.maxPrice,
    inStock: params.inStock !== undefined ? params.inStock : undefined,
    sort: params.sort,
    page: params.page ?? 1,
    limit: params.limit ?? 12,
  };

  const res = await fetch(buildUrl('/search', queryMap), { signal });
  if (!res.ok) {
    let errorMsg = `Search failed with status ${res.status}`;
    try {
      const errJson = await res.json();
      if (errJson.message) errorMsg = errJson.message;
    } catch {
      // fallback
    }
    throw new Error(errorMsg);
  }

  const json: ApiResponse<Product[]> = await res.json();
  if (json.status !== 'ok') {
    throw new Error(json.message || 'Error performing product search');
  }

  return {
    products: json.data || [],
    pagination: json.pagination,
  };
};

/**
 * Fetch single product details by ID including full 5-city inventory breakdown.
 */
export const getProductById = async (id: string, signal?: AbortSignal): Promise<Product> => {
  const res = await fetch(buildUrl(`/products/${id}`), { signal });
  if (!res.ok) {
    let errorMsg = `Product request failed (HTTP ${res.status})`;
    try {
      const errJson = await res.json();
      if (errJson.message) errorMsg = errJson.message;
    } catch {
      // fallback
    }
    throw new Error(errorMsg);
  }
  const json: ApiResponse<Product> = await res.json();
  if (json.status !== 'ok') {
    throw new Error(json.message || 'Product not found');
  }
  return json.data;
};

/**
 * Fetch related products in the same category, excluding the current product ID.
 */
export const getRelatedProducts = async (
  category: string,
  excludeId: string,
  city: string,
  limit = 4,
  signal?: AbortSignal
): Promise<Product[]> => {
  try {
    const result = await searchProducts(
      {
        category,
        city,
        limit: limit + 1,
      },
      signal
    );

    return result.products.filter((p) => p.id !== excludeId).slice(0, limit);
  } catch {
    return [];
  }
};

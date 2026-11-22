import openSearchClient from '../config/opensearch.js';
import { parsePrice, parsePagination } from '../utils/validation.js';
import { INDEX_NAME } from '../scripts/setup-search-index.js';

/**
 * Validates and normalizes inStock parameter.
 * Returns true, false, or undefined.
 * Throws 400 error on invalid boolean string.
 */
export const parseInStock = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  if (value === true || value === 'true' || value === '1') return true;
  if (value === false || value === 'false' || value === '0') return false;

  const error = new Error("inStock must be a valid boolean ('true' or 'false').");
  error.statusCode = 400;
  throw error;
};

/**
 * Performs full-text search with exact/phrase match boosting, keyword/range filtering,
 * nested inventory stock verification, sorting, and pagination.
 * Throws HTTP 503 if OpenSearch is disconnected or unavailable (no silent SQL fallback).
 */
export const searchProducts = async (queryParams) => {
  if (!openSearchClient) {
    const error = new Error('OpenSearch service is unavailable. Search functionality is temporarily disabled.');
    error.statusCode = 503;
    throw error;
  }

  // 1. Validation
  const { page, limit, offset } = parsePagination(queryParams.page, queryParams.limit);
  const minPrice = parsePrice(queryParams.minPrice, 'minPrice');
  const maxPrice = parsePrice(queryParams.maxPrice, 'maxPrice');
  const inStock = parseInStock(queryParams.inStock);

  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    const error = new Error('minPrice cannot be greater than maxPrice');
    error.statusCode = 400;
    throw error;
  }

  // 2. Query DSL Construction
  const must = [];
  const filter = [{ term: { is_active: true } }];

  // Full-text search with exact phrase and term match boosting
  const q = queryParams.q ? queryParams.q.trim() : '';
  if (q !== '') {
    must.push({
      bool: {
        should: [
          // 1. Exact phrase match: highest priority boost
          {
            multi_match: {
              query: q,
              type: 'phrase',
              fields: ['name^5', 'description^2'],
            },
          },
          // 2. Exact all-terms match: high priority boost
          {
            multi_match: {
              query: q,
              fields: ['name^3', 'description^1'],
              operator: 'and',
            },
          },
          // 3. Typo-tolerant fuzzy match: lowest priority fallback
          {
            multi_match: {
              query: q,
              fields: ['name^2', 'description^1'],
              fuzziness: 'AUTO',
              prefix_length: 2,
            },
          },
        ],
        minimum_should_match: 1,
      },
    });
  }

  // Category filter
  if (queryParams.category && queryParams.category.trim() !== '') {
    filter.push({
      term: { category: queryParams.category.trim() },
    });
  }

  // Price range filter
  if (minPrice !== undefined || maxPrice !== undefined) {
    const priceRange = {};
    if (minPrice !== undefined) priceRange.gte = minPrice;
    if (maxPrice !== undefined) priceRange.lte = maxPrice;
    filter.push({ range: { price: priceRange } });
  }

  // City & inStock nested inventory filters
  const city = queryParams.city ? queryParams.city.trim() : null;

  if (city && inStock === true) {
    // Selected city with quantity > 0
    filter.push({
      nested: {
        path: 'inventory',
        query: {
          bool: {
            filter: [
              { term: { 'inventory.city': city } },
              { range: { 'inventory.quantity': { gt: 0 } } },
            ],
          },
        },
      },
    });
  } else if (city && inStock === false) {
    // Selected city with quantity <= 0 (out of stock edge case)
    filter.push({
      nested: {
        path: 'inventory',
        query: {
          bool: {
            filter: [
              { term: { 'inventory.city': city } },
              { range: { 'inventory.quantity': { lte: 0 } } },
            ],
          },
        },
      },
    });
  } else if (city) {
    // Selected city presence filter
    filter.push({
      nested: {
        path: 'inventory',
        query: {
          term: { 'inventory.city': city },
        },
      },
    });
  } else if (inStock === true) {
    // Any city has quantity > 0
    filter.push({
      nested: {
        path: 'inventory',
        query: {
          range: { 'inventory.quantity': { gt: 0 } },
        },
      },
    });
  } else if (inStock === false) {
    // Out of stock across cities
    filter.push({
      nested: {
        path: 'inventory',
        query: {
          range: { 'inventory.quantity': { lte: 0 } },
        },
      },
    });
  }

  // 3. Sorting configuration
  const sortMap = {
    relevance: [{ _score: { order: 'desc' } }, { updated_at: { order: 'desc' } }],
    price_asc: [{ price: { order: 'asc' } }, { product_id: { order: 'asc' } }],
    'price:asc': [{ price: { order: 'asc' } }, { product_id: { order: 'asc' } }],
    price_desc: [{ price: { order: 'desc' } }, { product_id: { order: 'asc' } }],
    'price:desc': [{ price: { order: 'desc' } }, { product_id: { order: 'asc' } }],
    newest: [{ updated_at: { order: 'desc' } }],
    'created_at:desc': [{ updated_at: { order: 'desc' } }],
    oldest: [{ updated_at: { order: 'asc' } }],
    'created_at:asc': [{ updated_at: { order: 'asc' } }],
    name_asc: [{ 'name.keyword': { order: 'asc' } }],
    'name:asc': [{ 'name.keyword': { order: 'asc' } }],
    name_desc: [{ 'name.keyword': { order: 'desc' } }],
    'name:desc': [{ 'name.keyword': { order: 'desc' } }],
  };

  const rawSort = queryParams.sort ? queryParams.sort.trim().toLowerCase() : null;
  let sortClause;

  if (rawSort) {
    if (!sortMap[rawSort]) {
      const error = new Error(`Invalid sort parameter: "${queryParams.sort}". Allowed: price_asc, price_desc, newest, oldest, name_asc, name_desc, relevance.`);
      error.statusCode = 400;
      throw error;
    }
    sortClause = sortMap[rawSort];
  } else {
    // Default to relevance if query text is provided, otherwise newest
    sortClause = q !== '' ? sortMap.relevance : sortMap.newest;
  }

  // 4. Execute Search
  let searchResponse;
  try {
    searchResponse = await openSearchClient.search({
      index: INDEX_NAME,
      from: offset,
      size: limit,
      body: {
        query: {
          bool: {
            must,
            filter,
          },
        },
        sort: sortClause,
      },
    });
  } catch (osErr) {
    console.error('OpenSearch query error:', osErr.message);
    const error = new Error('OpenSearch service is unavailable. Search functionality is temporarily disabled.');
    error.statusCode = 503;
    throw error;
  }

  // 5. Transform Hits and Selected City Stock
  const total = searchResponse.body.hits?.total?.value || 0;
  const rawHits = searchResponse.body.hits?.hits || [];

  const products = rawHits.map((hit) => {
    const src = hit._source;
    let cityStock = null;
    let totalStock = null;

    if (city) {
      const matchedCity = src.inventory?.find(
        (inv) => inv.city.toLowerCase() === city.toLowerCase()
      );
      cityStock = matchedCity ? matchedCity.quantity : 0;
    } else {
      totalStock = src.inventory?.reduce((sum, inv) => sum + (inv.quantity || 0), 0) || 0;
    }

    return {
      id: src.product_id,
      name: src.name,
      description: src.description,
      category: src.category,
      price: src.price,
      image_url: src.image_url,
      is_active: src.is_active,
      updated_at: src.updated_at,
      score: hit._score,
      ...(city ? { city, city_stock: cityStock } : { total_stock: totalStock }),
    };
  });

  return {
    products,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};


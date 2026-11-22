import pool from '../config/database.js';
import { isValidUUID, parsePrice, parsePagination } from '../utils/validation.js';

/**
 * Retrieves a paginated list of active products with optional filters, city inventory stock, and sorting.
 * All dynamic parameters are bound safely using parameterized queries ($1, $2, ...).
 */
export const listProducts = async (queryParams) => {
  const { page, limit, offset } = parsePagination(queryParams.page, queryParams.limit);
  const minPrice = parsePrice(queryParams.minPrice, 'minPrice');
  const maxPrice = parsePrice(queryParams.maxPrice, 'maxPrice');

  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    const error = new Error('minPrice cannot be greater than maxPrice');
    error.statusCode = 400;
    throw error;
  }

  const values = [];
  const countValues = [];
  let paramIndex = 1;

  const conditions = ['p.is_active = true'];

  // Category filter
  if (queryParams.category && queryParams.category.trim() !== '') {
    conditions.push(`LOWER(p.category) = LOWER($${paramIndex})`);
    values.push(queryParams.category.trim());
    countValues.push(queryParams.category.trim());
    paramIndex++;
  }

  // Price range filters
  if (minPrice !== undefined) {
    conditions.push(`p.price >= $${paramIndex}`);
    values.push(minPrice);
    countValues.push(minPrice);
    paramIndex++;
  }

  if (maxPrice !== undefined) {
    conditions.push(`p.price <= $${paramIndex}`);
    values.push(maxPrice);
    countValues.push(maxPrice);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // City stock join handling
  let citySelect = '';
  let cityJoin = '';
  const cityParam = queryParams.city ? queryParams.city.trim() : null;

  if (cityParam) {
    const cityIndex = paramIndex;
    values.push(cityParam);
    paramIndex++;
    citySelect = `, COALESCE(inv.quantity, 0) AS city_stock, $${cityIndex}::text AS city`;
    cityJoin = `LEFT JOIN inventory inv ON p.id = inv.product_id AND LOWER(inv.city) = LOWER($${cityIndex})`;
  } else {
    citySelect = `, COALESCE(tot.total_stock, 0) AS total_stock`;
    cityJoin = `LEFT JOIN (
      SELECT product_id, SUM(quantity) AS total_stock
      FROM inventory
      GROUP BY product_id
    ) tot ON p.id = tot.product_id`;
  }

  // Sorting whitelist
  const sortMap = {
    price_asc: 'p.price ASC, p.id ASC',
    'price:asc': 'p.price ASC, p.id ASC',
    price_desc: 'p.price DESC, p.id ASC',
    'price:desc': 'p.price DESC, p.id ASC',
    name_asc: 'p.name ASC, p.id ASC',
    'name:asc': 'p.name ASC, p.id ASC',
    name_desc: 'p.name DESC, p.id ASC',
    'name:desc': 'p.name DESC, p.id ASC',
    newest: 'p.created_at DESC, p.id DESC',
    'created_at:desc': 'p.created_at DESC, p.id DESC',
    oldest: 'p.created_at ASC, p.id ASC',
    'created_at:asc': 'p.created_at ASC, p.id ASC',
  };

  const sortKey = queryParams.sort ? queryParams.sort.trim().toLowerCase() : 'newest';
  const orderByClause = sortMap[sortKey] || 'p.created_at DESC, p.id DESC';

  // Count query
  const countSql = `
    SELECT COUNT(*)::int AS total
    FROM products p
    ${whereClause}
  `;
  const countResult = await pool.query(countSql, countValues);
  const total = countResult.rows[0].total;

  // Pagination parameters
  const limitIndex = paramIndex;
  values.push(limit);
  paramIndex++;

  const offsetIndex = paramIndex;
  values.push(offset);
  paramIndex++;

  // Main data query
  const dataSql = `
    SELECT 
      p.id,
      p.name,
      p.description,
      p.category,
      p.price,
      p.image_url,
      p.is_active,
      p.created_at,
      p.updated_at
      ${citySelect}
    FROM products p
    ${cityJoin}
    ${whereClause}
    ORDER BY ${orderByClause}
    LIMIT $${limitIndex} OFFSET $${offsetIndex}
  `;

  const dataResult = await pool.query(dataSql, values);

  return {
    products: dataResult.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
};

/**
 * Retrieves single product details by UUID including its city inventory breakdown.
 */
export const getProductById = async (id) => {
  if (!isValidUUID(id)) {
    const error = new Error('Invalid product ID format. Must be a valid UUID.');
    error.statusCode = 400;
    throw error;
  }

  const productSql = `
    SELECT 
      id,
      name,
      description,
      category,
      price,
      image_url,
      is_active,
      created_at,
      updated_at
    FROM products
    WHERE id = $1 AND is_active = true
  `;
  const productResult = await pool.query(productSql, [id]);

  if (productResult.rows.length === 0) {
    const error = new Error(`Product with ID ${id} not found.`);
    error.statusCode = 404;
    throw error;
  }

  const product = productResult.rows[0];

  // Fetch city inventory breakdown
  const inventorySql = `
    SELECT 
      city,
      quantity,
      updated_at
    FROM inventory
    WHERE product_id = $1
    ORDER BY city ASC
  `;
  const inventoryResult = await pool.query(inventorySql, [id]);

  const inventory = inventoryResult.rows;
  const totalStock = inventory.reduce((acc, row) => acc + (parseInt(row.quantity, 10) || 0), 0);

  return {
    ...product,
    total_stock: totalStock,
    inventory,
  };
};

/**
 * Retrieves all distinct product categories and their product counts.
 */
export const getCategories = async () => {
  const sql = `
    SELECT 
      category,
      COUNT(*)::int AS product_count
    FROM products
    WHERE is_active = true
    GROUP BY category
    ORDER BY category ASC
  `;
  const result = await pool.query(sql);
  return result.rows;
};


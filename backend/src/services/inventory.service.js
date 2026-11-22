import pool from '../config/database.js';
import { isValidUUID } from '../utils/validation.js';

/**
 * Retrieves the city inventory breakdown for a given product ID.
 */
export const getInventoryByProductId = async (productId) => {
  if (!isValidUUID(productId)) {
    const error = new Error('Invalid product ID format. Must be a valid UUID.');
    error.statusCode = 400;
    throw error;
  }

  // 1. Verify product exists
  const productCheck = await pool.query(
    'SELECT id, name, is_active FROM products WHERE id = $1',
    [productId]
  );

  if (productCheck.rows.length === 0) {
    const error = new Error(`Product with ID ${productId} not found.`);
    error.statusCode = 404;
    throw error;
  }

  const product = productCheck.rows[0];

  // 2. Fetch inventory records across all cities
  const inventoryResult = await pool.query(
    `SELECT 
       id,
       city,
       quantity,
       updated_at
     FROM inventory
     WHERE product_id = $1
     ORDER BY city ASC`,
    [productId]
  );

  const inventory = inventoryResult.rows;
  const totalQuantity = inventory.reduce((acc, row) => acc + (parseInt(row.quantity, 10) || 0), 0);

  return {
    product_id: product.id,
    product_name: product.name,
    is_active: product.is_active,
    total_stock: totalQuantity,
    cities: inventory,
  };
};


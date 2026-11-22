import pool from '../config/database.js';
import { isValidUUID } from '../utils/validation.js';

/**
 * Finds or creates the persistent cart for a user.
 */
export const getOrCreateCart = async (userId) => {
  const result = await pool.query(
    `INSERT INTO carts (user_id)
     VALUES ($1)
     ON CONFLICT (user_id)
     DO UPDATE SET updated_at = NOW()
     RETURNING id`,
    [userId]
  );
  return result.rows[0].id;
};

/**
 * Retrieves user's cart including item details, subtotals, and total calculations.
 * Supports optional city query to check city inventory availability without reserving stock.
 */
export const getCart = async (userId, city) => {
  const cartId = await getOrCreateCart(userId);

  const values = [cartId];
  let citySelect = '';
  let cityJoin = '';

  if (city && city.trim() !== '') {
    values.push(city.trim());
    citySelect = `, 
      COALESCE(inv.quantity, 0)::int AS city_stock,
      (COALESCE(inv.quantity, 0) >= ci.quantity) AS is_available_in_city`;
    cityJoin = `LEFT JOIN inventory inv ON ci.product_id = inv.product_id AND LOWER(inv.city) = LOWER($2)`;
  }

  const itemsSql = `
    SELECT 
      ci.id AS item_id,
      ci.product_id,
      ci.quantity,
      p.name AS product_name,
      p.price AS unit_price,
      p.image_url,
      p.category,
      p.is_active,
      ROUND(ci.quantity * p.price, 2) AS subtotal
      ${citySelect}
    FROM cart_items ci
    JOIN products p ON ci.product_id = p.id
    ${cityJoin}
    WHERE ci.cart_id = $1
    ORDER BY ci.id ASC
  `;

  const itemsResult = await pool.query(itemsSql, values);
  const items = itemsResult.rows;

  const totalItems = items.reduce((sum, item) => sum + parseInt(item.quantity, 10), 0);
  const totalAmountNum = items.reduce((sum, item) => sum + parseFloat(item.subtotal), 0);
  const totalAmount = totalAmountNum.toFixed(2);

  return {
    cart_id: cartId,
    user_id: userId,
    items,
    total_items: totalItems,
    total_amount: totalAmount,
    ...(city ? { city: city.trim() } : {}),
  };
};

/**
 * Adds an item to the user's cart.
 * Prevents duplicate items, validates quantity, rejects inactive products,
 * does not deduct stock.
 */
export const addItemToCart = async (userId, { productId, quantity = 1, city }) => {
  if (!isValidUUID(productId)) {
    const error = new Error('Invalid product ID format. Must be a valid UUID.');
    error.statusCode = 400;
    throw error;
  }

  const parsedQty = parseInt(quantity, 10);
  if (Number.isNaN(parsedQty) || parsedQty < 1) {
    const error = new Error('Quantity must be a positive integer greater than or equal to 1.');
    error.statusCode = 400;
    throw error;
  }

  // Verify product exists and is active
  const productResult = await pool.query(
    'SELECT id, name, price, is_active FROM products WHERE id = $1',
    [productId]
  );

  if (productResult.rows.length === 0) {
    const error = new Error(`Product with ID ${productId} not found.`);
    error.statusCode = 404;
    throw error;
  }

  const product = productResult.rows[0];
  if (!product.is_active) {
    const error = new Error(`Product "${product.name}" is currently inactive and cannot be added to cart.`);
    error.statusCode = 400;
    throw error;
  }

  const cartId = await getOrCreateCart(userId);

  // Check for duplicate item in cart
  const existingItem = await pool.query(
    'SELECT id, quantity FROM cart_items WHERE cart_id = $1 AND product_id = $2',
    [cartId, productId]
  );

  if (existingItem.rows.length > 0) {
    const error = new Error('Product is already in cart. Use PATCH /api/cart/items/:productId to update quantity.');
    error.statusCode = 409;
    throw error;
  }

  // Insert cart item (does not deduct stock)
  await pool.query(
    'INSERT INTO cart_items (cart_id, product_id, quantity) VALUES ($1, $2, $3)',
    [cartId, productId, parsedQty]
  );

  // Return updated cart
  return getCart(userId, city);
};

/**
 * Updates quantity of an existing item in user's cart.
 */
export const updateItemQuantity = async (userId, productId, quantity, city) => {
  if (!isValidUUID(productId)) {
    const error = new Error('Invalid product ID format. Must be a valid UUID.');
    error.statusCode = 400;
    throw error;
  }

  const parsedQty = parseInt(quantity, 10);
  if (Number.isNaN(parsedQty) || parsedQty < 1) {
    const error = new Error('Quantity must be a positive integer greater than or equal to 1.');
    error.statusCode = 400;
    throw error;
  }

  const cartId = await getOrCreateCart(userId);

  const updateResult = await pool.query(
    `UPDATE cart_items 
     SET quantity = $1 
     WHERE cart_id = $2 AND product_id = $3 
     RETURNING id`,
    [parsedQty, cartId, productId]
  );

  if (updateResult.rows.length === 0) {
    const error = new Error('Product not found in cart.');
    error.statusCode = 404;
    throw error;
  }

  return getCart(userId, city);
};

/**
 * Removes a specific product item from the user's cart.
 */
export const removeItemFromCart = async (userId, productId) => {
  if (!isValidUUID(productId)) {
    const error = new Error('Invalid product ID format. Must be a valid UUID.');
    error.statusCode = 400;
    throw error;
  }

  const cartId = await getOrCreateCart(userId);

  const deleteResult = await pool.query(
    'DELETE FROM cart_items WHERE cart_id = $1 AND product_id = $2 RETURNING id',
    [cartId, productId]
  );

  if (deleteResult.rows.length === 0) {
    const error = new Error('Product not found in cart.');
    error.statusCode = 404;
    throw error;
  }

  return { message: 'Item removed from cart successfully.' };
};

/**
 * Clears all items from the user's cart.
 */
export const clearCart = async (userId) => {
  const cartId = await getOrCreateCart(userId);
  await pool.query('DELETE FROM cart_items WHERE cart_id = $1', [cartId]);
  return { message: 'Cart cleared successfully.' };
};


import pool from '../config/database.js';
import { isValidUUID } from '../utils/validation.js';

/**
 * Retrieves all orders placed by the authenticated user with cross-user isolation.
 */
export const listUserOrders = async (userId) => {
  const sql = `
    SELECT 
      o.id,
      o.city,
      o.total_amount,
      o.status,
      o.idempotency_key,
      o.created_at,
      COUNT(oi.id)::int AS total_items
    FROM orders o
    LEFT JOIN order_items oi ON o.id = oi.order_id
    WHERE o.user_id = $1
    GROUP BY o.id
    ORDER BY o.created_at DESC;
  `;
  const result = await pool.query(sql, [userId]);
  return result.rows;
};

/**
 * Retrieves a single order by ID, strictly enforcing that it belongs to the authenticated user.
 */
export const getOrderById = async (userId, orderId) => {
  if (!isValidUUID(orderId)) {
    const error = new Error('Invalid order ID format. Must be a valid UUID.');
    error.statusCode = 400;
    throw error;
  }

  // Enforce per-user isolation: user_id = $2
  const orderRes = await pool.query(
    `SELECT id, user_id, city, total_amount, status, idempotency_key, created_at
     FROM orders
     WHERE id = $1 AND user_id = $2`,
    [orderId, userId]
  );

  if (orderRes.rows.length === 0) {
    const error = new Error('Order not found.');
    error.statusCode = 404;
    throw error;
  }

  const order = orderRes.rows[0];

  const itemsRes = await pool.query(
    `SELECT 
       oi.id AS order_item_id,
       oi.product_id,
       oi.quantity,
       oi.unit_price,
       oi.subtotal,
       p.name AS product_name,
       p.image_url,
       p.category
     FROM order_items oi
     JOIN products p ON oi.product_id = p.id
     WHERE oi.order_id = $1
     ORDER BY oi.id ASC`,
    [orderId]
  );

  return {
    ...order,
    items: itemsRes.rows,
  };
};


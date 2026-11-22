import pool from '../config/database.js';
import { evaluateProductStock } from './alert.service.js';

const VALID_CITIES = ['bengaluru', 'hyderabad', 'chennai', 'mumbai', 'delhi'];

/**
 * Executes full transactional checkout:
 * - Checks idempotency
 * - Locks user cart with SELECT FOR UPDATE
 * - Rechecks idempotency inside lock
 * - Validates cart contents and active product status
 * - Locks inventory in deterministic product ID order with SELECT FOR UPDATE
 * - Validates city inventory availability
 * - Computes totals server-side
 * - Inserts order and order_items
 * - Deducts stock exactly once
 * - Emits order.placed event to outbox_events in the same transaction
 * - Clears purchased cart items
 * - Commits transaction
 */
export const processCheckout = async (userId, { city, idempotencyKey }) => {
  if (!city || typeof city !== 'string' || city.trim() === '') {
    const error = new Error('City is required for delivery.');
    error.statusCode = 400;
    throw error;
  }

  const normalizedCity = city.trim();
  if (!VALID_CITIES.includes(normalizedCity.toLowerCase())) {
    const error = new Error(`Invalid city: "${city}". Supported cities: Bengaluru, Hyderabad, Chennai, Mumbai, Delhi.`);
    error.statusCode = 400;
    throw error;
  }

  if (!idempotencyKey || typeof idempotencyKey !== 'string' || idempotencyKey.trim() === '') {
    const error = new Error('idempotencyKey is required for checkout.');
    error.statusCode = 400;
    throw error;
  }

  const trimmedIdempotencyKey = idempotencyKey.trim();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Initial Idempotency Check
    const existingOrderRes = await client.query(
      `SELECT id, user_id, city, total_amount, status, idempotency_key, created_at
       FROM orders
       WHERE user_id = $1 AND idempotency_key = $2`,
      [userId, trimmedIdempotencyKey]
    );

    if (existingOrderRes.rows.length > 0) {
      const existingOrder = existingOrderRes.rows[0];
      const itemsRes = await client.query(
        `SELECT oi.id, oi.product_id, oi.quantity, oi.unit_price, oi.subtotal, p.name AS product_name
         FROM order_items oi
         JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id = $1
         ORDER BY oi.id ASC`,
        [existingOrder.id]
      );
      await client.query('COMMIT');
      return {
        order: {
          ...existingOrder,
          items: itemsRes.rows,
        },
        is_idempotent_replay: true,
      };
    }

    // 2. Lock User Cart
    const cartRes = await client.query(
      `SELECT id FROM carts WHERE user_id = $1 FOR UPDATE`,
      [userId]
    );

    if (cartRes.rows.length === 0) {
      const error = new Error('Cart is empty. Cannot checkout an empty cart.');
      error.statusCode = 400;
      throw error;
    }

    const cartId = cartRes.rows[0].id;

    // 3. Re-verify idempotency within cart lock
    const recheckIdempotency = await client.query(
      `SELECT id, user_id, city, total_amount, status, idempotency_key, created_at
       FROM orders
       WHERE user_id = $1 AND idempotency_key = $2`,
      [userId, trimmedIdempotencyKey]
    );

    if (recheckIdempotency.rows.length > 0) {
      const existingOrder = recheckIdempotency.rows[0];
      const itemsRes = await client.query(
        `SELECT oi.id, oi.product_id, oi.quantity, oi.unit_price, oi.subtotal, p.name AS product_name
         FROM order_items oi
         JOIN products p ON oi.product_id = p.id
         WHERE oi.order_id = $1
         ORDER BY oi.id ASC`,
        [existingOrder.id]
      );
      await client.query('COMMIT');
      return {
        order: {
          ...existingOrder,
          items: itemsRes.rows,
        },
        is_idempotent_replay: true,
      };
    }

    // 4. Load Cart Items and Fresh Active Product Prices
    const cartItemsRes = await client.query(
      `SELECT 
         ci.id AS cart_item_id,
         ci.product_id,
         ci.quantity,
         p.name AS product_name,
         p.price AS unit_price,
         p.is_active
       FROM cart_items ci
       JOIN products p ON ci.product_id = p.id
       WHERE ci.cart_id = $1
       ORDER BY ci.product_id ASC`,
      [cartId]
    );

    const cartItems = cartItemsRes.rows;
    if (cartItems.length === 0) {
      const error = new Error('Cart is empty. Cannot checkout an empty cart.');
      error.statusCode = 400;
      throw error;
    }

    // 5. Validate Active Products
    for (const item of cartItems) {
      if (!item.is_active) {
        const error = new Error(`Product "${item.product_name}" is currently inactive and cannot be purchased.`);
        error.statusCode = 400;
        throw error;
      }
    }

    // 6. Lock Inventory Rows in Deterministic Product ID Order to Prevent Deadlocks
    const productIds = cartItems.map((item) => item.product_id).sort();

    const inventoryRes = await client.query(
      `SELECT id, product_id, city, quantity
       FROM inventory
       WHERE product_id = ANY($1::uuid[]) AND LOWER(city) = LOWER($2)
       ORDER BY product_id ASC
       FOR UPDATE`,
      [productIds, normalizedCity]
    );

    const inventoryMap = new Map();
    inventoryRes.rows.forEach((inv) => {
      inventoryMap.set(inv.product_id, inv);
    });

    // 7. Validate Sufficient Stock
    for (const item of cartItems) {
      const inv = inventoryMap.get(item.product_id);
      const availableQty = inv ? inv.quantity : 0;

      if (!inv || availableQty < item.quantity) {
        const error = new Error(
          `Insufficient stock for "${item.product_name}" in ${normalizedCity}. Requested: ${item.quantity}, Available: ${availableQty}.`
        );
        error.statusCode = 409;
        throw error;
      }
    }

    // 8. Calculate Server-Side Subtotals and Totals
    let totalCents = 0;
    const orderItemsPayload = cartItems.map((item) => {
      const unitPrice = parseFloat(item.unit_price);
      const subtotalCents = Math.round(item.quantity * unitPrice * 100);
      totalCents += subtotalCents;

      return {
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: unitPrice.toFixed(2),
        subtotal: (subtotalCents / 100).toFixed(2),
      };
    });

    const totalAmount = (totalCents / 100).toFixed(2);

    // 9. Insert Order
    const insertOrderRes = await client.query(
      `INSERT INTO orders (user_id, city, total_amount, status, idempotency_key, created_at)
       VALUES ($1, $2, $3, 'CONFIRMED', $4, NOW())
       RETURNING id, user_id, city, total_amount, status, idempotency_key, created_at`,
      [userId, normalizedCity, totalAmount, trimmedIdempotencyKey]
    );

    const createdOrder = insertOrderRes.rows[0];

    // 10. Insert Order Items & Deduct Inventory Stock Exactly Once
    const savedOrderItems = [];
    for (const item of orderItemsPayload) {
      const insertItemRes = await client.query(
        `INSERT INTO order_items (order_id, product_id, quantity, unit_price, subtotal)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, order_id, product_id, quantity, unit_price, subtotal`,
        [createdOrder.id, item.product_id, item.quantity, item.unit_price, item.subtotal]
      );
      savedOrderItems.push({
        ...insertItemRes.rows[0],
        product_name: item.product_name,
      });

      // Stock deduction
      await client.query(
        `UPDATE inventory
         SET quantity = quantity - $1, updated_at = NOW()
         WHERE product_id = $2 AND LOWER(city) = LOWER($3)`,
        [item.quantity, item.product_id, normalizedCity]
      );

      // Increment monotonic product version for atomic OpenSearch synchronization
      await client.query(
        `UPDATE products
         SET version = version + 1, updated_at = NOW()
         WHERE id = $1`,
        [item.product_id]
      );
    }

    // 11. Atomic Outbox Event Emission (order.placed)
    const outboxPayload = {
      order_id: createdOrder.id,
      user_id: createdOrder.user_id,
      city: createdOrder.city,
      total_amount: createdOrder.total_amount,
      status: createdOrder.status,
      idempotency_key: createdOrder.idempotency_key,
      items: savedOrderItems,
      created_at: createdOrder.created_at,
    };

    await client.query(
      `INSERT INTO outbox_events (event_type, aggregate_id, payload, created_at)
       VALUES ('order.placed', $1, $2, NOW())`,
      [createdOrder.id, JSON.stringify(outboxPayload)]
    );

    // 12. Clear Cart Items
    await client.query(`DELETE FROM cart_items WHERE cart_id = $1`, [cartId]);

    // 13. Commit Transaction Atomically
    await client.query('COMMIT');

    // 14. Trigger real-time stock alert evaluation post-commit
    for (const item of orderItemsPayload) {
      evaluateProductStock(item.product_id, normalizedCity).catch((err) => {
        console.error(`[ALERT_EVAL_ERROR] Failed to evaluate stock for ${item.product_id}:`, err.message);
      });
    }

    return {
      order: {
        ...createdOrder,
        items: savedOrderItems,
      },
      is_idempotent_replay: false,
    };
  } catch (error) {
    await client.query('ROLLBACK');

    // Handle race-condition idempotency constraint conflict safely
    if (error.code === '23505' && error.constraint === 'uq_orders_user_idempotency') {
      const replayRes = await pool.query(
        `SELECT id, user_id, city, total_amount, status, idempotency_key, created_at
         FROM orders
         WHERE user_id = $1 AND idempotency_key = $2`,
        [userId, trimmedIdempotencyKey]
      );
      if (replayRes.rows.length > 0) {
        const order = replayRes.rows[0];
        const itemsRes = await pool.query(
          `SELECT oi.id, oi.product_id, oi.quantity, oi.unit_price, oi.subtotal, p.name AS product_name
           FROM order_items oi
           JOIN products p ON oi.product_id = p.id
           WHERE oi.order_id = $1
           ORDER BY oi.id ASC`,
          [order.id]
        );
        return {
          order: {
            ...order,
            items: itemsRes.rows,
          },
          is_idempotent_replay: true,
        };
      }
    }

    throw error;
  } finally {
    client.release();
  }
};


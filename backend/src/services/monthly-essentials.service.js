import pool from '../config/database.js';
import { getOrCreateCart, getCart } from './cart.service.js';
import { isValidUUID } from '../utils/validation.js';

const REMINDER_ADVISORY_LOCK = 987654322;

/**
 * Returns current calendar date in 'YYYY-MM-DD' format for Asia/Kolkata timezone.
 */
export function getKolkataDateString(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

/**
 * Returns total days in a given year and month (1-12).
 * Correctly accounts for leap years in February (29 days).
 */
export function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

/**
 * Clamps preferred shopping day (e.g. 29, 30, 31) to the maximum valid days of that month.
 */
export function clampShoppingDay(year, month, shoppingDay) {
  const maxDays = getDaysInMonth(year, month);
  return Math.min(shoppingDay, maxDays);
}

/**
 * Calculates the next shopping date for a customer given today's date in Asia/Kolkata.
 * If today is before or on this month's clamped shopping day, target is this month.
 * Otherwise, target is next month (clamped to that month's max days).
 *
 * @param {number} shoppingDay (1-31)
 * @param {string} [todayStr] Optional 'YYYY-MM-DD' override for testing
 * @returns {{ targetDateStr: string, year: number, month: number, day: number }}
 */
export function calculateNextShoppingDate(shoppingDay, todayStr = getKolkataDateString()) {
  const [currYear, currMonth, currDay] = todayStr.split('-').map(Number);

  // Check this month's clamped target day
  const thisMonthClampedDay = clampShoppingDay(currYear, currMonth, shoppingDay);
  const thisMonthTargetStr = `${currYear}-${String(currMonth).padStart(2, '0')}-${String(thisMonthClampedDay).padStart(2, '0')}`;

  if (todayStr <= thisMonthTargetStr) {
    return {
      targetDateStr: thisMonthTargetStr,
      year: currYear,
      month: currMonth,
      day: thisMonthClampedDay,
    };
  }

  // Target is next month
  const nextMonth = currMonth === 12 ? 1 : currMonth + 1;
  const nextYear = currMonth === 12 ? currYear + 1 : currYear;
  const nextMonthClampedDay = clampShoppingDay(nextYear, nextMonth, shoppingDay);
  const nextMonthTargetStr = `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(nextMonthClampedDay).padStart(2, '0')}`;

  return {
    targetDateStr: nextMonthTargetStr,
    year: nextYear,
    month: nextMonth,
    day: nextMonthClampedDay,
  };
}

/**
 * Subtracts N calendar days from a 'YYYY-MM-DD' date string.
 */
export function subtractDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/**
 * Calculates reminder trigger date for a given shopping date and daysBefore.
 */
export function calculateReminderDate(targetDateStr, daysBefore = 3) {
  return subtractDays(targetDateStr, daysBefore);
}

/**
 * Creates a new monthly essentials list for a customer.
 */
export async function createList(userId, { name, shopping_day, reminder_days_before = 3 }) {
  if (!name || typeof name !== 'string' || name.trim() === '') {
    name = 'My Monthly Essentials';
  }

  const sDay = parseInt(shopping_day, 10);
  if (Number.isNaN(sDay) || sDay < 1 || sDay > 31) {
    const error = new Error('Shopping day must be a valid day of the month between 1 and 31.');
    error.statusCode = 400;
    throw error;
  }

  const rDays = parseInt(reminder_days_before, 10);
  if (Number.isNaN(rDays) || rDays < 1 || rDays > 14) {
    const error = new Error('Reminder days before must be an integer between 1 and 14.');
    error.statusCode = 400;
    throw error;
  }

  const result = await pool.query(
    `INSERT INTO monthly_essentials (user_id, name, shopping_day, reminder_days_before, is_active)
     VALUES ($1, $2, $3, $4, true)
     RETURNING *`,
    [userId, name.trim(), sDay, rDays]
  );

  return result.rows[0];
}

/**
 * Retrieves all monthly essentials lists owned by the customer with item counts.
 */
export async function getUserLists(userId) {
  const query = `
    SELECT 
      l.*,
      COUNT(i.id)::int AS items_count,
      COALESCE(SUM(i.quantity), 0)::int AS total_units
    FROM monthly_essentials l
    LEFT JOIN monthly_essential_items i ON l.id = i.list_id
    WHERE l.user_id = $1
    GROUP BY l.id
    ORDER BY l.created_at ASC
  `;
  const { rows } = await pool.query(query, [userId]);

  const todayStr = getKolkataDateString();

  return rows.map((list) => {
    const nextShopping = calculateNextShoppingDate(list.shopping_day, todayStr);
    const reminderDateStr = calculateReminderDate(nextShopping.targetDateStr, list.reminder_days_before);
    const isReminderDue = todayStr >= reminderDateStr && todayStr <= nextShopping.targetDateStr;

    return {
      ...list,
      next_shopping_date: nextShopping.targetDateStr,
      reminder_date: reminderDateStr,
      is_reminder_due: isReminderDue,
    };
  });
}

/**
 * Retrieves a single monthly list by ID with items, current catalog prices,
 * and live warehouse stock in the requested delivery city.
 */
export async function getListById(userId, listId, city = 'Bengaluru') {
  if (!isValidUUID(listId)) {
    const error = new Error('Invalid list ID format. Must be a valid UUID.');
    error.statusCode = 400;
    throw error;
  }

  // 1. Fetch list and enforce strict ownership
  const listResult = await pool.query(
    'SELECT * FROM monthly_essentials WHERE id = $1',
    [listId]
  );

  if (listResult.rows.length === 0) {
    const error = new Error('Monthly essentials list not found.');
    error.statusCode = 404;
    throw error;
  }

  const list = listResult.rows[0];
  if (list.user_id !== userId) {
    const error = new Error('Access denied: You do not have permission to view this monthly essentials list.');
    error.statusCode = 403;
    throw error;
  }

  // 2. Fetch items with current product info and city warehouse stock
  const itemsQuery = `
    SELECT 
      i.id AS item_id,
      i.product_id,
      i.quantity,
      i.created_at,
      p.name AS product_name,
      p.price AS current_price,
      p.category,
      p.image_url,
      p.is_active,
      COALESCE(inv.quantity, 0)::int AS city_stock,
      (COALESCE(inv.quantity, 0) >= i.quantity) AS is_available_in_city,
      ROUND(i.quantity * p.price, 2) AS line_subtotal
    FROM monthly_essential_items i
    JOIN products p ON i.product_id = p.id
    LEFT JOIN inventory inv ON i.product_id = inv.product_id AND LOWER(inv.city) = LOWER($2)
    WHERE i.list_id = $1
    ORDER BY i.created_at ASC
  `;

  const itemsResult = await pool.query(itemsQuery, [listId, city]);
  const items = itemsResult.rows;

  const totalItems = items.reduce((sum, item) => sum + parseInt(item.quantity, 10), 0);
  const totalAmountNum = items.reduce((sum, item) => sum + parseFloat(item.line_subtotal || 0), 0);
  const totalAmount = totalAmountNum.toFixed(2);

  const todayStr = getKolkataDateString();
  const nextShopping = calculateNextShoppingDate(list.shopping_day, todayStr);
  const reminderDateStr = calculateReminderDate(nextShopping.targetDateStr, list.reminder_days_before);
  const isReminderDue = todayStr >= reminderDateStr && todayStr <= nextShopping.targetDateStr;

  return {
    ...list,
    items,
    city,
    total_items: totalItems,
    total_amount: totalAmount,
    next_shopping_date: nextShopping.targetDateStr,
    reminder_date: reminderDateStr,
    is_reminder_due: isReminderDue,
  };
}

/**
 * Updates list details (name, shopping_day, reminder_days_before) with ownership check.
 */
export async function updateList(userId, listId, { name, shopping_day, reminder_days_before }) {
  if (!isValidUUID(listId)) {
    const error = new Error('Invalid list ID format. Must be a valid UUID.');
    error.statusCode = 400;
    throw error;
  }

  // Ownership verification
  const check = await pool.query('SELECT user_id FROM monthly_essentials WHERE id = $1', [listId]);
  if (check.rows.length === 0) {
    const error = new Error('Monthly essentials list not found.');
    error.statusCode = 404;
    throw error;
  }
  if (check.rows[0].user_id !== userId) {
    const error = new Error('Access denied: You do not have permission to modify this monthly essentials list.');
    error.statusCode = 403;
    throw error;
  }

  const updates = [];
  const values = [listId];
  let paramIdx = 2;

  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim() === '') {
      const error = new Error('List name cannot be empty.');
      error.statusCode = 400;
      throw error;
    }
    updates.push(`name = $${paramIdx++}`);
    values.push(name.trim());
  }

  if (shopping_day !== undefined) {
    const sDay = parseInt(shopping_day, 10);
    if (Number.isNaN(sDay) || sDay < 1 || sDay > 31) {
      const error = new Error('Shopping day must be a valid day of the month between 1 and 31.');
      error.statusCode = 400;
      throw error;
    }
    updates.push(`shopping_day = $${paramIdx++}`);
    values.push(sDay);
  }

  if (reminder_days_before !== undefined) {
    const rDays = parseInt(reminder_days_before, 10);
    if (Number.isNaN(rDays) || rDays < 1 || rDays > 14) {
      const error = new Error('Reminder days before must be an integer between 1 and 14.');
      error.statusCode = 400;
      throw error;
    }
    updates.push(`reminder_days_before = $${paramIdx++}`);
    values.push(rDays);
  }

  if (updates.length === 0) {
    const error = new Error('No valid fields provided for update.');
    error.statusCode = 400;
    throw error;
  }

  updates.push('updated_at = NOW()');

  const query = `
    UPDATE monthly_essentials
    SET ${updates.join(', ')}
    WHERE id = $1
    RETURNING *
  `;

  const result = await pool.query(query, values);
  return result.rows[0];
}

/**
 * Toggles active / paused status for a monthly list.
 */
export async function toggleListStatus(userId, listId, isActive) {
  if (!isValidUUID(listId)) {
    const error = new Error('Invalid list ID format. Must be a valid UUID.');
    error.statusCode = 400;
    throw error;
  }

  const check = await pool.query('SELECT user_id FROM monthly_essentials WHERE id = $1', [listId]);
  if (check.rows.length === 0) {
    const error = new Error('Monthly essentials list not found.');
    error.statusCode = 404;
    throw error;
  }
  if (check.rows[0].user_id !== userId) {
    const error = new Error('Access denied: You do not have permission to modify this monthly essentials list.');
    error.statusCode = 403;
    throw error;
  }

  const result = await pool.query(
    `UPDATE monthly_essentials
     SET is_active = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [Boolean(isActive), listId]
  );

  return result.rows[0];
}

/**
 * Deletes a monthly essentials list and all associated items and reminders.
 */
export async function deleteList(userId, listId) {
  if (!isValidUUID(listId)) {
    const error = new Error('Invalid list ID format. Must be a valid UUID.');
    error.statusCode = 400;
    throw error;
  }

  const check = await pool.query('SELECT user_id FROM monthly_essentials WHERE id = $1', [listId]);
  if (check.rows.length === 0) {
    const error = new Error('Monthly essentials list not found.');
    error.statusCode = 404;
    throw error;
  }
  if (check.rows[0].user_id !== userId) {
    const error = new Error('Access denied: You do not have permission to delete this monthly essentials list.');
    error.statusCode = 403;
    throw error;
  }

  await pool.query('DELETE FROM monthly_essentials WHERE id = $1', [listId]);
  return { message: 'Monthly essentials list deleted successfully.' };
}

/**
 * Adds an item to a customer's monthly essentials list.
 */
export async function addItemToList(userId, listId, { productId, quantity = 1 }) {
  if (!isValidUUID(listId) || !isValidUUID(productId)) {
    const error = new Error('Invalid UUID format for list ID or product ID.');
    error.statusCode = 400;
    throw error;
  }

  // Ownership verification
  const check = await pool.query('SELECT user_id FROM monthly_essentials WHERE id = $1', [listId]);
  if (check.rows.length === 0) {
    const error = new Error('Monthly essentials list not found.');
    error.statusCode = 404;
    throw error;
  }
  if (check.rows[0].user_id !== userId) {
    const error = new Error('Access denied: You do not have permission to modify this monthly essentials list.');
    error.statusCode = 403;
    throw error;
  }

  const qty = parseInt(quantity, 10);
  if (Number.isNaN(qty) || qty < 1) {
    const error = new Error('Item quantity must be a positive integer greater than or equal to 1.');
    error.statusCode = 400;
    throw error;
  }

  // Verify product exists and is active
  const prodRes = await pool.query('SELECT id, name, is_active FROM products WHERE id = $1', [productId]);
  if (prodRes.rows.length === 0) {
    const error = new Error(`Product with ID ${productId} not found.`);
    error.statusCode = 404;
    throw error;
  }
  if (!prodRes.rows[0].is_active) {
    const error = new Error(`Product "${prodRes.rows[0].name}" is inactive and cannot be added.`);
    error.statusCode = 400;
    throw error;
  }

  // Upsert item
  const query = `
    INSERT INTO monthly_essential_items (list_id, product_id, quantity)
    VALUES ($1, $2, $3)
    ON CONFLICT (list_id, product_id)
    DO UPDATE SET quantity = $3, updated_at = NOW()
    RETURNING *
  `;
  const result = await pool.query(query, [listId, productId, qty]);
  return result.rows[0];
}

/**
 * Updates quantity of an existing item in a monthly essentials list.
 */
export async function updateItemQuantity(userId, listId, itemId, quantity) {
  if (!isValidUUID(listId) || !isValidUUID(itemId)) {
    const error = new Error('Invalid UUID format for list ID or item ID.');
    error.statusCode = 400;
    throw error;
  }

  // Ownership verification
  const check = await pool.query('SELECT user_id FROM monthly_essentials WHERE id = $1', [listId]);
  if (check.rows.length === 0) {
    const error = new Error('Monthly essentials list not found.');
    error.statusCode = 404;
    throw error;
  }
  if (check.rows[0].user_id !== userId) {
    const error = new Error('Access denied: You do not have permission to modify this monthly essentials list.');
    error.statusCode = 403;
    throw error;
  }

  const qty = parseInt(quantity, 10);
  if (Number.isNaN(qty) || qty < 1) {
    const error = new Error('Item quantity must be a positive integer greater than or equal to 1.');
    error.statusCode = 400;
    throw error;
  }

  const query = `
    UPDATE monthly_essential_items
    SET quantity = $1, updated_at = NOW()
    WHERE id = $2 AND list_id = $3
    RETURNING *
  `;
  const result = await pool.query(query, [qty, itemId, listId]);
  if (result.rows.length === 0) {
    const error = new Error('Essential item not found in this list.');
    error.statusCode = 404;
    throw error;
  }

  return result.rows[0];
}

/**
 * Removes an item from a monthly essentials list.
 */
export async function removeItemFromList(userId, listId, itemId) {
  if (!isValidUUID(listId) || !isValidUUID(itemId)) {
    const error = new Error('Invalid UUID format for list ID or item ID.');
    error.statusCode = 400;
    throw error;
  }

  // Ownership verification
  const check = await pool.query('SELECT user_id FROM monthly_essentials WHERE id = $1', [listId]);
  if (check.rows.length === 0) {
    const error = new Error('Monthly essentials list not found.');
    error.statusCode = 404;
    throw error;
  }
  if (check.rows[0].user_id !== userId) {
    const error = new Error('Access denied: You do not have permission to modify this monthly essentials list.');
    error.statusCode = 403;
    throw error;
  }

  const result = await pool.query(
    'DELETE FROM monthly_essential_items WHERE id = $1 AND list_id = $2 RETURNING id',
    [itemId, listId]
  );

  if (result.rows.length === 0) {
    const error = new Error('Essential item not found in this list.');
    error.statusCode = 404;
    throw error;
  }

  return { message: 'Item removed from monthly essentials list successfully.' };
}

/**
 * Retrieves due reminders for a customer.
 */
export async function getDueReminders(userId) {
  const query = `
    SELECT 
      r.id AS reminder_id,
      r.list_id,
      r.due_date,
      r.reminder_date,
      r.status,
      r.read_at,
      r.created_at,
      l.name AS list_name,
      l.shopping_day,
      l.is_active AS list_active,
      COUNT(i.id)::int AS items_count
    FROM monthly_reminders r
    JOIN monthly_essentials l ON r.list_id = l.id
    LEFT JOIN monthly_essential_items i ON l.id = i.list_id
    WHERE r.user_id = $1
    GROUP BY r.id, l.name, l.shopping_day, l.is_active
    ORDER BY r.created_at DESC
  `;
  const result = await pool.query(query, [userId]);
  return result.rows;
}

/**
 * Marks a reminder as READ by the customer.
 */
export async function markReminderRead(userId, reminderId) {
  if (!isValidUUID(reminderId)) {
    const error = new Error('Invalid reminder ID format.');
    error.statusCode = 400;
    throw error;
  }

  const result = await pool.query(
    `UPDATE monthly_reminders
     SET status = 'READ', read_at = NOW()
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    [reminderId, userId]
  );

  if (result.rows.length === 0) {
    const error = new Error('Reminder not found or does not belong to you.');
    error.statusCode = 404;
    throw error;
  }

  return result.rows[0];
}

/**
 * Daily reminder engine worker function:
 * Checks active monthly lists and generates reminders if today falls within
 * the reminder window (due_date - reminder_days_before to due_date).
 *
 * Uses PostgreSQL advisory lock to ensure only one instance executes concurrently.
 * Deduplicates with UNIQUE (list_id, due_date) constraint.
 */
export async function generateCycleReminders(todayOverride = null) {
  const lockClient = await pool.connect();
  let lockAcquired = false;

  try {
    const lockRes = await lockClient.query(
      'SELECT pg_try_advisory_lock($1) AS acquired',
      [REMINDER_ADVISORY_LOCK]
    );
    lockAcquired = lockRes.rows[0].acquired;

    if (!lockAcquired) {
      return { skipped: true, reason: 'CONCURRENT_WORKER_LOCKED' };
    }

    const todayStr = todayOverride || getKolkataDateString();

    // Fetch all active lists
    const listsRes = await lockClient.query(`
      SELECT 
        l.id,
        l.user_id,
        l.name,
        l.shopping_day,
        l.reminder_days_before,
        u.email,
        u.name AS user_name
      FROM monthly_essentials l
      JOIN users u ON l.user_id = u.id
      WHERE l.is_active = true AND u.is_active = true
    `);

    let generatedCount = 0;
    let skippedCount = 0;
    const generatedReminders = [];

    for (const list of listsRes.rows) {
      const nextShopping = calculateNextShoppingDate(list.shopping_day, todayStr);
      const reminderTriggerDate = calculateReminderDate(nextShopping.targetDateStr, list.reminder_days_before);

      // Check if today is within reminder window
      if (todayStr >= reminderTriggerDate && todayStr <= nextShopping.targetDateStr) {
        // Attempt to insert reminder; deduplicated by constraint uq_monthly_reminders_list_due
        const insertRes = await lockClient.query(
          `INSERT INTO monthly_reminders (list_id, user_id, due_date, reminder_date, status)
           VALUES ($1, $2, $3, $4, 'SENT')
           ON CONFLICT (list_id, due_date) DO NOTHING
           RETURNING id`,
          [list.id, list.user_id, nextShopping.targetDateStr, todayStr]
        );

        if (insertRes.rows.length > 0) {
          generatedCount++;
          const reminderId = insertRes.rows[0].id;
          generatedReminders.push({
            reminder_id: reminderId,
            list_id: list.id,
            user_id: list.user_id,
            due_date: nextShopping.targetDateStr,
          });

          // Insert in-app notification
          await lockClient.query(
            `INSERT INTO notifications (recipient_user_id, notification_type, title, message)
             VALUES ($1, 'MONTHLY_ESSENTIALS_REMINDER', $2, $3)`,
            [
              list.user_id,
              'My Monthly Essentials Reminder',
              `Your monthly essentials list "${list.name}" is scheduled for ${nextShopping.targetDateStr}. Add all items to your cart with one click!`,
            ]
          );
        } else {
          skippedCount++;
        }
      } else {
        skippedCount++;
      }
    }

    return {
      status: 'success',
      today: todayStr,
      active_lists_checked: listsRes.rows.length,
      generated_count: generatedCount,
      skipped_count: skippedCount,
      reminders: generatedReminders,
    };
  } finally {
    if (lockAcquired) {
      await lockClient.query('SELECT pg_advisory_unlock($1)', [REMINDER_ADVISORY_LOCK]);
    }
    lockClient.release();
  }
}

/**
 * Batches and adds all items from a monthly essentials list to the customer's cart.
 *
 * Rules:
 * 1. Validates current city warehouse inventory.
 * 2. Rechecks current product availability and active status.
 * 3. Uses live catalog prices (never stale prices).
 * 4. Merges into existing cart without silently overwriting existing items.
 * 5. Caches/caps quantity if requested quantity exceeds available stock.
 * 6. Clearly reports added, adjusted, and unavailable items.
 */
export async function addEssentialsToCart(userId, listId, city = 'Bengaluru') {
  if (!isValidUUID(listId)) {
    const error = new Error('Invalid list ID format. Must be a valid UUID.');
    error.statusCode = 400;
    throw error;
  }

  // 1. Fetch list and verify ownership
  const listResult = await pool.query(
    'SELECT * FROM monthly_essentials WHERE id = $1',
    [listId]
  );

  if (listResult.rows.length === 0) {
    const error = new Error('Monthly essentials list not found.');
    error.statusCode = 404;
    throw error;
  }

  const list = listResult.rows[0];
  if (list.user_id !== userId) {
    const error = new Error('Access denied: You do not have permission to access this monthly essentials list.');
    error.statusCode = 403;
    throw error;
  }

  // 2. Fetch items with current product and inventory details
  const itemsQuery = `
    SELECT 
      i.id AS item_id,
      i.product_id,
      i.quantity AS requested_qty,
      p.name AS product_name,
      p.price AS current_price,
      p.is_active,
      COALESCE(inv.quantity, 0)::int AS city_stock
    FROM monthly_essential_items i
    JOIN products p ON i.product_id = p.id
    LEFT JOIN inventory inv ON i.product_id = inv.product_id AND LOWER(inv.city) = LOWER($2)
    WHERE i.list_id = $1
    ORDER BY i.created_at ASC
  `;

  const itemsRes = await pool.query(itemsQuery, [listId, city]);
  const items = itemsRes.rows;

  if (items.length === 0) {
    const error = new Error('Monthly essentials list has no items to add. Please add products first.');
    error.statusCode = 400;
    throw error;
  }

  const cartId = await getOrCreateCart(userId);

  // 3. Fetch existing cart items for this user to avoid clobbering
  const existingCartItemsRes = await pool.query(
    'SELECT product_id, quantity FROM cart_items WHERE cart_id = $1',
    [cartId]
  );
  const existingMap = new Map();
  existingCartItemsRes.rows.forEach((row) => {
    existingMap.set(row.product_id, parseInt(row.quantity, 10));
  });

  const addedItems = [];
  const adjustedItems = [];
  const unavailableItems = [];

  // 4. Process each essential item in a transaction
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const item of items) {
      // Inactive / deleted product check
      if (!item.is_active) {
        unavailableItems.push({
          product_id: item.product_id,
          product_name: item.product_name,
          requested_qty: item.requested_qty,
          reason: 'PRODUCT_INACTIVE',
        });
        continue;
      }

      const availableStock = item.city_stock;
      if (availableStock <= 0) {
        unavailableItems.push({
          product_id: item.product_id,
          product_name: item.product_name,
          requested_qty: item.requested_qty,
          available_stock: 0,
          reason: 'OUT_OF_STOCK',
        });
        continue;
      }

      const currentInCart = existingMap.get(item.product_id) || 0;
      const desiredTotal = currentInCart + item.requested_qty;

      if (desiredTotal > availableStock) {
        // Cap to available stock
        const finalQty = availableStock;
        const netAdded = finalQty - currentInCart;

        if (netAdded > 0) {
          if (currentInCart > 0) {
            await client.query(
              'UPDATE cart_items SET quantity = $1 WHERE cart_id = $2 AND product_id = $3',
              [finalQty, cartId, item.product_id]
            );
          } else {
            await client.query(
              'INSERT INTO cart_items (cart_id, product_id, quantity) VALUES ($1, $2, $3)',
              [cartId, item.product_id, finalQty]
            );
          }

          adjustedItems.push({
            product_id: item.product_id,
            product_name: item.product_name,
            requested_qty: item.requested_qty,
            already_in_cart: currentInCart,
            added_qty: netAdded,
            final_qty: finalQty,
            available_stock: availableStock,
            reason: 'INSUFFICIENT_STOCK_CAPPED',
          });
        } else {
          // Already have max stock in cart
          adjustedItems.push({
            product_id: item.product_id,
            product_name: item.product_name,
            requested_qty: item.requested_qty,
            already_in_cart: currentInCart,
            added_qty: 0,
            final_qty: currentInCart,
            available_stock: availableStock,
            reason: 'ALREADY_AT_MAX_STOCK',
          });
        }
      } else {
        // Fully fits available stock
        const finalQty = desiredTotal;
        if (currentInCart > 0) {
          await client.query(
            'UPDATE cart_items SET quantity = $1 WHERE cart_id = $2 AND product_id = $3',
            [finalQty, cartId, item.product_id]
          );
        } else {
          await client.query(
            'INSERT INTO cart_items (cart_id, product_id, quantity) VALUES ($1, $2, $3)',
            [cartId, item.product_id, finalQty]
          );
        }

        addedItems.push({
          product_id: item.product_id,
          product_name: item.product_name,
          requested_qty: item.requested_qty,
          already_in_cart: currentInCart,
          added_qty: item.requested_qty,
          final_qty: finalQty,
          current_price: item.current_price,
        });
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  // Fetch updated cart
  const updatedCart = await getCart(userId, city);

  return {
    status: 'success',
    message: 'Monthly essentials processed for shopping cart.',
    summary: {
      added_count: addedItems.length,
      adjusted_count: adjustedItems.length,
      unavailable_count: unavailableItems.length,
      total_items_in_cart: updatedCart.total_items,
      total_cart_amount: updatedCart.total_amount,
    },
    added_items: addedItems,
    adjusted_items: adjustedItems,
    unavailable_items: unavailableItems,
    cart: updatedCart,
  };
}


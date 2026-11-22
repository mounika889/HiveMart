import pool from '../config/database.js';
import { isValidUUID } from '../utils/validation.js';
import { evaluateProductStock } from './alert.service.js';

const CITY_CODES = {
  Bengaluru: 'BLR',
  Hyderabad: 'HYD',
  Chennai: 'MAA',
  Mumbai: 'BOM',
  Delhi: 'DEL',
};

const SUPPORTED_CITIES = ['Bengaluru', 'Hyderabad', 'Chennai', 'Mumbai', 'Delhi'];

/**
 * Concurrency-safe unique bill number generation using PostgreSQL sequence
 * Format: HVM-{CITY_CODE}-{YYYYMMDD}-{SEQ_6_DIGITS}
 * Example: HVM-BLR-20261122-001001
 */
export const generateBillNumber = async (client, city) => {
  const cityCode = CITY_CODES[city] || 'GEN';
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;

  const seqRes = await client.query(`SELECT nextval('offline_bill_seq') AS seq`);
  const seqNum = String(seqRes.rows[0].seq).padStart(6, '0');

  return `HVM-${cityCode}-${dateStr}-${seqNum}`;
};

/**
 * Fetch and validate retailer profile and city assignment directly from PostgreSQL
 */
export const getAuthorizedRetailerProfile = async (userId) => {
  if (!isValidUUID(userId)) {
    const error = new Error('Invalid retailer ID.');
    error.statusCode = 400;
    throw error;
  }

  const res = await pool.query(
    `SELECT u.id, u.name, u.email, u.role, u.is_active,
            rp.assigned_city, rp.approval_status
     FROM users u
     JOIN retailer_profiles rp ON u.id = rp.user_id
     WHERE u.id = $1`,
    [userId]
  );

  if (res.rows.length === 0) {
    const error = new Error('Retailer profile not found.');
    error.statusCode = 404;
    throw error;
  }

  const profile = res.rows[0];

  if (!profile.is_active) {
    const error = new Error('Retailer account is deactivated. Access denied.');
    error.statusCode = 403;
    throw error;
  }

  if (profile.role.toLowerCase() !== 'retailer') {
    const error = new Error('User is not authorized as a retailer.');
    error.statusCode = 403;
    throw error;
  }

  if (profile.approval_status !== 'APPROVED') {
    const error = new Error(`Retailer account is ${profile.approval_status}. Access denied.`);
    error.statusCode = 403;
    throw error;
  }

  if (!SUPPORTED_CITIES.includes(profile.assigned_city)) {
    const error = new Error(`Invalid assigned city: "${profile.assigned_city}".`);
    error.statusCode = 400;
    throw error;
  }

  return profile;
};

/**
 * Create a new DRAFT bill for an authorized retailer.
 * Important: Draft bill creation does NOT deduct inventory.
 */
export const createDraftBill = async (userId, { paymentMethod = 'CASH', notes = null, items = [] } = {}) => {
  const profile = await getAuthorizedRetailerProfile(userId);
  const assignedCity = profile.assigned_city;

  const validPaymentMethods = ['CASH', 'CARD', 'UPI', 'STORE_TERMINAL'];
  const normalizedPayment = (paymentMethod || 'CASH').toUpperCase();
  if (!validPaymentMethods.includes(normalizedPayment)) {
    const error = new Error(`Invalid payment method: ${paymentMethod}`);
    error.statusCode = 400;
    throw error;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const billNumber = await generateBillNumber(client, assignedCity);

    const insertBillRes = await client.query(
      `INSERT INTO offline_bills (bill_number, retailer_id, city, status, payment_method, notes)
       VALUES ($1, $2, $3, 'DRAFT', $4, $5)
       RETURNING *`,
      [billNumber, userId, assignedCity, normalizedPayment, notes]
    );

    const bill = insertBillRes.rows[0];

    // If initial items provided, validate and add them
    let savedItems = [];
    if (Array.isArray(items) && items.length > 0) {
      const updated = await saveDraftItemsInternal(client, bill.id, items);
      bill.subtotal_amount = updated.subtotal_amount;
      bill.total_amount = updated.total_amount;
      savedItems = updated.items;
    }

    await client.query('COMMIT');

    return {
      bill,
      items: savedItems,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Retrieve the active DRAFT bill for a retailer (if any)
 */
export const getActiveDraft = async (userId) => {
  await getAuthorizedRetailerProfile(userId);

  const billRes = await pool.query(
    `SELECT *
     FROM offline_bills
     WHERE retailer_id = $1 AND status = 'DRAFT'
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId]
  );

  if (billRes.rows.length === 0) {
    return null;
  }

  const bill = billRes.rows[0];
  const itemsRes = await pool.query(
    `SELECT obi.*, p.image_url, p.category, inv.quantity as current_stock
     FROM offline_bill_items obi
     JOIN products p ON obi.product_id = p.id
     LEFT JOIN inventory inv ON obi.product_id = inv.product_id AND LOWER(inv.city) = LOWER($1)
     WHERE obi.bill_id = $2
     ORDER BY obi.created_at ASC`,
    [bill.city, bill.id]
  );

  return {
    bill,
    items: itemsRes.rows,
  };
};

/**
 * Internal helper to validate items, recalculate authoritative prices and update draft items
 */
const saveDraftItemsInternal = async (client, billId, items) => {
  // Clear existing items in draft
  await client.query(`DELETE FROM offline_bill_items WHERE bill_id = $1`, [billId]);

  if (!Array.isArray(items) || items.length === 0) {
    await client.query(
      `UPDATE offline_bills SET subtotal_amount = 0.00, total_amount = 0.00, updated_at = NOW() WHERE id = $1`,
      [billId]
    );
    return { subtotal_amount: '0.00', total_amount: '0.00', items: [] };
  }

  // Deduplicate product IDs in items list
  const productQuantities = new Map();
  for (const it of items) {
    if (!it.productId || !isValidUUID(it.productId)) {
      const err = new Error(`Invalid product ID in items.`);
      err.statusCode = 400;
      throw err;
    }
    const qty = parseInt(it.quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      const err = new Error(`Quantity must be greater than zero for product ${it.productId}.`);
      err.statusCode = 400;
      throw err;
    }
    productQuantities.set(it.productId, (productQuantities.get(it.productId) || 0) + qty);
  }

  const productIds = Array.from(productQuantities.keys());

  // Fetch authoritative products from catalog
  const prodRes = await client.query(
    `SELECT id, name, price, is_active FROM products WHERE id = ANY($1::uuid[])`,
    [productIds]
  );

  if (prodRes.rows.length !== productIds.length) {
    const err = new Error('One or more selected products not found in catalog.');
    err.statusCode = 404;
    throw err;
  }

  let totalCents = 0;
  const savedItems = [];

  for (const prod of prodRes.rows) {
    if (!prod.is_active) {
      const err = new Error(`Product "${prod.name}" is inactive.`);
      err.statusCode = 400;
      throw err;
    }

    const qty = productQuantities.get(prod.id);
    const unitPrice = parseFloat(prod.price);
    const lineCents = Math.round(qty * unitPrice * 100);
    totalCents += lineCents;
    const lineTotal = (lineCents / 100).toFixed(2);

    const insertRes = await client.query(
      `INSERT INTO offline_bill_items (
         bill_id, product_id, product_name_snapshot, unit_price_snapshot, quantity, line_total
       ) VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [billId, prod.id, prod.name, unitPrice.toFixed(2), qty, lineTotal]
    );

    savedItems.push(insertRes.rows[0]);
  }

  const finalTotal = (totalCents / 100).toFixed(2);

  await client.query(
    `UPDATE offline_bills
     SET subtotal_amount = $1, total_amount = $1, updated_at = NOW()
     WHERE id = $2`,
    [finalTotal, billId]
  );

  return {
    subtotal_amount: finalTotal,
    total_amount: finalTotal,
    items: savedItems,
  };
};

/**
 * Update items in an existing DRAFT bill
 */
export const updateDraftItems = async (userId, billId, { items, notes, paymentMethod }) => {
  await getAuthorizedRetailerProfile(userId);

  if (!isValidUUID(billId)) {
    const err = new Error('Invalid bill ID.');
    err.statusCode = 400;
    throw err;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const billRes = await client.query(
      `SELECT * FROM offline_bills WHERE id = $1 AND retailer_id = $2 FOR UPDATE`,
      [billId, userId]
    );

    if (billRes.rows.length === 0) {
      const err = new Error('Bill not found or unauthorized.');
      err.statusCode = 404;
      throw err;
    }

    const bill = billRes.rows[0];
    if (bill.status !== 'DRAFT') {
      const err = new Error(`Cannot modify bill in ${bill.status} status. Only DRAFT bills can be edited.`);
      err.statusCode = 400;
      throw err;
    }

    const updateRes = await saveDraftItemsInternal(client, billId, items || []);

    if (notes !== undefined || paymentMethod !== undefined) {
      await client.query(
        `UPDATE offline_bills
         SET notes = COALESCE($1, notes),
             payment_method = COALESCE($2, payment_method),
             updated_at = NOW()
         WHERE id = $3`,
        [notes, paymentMethod ? paymentMethod.toUpperCase() : null, billId]
      );
    }

    await client.query('COMMIT');

    const refreshedBill = (
      await pool.query('SELECT * FROM offline_bills WHERE id = $1', [billId])
    ).rows[0];

    return {
      bill: refreshedBill,
      items: updateRes.items,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * Cancel a DRAFT bill
 */
export const cancelDraftBill = async (userId, billId) => {
  await getAuthorizedRetailerProfile(userId);

  if (!isValidUUID(billId)) {
    const err = new Error('Invalid bill ID.');
    err.statusCode = 400;
    throw err;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const billRes = await client.query(
      `SELECT * FROM offline_bills WHERE id = $1 AND retailer_id = $2 FOR UPDATE`,
      [billId, userId]
    );

    if (billRes.rows.length === 0) {
      const err = new Error('Bill not found or unauthorized.');
      err.statusCode = 404;
      throw err;
    }

    const bill = billRes.rows[0];
    if (bill.status === 'FINALIZED') {
      const err = new Error('Finalized bills cannot be cancelled without an audited return process.');
      err.statusCode = 400;
      throw err;
    }

    if (bill.status === 'CANCELLED') {
      await client.query('COMMIT');
      return bill;
    }

    const updateRes = await client.query(
      `UPDATE offline_bills SET status = 'CANCELLED', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [billId]
    );

    await client.query('COMMIT');
    return updateRes.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

/**
 * ATOMIC BILL FINALIZATION (CRITICAL BUSINESS TRANSACTION)
 *
 * Steps in ONE PostgreSQL transaction:
 * 1. Validate retailer authorization & live approved status
 * 2. Derive assigned city strictly from PostgreSQL (never trust client)
 * 3. Lock bill row with SELECT FOR UPDATE
 * 4. Idempotency verification: return existing sale if already finalized
 * 5. Validate bill items & recalculate authoritative catalog prices
 * 6. Lock city inventory rows in deterministic product ID order (matching online checkout)
 * 7. Validate warehouse stock availability
 * 8. Create permanent finalized bill snapshot
 * 9. Insert offline_sales record
 * 10. Deduct quantities from city warehouse inventory
 * 11. Record immutable inventory_movements audit rows
 * 12. Increment product version for OpenSearch sync
 * 13. Create transactional outbox event (offline.sale.completed)
 * 14. Mark bill as FINALIZED
 *
 * ROLLBACK if any step fails.
 */
export const finalizeBill = async (userId, billId, { idempotencyKey, paymentMethod } = {}) => {
  // 1. Authorize retailer and get assigned city from PostgreSQL
  const profile = await getAuthorizedRetailerProfile(userId);
  const assignedCity = profile.assigned_city;

  if (!isValidUUID(billId)) {
    const err = new Error('Invalid bill ID.');
    err.statusCode = 400;
    throw err;
  }

  if (!idempotencyKey || typeof idempotencyKey !== 'string' || idempotencyKey.trim() === '') {
    const err = new Error('idempotencyKey is required for bill finalization.');
    err.statusCode = 400;
    throw err;
  }

  const trimmedIdempotencyKey = idempotencyKey.trim();
  const normalizedPayment = (paymentMethod || 'CASH').toUpperCase();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 2. Check Idempotency by key first
    const existingByIdempotency = await client.query(
      `SELECT ob.*, os.id as sale_id
       FROM offline_bills ob
       JOIN offline_sales os ON ob.id = os.bill_id
       WHERE ob.retailer_id = $1 AND ob.idempotency_key = $2 AND ob.status = 'FINALIZED'`,
      [userId, trimmedIdempotencyKey]
    );

    if (existingByIdempotency.rows.length > 0) {
      const bill = existingByIdempotency.rows[0];
      const itemsRes = await client.query(
        `SELECT * FROM offline_bill_items WHERE bill_id = $1 ORDER BY product_id ASC`,
        [bill.id]
      );
      await client.query('COMMIT');
      return {
        bill,
        sale: {
          id: bill.sale_id,
          bill_id: bill.id,
          retailer_id: bill.retailer_id,
          city: bill.city,
          total_amount: bill.total_amount,
        },
        items: itemsRes.rows,
        is_idempotent_replay: true,
      };
    }

    // 3. Lock Bill Row
    const billRes = await client.query(
      `SELECT * FROM offline_bills WHERE id = $1 AND retailer_id = $2 FOR UPDATE`,
      [billId, userId]
    );

    if (billRes.rows.length === 0) {
      const err = new Error('Bill not found or unauthorized.');
      err.statusCode = 404;
      throw err;
    }

    const bill = billRes.rows[0];

    // Check if already finalized (replay)
    if (bill.status === 'FINALIZED') {
      if (bill.idempotency_key && bill.idempotency_key !== trimmedIdempotencyKey) {
        const err = new Error('Bill is already finalized with a different idempotency key.');
        err.statusCode = 400;
        throw err;
      }

      const saleRes = await client.query(
        `SELECT * FROM offline_sales WHERE bill_id = $1`,
        [bill.id]
      );
      const itemsRes = await client.query(
        `SELECT * FROM offline_bill_items WHERE bill_id = $1 ORDER BY product_id ASC`,
        [bill.id]
      );
      await client.query('COMMIT');
      return {
        bill,
        sale: saleRes.rows[0],
        items: itemsRes.rows,
        is_idempotent_replay: true,
      };
    }

    if (bill.status === 'CANCELLED') {
      const err = new Error('Cannot finalize a cancelled bill.');
      err.statusCode = 400;
      throw err;
    }

    // 4. Load bill items
    const billItemsRes = await client.query(
      `SELECT obi.*, p.price as catalog_price, p.name as catalog_name, p.is_active
       FROM offline_bill_items obi
       JOIN products p ON obi.product_id = p.id
       WHERE obi.bill_id = $1
       ORDER BY obi.product_id ASC`,
      [billId]
    );

    const billItems = billItemsRes.rows;
    if (billItems.length === 0) {
      const err = new Error('Cannot finalize an empty bill. Add products before finalization.');
      err.statusCode = 400;
      throw err;
    }

    // 5. Validate active products & compute authoritative total
    let totalCents = 0;
    for (const item of billItems) {
      if (!item.is_active) {
        const err = new Error(`Product "${item.catalog_name}" is inactive.`);
        err.statusCode = 400;
        throw err;
      }
      const unitPrice = parseFloat(item.catalog_price);
      totalCents += Math.round(item.quantity * unitPrice * 100);
    }
    const authoritativeTotal = (totalCents / 100).toFixed(2);

    // 6. Lock City Inventory Rows in Deterministic Product ID Order (Prevent Deadlocks)
    const productIds = billItems.map((item) => item.product_id).sort();

    const inventoryRes = await client.query(
      `SELECT id, product_id, city, quantity
       FROM inventory
       WHERE product_id = ANY($1::uuid[]) AND LOWER(city) = LOWER($2)
       ORDER BY product_id ASC
       FOR UPDATE`,
      [productIds, assignedCity]
    );

    const inventoryMap = new Map();
    inventoryRes.rows.forEach((inv) => {
      inventoryMap.set(inv.product_id, inv);
    });

    // 7. Validate Sufficient Stock
    for (const item of billItems) {
      const inv = inventoryMap.get(item.product_id);
      const availableQty = inv ? inv.quantity : 0;

      if (!inv || availableQty < item.quantity) {
        const err = new Error(
          `Insufficient stock for "${item.product_name_snapshot}" in ${assignedCity}. Requested: ${item.quantity}, Available: ${availableQty}.`
        );
        err.statusCode = 409;
        throw err;
      }
    }

    // 8. Create offline_sales record
    const saleRes = await client.query(
      `INSERT INTO offline_sales (bill_id, retailer_id, city, total_amount, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING *`,
      [bill.id, userId, assignedCity, authoritativeTotal]
    );
    const sale = saleRes.rows[0];

    // 9. Deduct inventory, record inventory_movements, and increment product versions
    for (const item of billItems) {
      const inv = inventoryMap.get(item.product_id);
      const qtyBefore = inv.quantity;
      const qtyAfter = qtyBefore - item.quantity;

      // Deduct stock
      await client.query(
        `UPDATE inventory
         SET quantity = $1, updated_at = NOW()
         WHERE id = $2`,
        [qtyAfter, inv.id]
      );

      // Record immutable inventory movement audit log
      await client.query(
        `INSERT INTO inventory_movements (
           product_id, city, movement_type, quantity_delta,
           quantity_before, quantity_after, source_type, source_id, performed_by, created_at
         ) VALUES ($1, $2, 'OFFLINE_SALE', $3, $4, $5, 'OFFLINE_BILL', $6, $7, NOW())`,
        [
          item.product_id,
          assignedCity,
          -item.quantity,
          qtyBefore,
          qtyAfter,
          bill.id,
          userId,
        ]
      );

      // Increment product version for atomic OpenSearch sync
      await client.query(
        `UPDATE products
         SET version = version + 1, updated_at = NOW()
         WHERE id = $1`,
        [item.product_id]
      );
    }

    // 10. Update bill status to FINALIZED
    const finalizedBillRes = await client.query(
      `UPDATE offline_bills
       SET status = 'FINALIZED',
           subtotal_amount = $1,
           total_amount = $1,
           idempotency_key = $2,
           payment_method = $3,
           finalized_at = NOW(),
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [authoritativeTotal, trimmedIdempotencyKey, normalizedPayment, bill.id]
    );
    const finalizedBill = finalizedBillRes.rows[0];

    // 11. Transactional Outbox Event (offline.sale.completed)
    const outboxPayload = {
      event_type: 'offline.sale.completed',
      bill_id: finalizedBill.id,
      bill_number: finalizedBill.bill_number,
      sale_id: sale.id,
      retailer_id: userId,
      city: assignedCity,
      total_amount: finalizedBill.total_amount,
      items: billItems.map((it) => ({
        product_id: it.product_id,
        product_name: it.product_name_snapshot,
        quantity: it.quantity,
        unit_price: it.unit_price_snapshot,
        line_total: it.line_total,
      })),
      finalized_at: finalizedBill.finalized_at,
    };

    await client.query(
      `INSERT INTO outbox_events (event_type, aggregate_id, payload, created_at)
       VALUES ('offline.sale.completed', $1, $2, NOW())`,
      [finalizedBill.id, JSON.stringify(outboxPayload)]
    );

    // 12. Commit Transaction
    await client.query('COMMIT');

    // 13. Trigger real-time stock alert evaluation post-commit
    for (const it of billItems) {
      evaluateProductStock(it.product_id, assignedCity).catch((err) => {
        console.error(`[ALERT_EVAL_ERROR] Failed to evaluate stock for ${it.product_id}:`, err.message);
      });
    }

    return {
      bill: finalizedBill,
      sale,
      items: billItems,
      is_idempotent_replay: false,
    };
  } catch (err) {
    await client.query('ROLLBACK');

    // Handle race-condition uniqueness conflict on idempotency key
    if (err.code === '23505' && err.constraint === 'uq_offline_bills_retailer_idempotency') {
      const replayRes = await pool.query(
        `SELECT ob.*, os.id as sale_id
         FROM offline_bills ob
         JOIN offline_sales os ON ob.id = os.bill_id
         WHERE ob.retailer_id = $1 AND ob.idempotency_key = $2 AND ob.status = 'FINALIZED'`,
        [userId, trimmedIdempotencyKey]
      );
      if (replayRes.rows.length > 0) {
        const bill = replayRes.rows[0];
        const itemsRes = await pool.query(
          `SELECT * FROM offline_bill_items WHERE bill_id = $1 ORDER BY product_id ASC`,
          [bill.id]
        );
        return {
          bill,
          sale: {
            id: bill.sale_id,
            bill_id: bill.id,
            retailer_id: bill.retailer_id,
            city: bill.city,
            total_amount: bill.total_amount,
          },
          items: itemsRes.rows,
          is_idempotent_replay: true,
        };
      }
    }

    throw err;
  } finally {
    client.release();
  }
};

/**
 * List retailer bills with optional status and pagination
 */
export const listRetailerBills = async (userId, { status = null, page = 1, limit = 20 } = {}) => {
  await getAuthorizedRetailerProfile(userId);

  const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
  const validatedLimit = Math.min(100, Math.max(1, parseInt(limit, 10)));

  let countSql = `SELECT COUNT(*)::int as count FROM offline_bills WHERE retailer_id = $1`;
  let selectSql = `
    SELECT 
      ob.*,
      COUNT(obi.id)::int as item_count,
      SUM(obi.quantity)::int as total_units
    FROM offline_bills ob
    LEFT JOIN offline_bill_items obi ON ob.id = obi.bill_id
    WHERE ob.retailer_id = $1
  `;
  const params = [userId];

  if (status) {
    params.push(status.toUpperCase());
    countSql += ` AND status = $2`;
    selectSql += ` AND ob.status = $2`;
  }

  selectSql += `
    GROUP BY ob.id
    ORDER BY ob.created_at DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `;

  const [countRes, billsRes] = await Promise.all([
    pool.query(countSql, params),
    pool.query(selectSql, [...params, validatedLimit, offset]),
  ]);

  return {
    bills: billsRes.rows,
    pagination: {
      page: Math.max(1, parseInt(page, 10)),
      limit: validatedLimit,
      total: countRes.rows[0].count,
      totalPages: Math.ceil(countRes.rows[0].count / validatedLimit),
    },
  };
};

/**
 * Get single bill by ID for retailer receipt view (strictly enforces retailer ownership)
 */
export const getRetailerBillById = async (userId, billId) => {
  await getAuthorizedRetailerProfile(userId);

  if (!isValidUUID(billId)) {
    const err = new Error('Invalid bill ID.');
    err.statusCode = 400;
    throw err;
  }

  const billRes = await pool.query(
    `SELECT ob.*, u.name as retailer_name, u.email as retailer_email, os.id as sale_id
     FROM offline_bills ob
     JOIN users u ON ob.retailer_id = u.id
     LEFT JOIN offline_sales os ON ob.id = os.bill_id
     WHERE ob.id = $1 AND ob.retailer_id = $2`,
    [billId, userId]
  );

  if (billRes.rows.length === 0) {
    const err = new Error('Bill not found or unauthorized.');
    err.statusCode = 404;
    throw err;
  }

  const bill = billRes.rows[0];

  const itemsRes = await pool.query(
    `SELECT obi.*, p.image_url, p.category
     FROM offline_bill_items obi
     JOIN products p ON obi.product_id = p.id
     WHERE obi.bill_id = $1
     ORDER BY obi.created_at ASC`,
    [billId]
  );

  return {
    bill,
    items: itemsRes.rows,
    sale: bill.sale_id ? { id: bill.sale_id, bill_id: bill.id, total_amount: bill.total_amount } : null,
  };
};

/**
 * Admin: Get overview of offline sales across all regional hubs
 */
export const getAdminOfflineOverview = async () => {
  const [totalsRes, citySalesRes, recentBillsRes, movementsCountRes] = await Promise.all([
    pool.query(`
      SELECT 
        COUNT(*)::int as total_bills,
        COUNT(*) FILTER (WHERE status = 'FINALIZED')::int as finalized_bills,
        COUNT(*) FILTER (WHERE status = 'DRAFT')::int as draft_bills,
        COALESCE(SUM(total_amount) FILTER (WHERE status = 'FINALIZED'), 0)::numeric(12, 2) as total_offline_revenue
      FROM offline_bills
    `),
    pool.query(`
      SELECT 
        city,
        COUNT(*)::int as finalized_sales_count,
        COALESCE(SUM(total_amount), 0)::numeric(12, 2) as total_revenue
      FROM offline_sales
      GROUP BY city
      ORDER BY city
    `),
    pool.query(`
      SELECT 
        ob.id, ob.bill_number, ob.city, ob.status, ob.total_amount, ob.finalized_at,
        u.name as retailer_name,
        COUNT(obi.id)::int as item_count
      FROM offline_bills ob
      JOIN users u ON ob.retailer_id = u.id
      LEFT JOIN offline_bill_items obi ON ob.id = obi.bill_id
      WHERE ob.status = 'FINALIZED'
      GROUP BY ob.id, u.name
      ORDER BY ob.finalized_at DESC
      LIMIT 10
    `),
    pool.query(`SELECT COUNT(*)::int as total_movements FROM inventory_movements`),
  ]);

  return {
    totals: totalsRes.rows[0],
    city_sales: citySalesRes.rows,
    recent_bills: recentBillsRes.rows,
    total_inventory_movements: movementsCountRes.rows[0].total_movements,
  };
};

/**
 * Admin: List inventory movements audit trail
 */
export const getAdminInventoryMovements = async ({ page = 1, limit = 25, city = null, movementType = null } = {}) => {
  const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
  const validatedLimit = Math.min(100, Math.max(1, parseInt(limit, 10)));

  let countSql = `SELECT COUNT(*)::int as count FROM inventory_movements im WHERE 1=1`;
  let selectSql = `
    SELECT 
      im.*,
      p.name as product_name,
      p.category as product_category,
      u.name as performed_by_name,
      u.email as performed_by_email
    FROM inventory_movements im
    JOIN products p ON im.product_id = p.id
    LEFT JOIN users u ON im.performed_by = u.id
    WHERE 1=1
  `;
  const params = [];

  if (city) {
    params.push(city);
    countSql += ` AND im.city = $${params.length}`;
    selectSql += ` AND im.city = $${params.length}`;
  }

  if (movementType) {
    params.push(movementType.toUpperCase());
    countSql += ` AND im.movement_type = $${params.length}`;
    selectSql += ` AND im.movement_type = $${params.length}`;
  }

  selectSql += `
    ORDER BY im.created_at DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `;

  const [countRes, movementsRes] = await Promise.all([
    pool.query(countSql, params),
    pool.query(selectSql, [...params, validatedLimit, offset]),
  ]);

  return {
    movements: movementsRes.rows,
    pagination: {
      page: Math.max(1, parseInt(page, 10)),
      limit: validatedLimit,
      total: countRes.rows[0].count,
      totalPages: Math.ceil(countRes.rows[0].count / validatedLimit),
    },
  };
};

/**
 * Admin: View single bill by ID
 */
export const getAdminBillById = async (billId) => {
  if (!isValidUUID(billId)) {
    const err = new Error('Invalid bill ID.');
    err.statusCode = 400;
    throw err;
  }

  const billRes = await pool.query(
    `SELECT ob.*, u.name as retailer_name, u.email as retailer_email, os.id as sale_id
     FROM offline_bills ob
     JOIN users u ON ob.retailer_id = u.id
     LEFT JOIN offline_sales os ON ob.id = os.bill_id
     WHERE ob.id = $1`,
    [billId]
  );

  if (billRes.rows.length === 0) {
    const err = new Error('Bill not found.');
    err.statusCode = 404;
    throw err;
  }

  const bill = billRes.rows[0];

  const itemsRes = await pool.query(
    `SELECT obi.*, p.image_url, p.category
     FROM offline_bill_items obi
     JOIN products p ON obi.product_id = p.id
     WHERE obi.bill_id = $1
     ORDER BY obi.created_at ASC`,
    [billId]
  );

  return {
    bill,
    items: itemsRes.rows,
    sale: bill.sale_id ? { id: bill.sale_id, bill_id: bill.id, total_amount: bill.total_amount } : null,
  };
};

export default {
  generateBillNumber,
  getAuthorizedRetailerProfile,
  createDraftBill,
  getActiveDraft,
  updateDraftItems,
  cancelDraftBill,
  finalizeBill,
  listRetailerBills,
  getRetailerBillById,
  getAdminOfflineOverview,
  getAdminInventoryMovements,
  getAdminBillById,
};

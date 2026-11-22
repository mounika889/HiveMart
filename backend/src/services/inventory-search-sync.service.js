import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../config/database.js';
import openSearchClient from '../config/opensearch.js';
import { INDEX_NAME, ALIAS_NAME } from '../scripts/setup-search-index.js';
import { evaluateProductStock } from './alert.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const isValidUuid = (id) => typeof id === 'string' && UUID_REGEX.test(id);

/**
 * Synchronizes the specified product IDs from PostgreSQL to OpenSearch.
 *
 * Guarantees:
 * 1. Reads authoritative inventory quantities directly from PostgreSQL.
 * 2. Never deducts stock or subtracts event quantities.
 * 3. Preserves all 5 city stock entries (Bengaluru, Hyderabad, Chennai, Mumbai, Delhi).
 * 4. Stale Update Protection: If an OpenSearch document exists with a newer updated_at
 *    timestamp than the incoming PostgreSQL record, the update is safely rejected.
 *
 * @param {string[]} productIds - Array of product UUIDs to synchronize
 * @param {Object} [options]
 * @param {boolean} [options.force=false] - Bypass stale update guard if true
 * @returns {Promise<{ syncedCount: number, staleSkippedCount: number, products: Object[] }>}
 */
export const syncProductsToOpenSearch = async (productIds, { force = false } = {}) => {
  if (!openSearchClient) {
    const err = new Error('OpenSearch client is not configured or unavailable.');
    err.isRetryable = true;
    throw err;
  }

  if (!Array.isArray(productIds) || productIds.length === 0) {
    return { syncedCount: 0, staleSkippedCount: 0, products: [] };
  }

  // Filter valid UUIDs to protect PostgreSQL from invalid type casting
  const validIds = productIds.filter(isValidUuid);
  if (validIds.length === 0) {
    return { syncedCount: 0, staleSkippedCount: 0, products: [] };
  }

  // Query latest product info and full city inventory from PostgreSQL
  const sql = `
    SELECT 
      p.id,
      p.name,
      p.description,
      p.category,
      p.price,
      p.image_url,
      p.is_active,
      p.updated_at,
      COALESCE(p.version, 10)::bigint AS version,
      GREATEST(p.updated_at, COALESCE(MAX(inv.updated_at), p.updated_at)) AS latest_updated_at,
      COALESCE(
        json_agg(
          json_build_object('city', inv.city, 'quantity', inv.quantity)
        ) FILTER (WHERE inv.city IS NOT NULL),
        '[]'
      ) AS inventory
    FROM products p
    LEFT JOIN inventory inv ON p.id = inv.product_id
    WHERE p.id = ANY($1::uuid[])
    GROUP BY p.id;
  `;

  let pgResult;
  try {
    pgResult = await pool.query(sql, [validIds]);
  } catch (dbErr) {
    dbErr.isRetryable = true;
    throw dbErr;
  }

  const products = pgResult.rows;
  let syncedCount = 0;
  let staleSkippedCount = 0;

  for (const prod of products) {
    const docId = String(prod.id);
    const docVersion = parseInt(prod.version, 10) || 10;
    const newTimestamp = new Date(prod.latest_updated_at || prod.updated_at).getTime();

    // Check existing OpenSearch document for Stale-Update Protection
    if (!force) {
      try {
        const existingDoc = await openSearchClient.get({
          index: ALIAS_NAME,
          id: docId,
        });

        if (existingDoc && existingDoc.body && existingDoc.body._source) {
          const currentTimestamp = new Date(existingDoc.body._source.updated_at).getTime();
          const currentVersion = parseInt(existingDoc.body._version || existingDoc.body._source.version, 10) || 0;
          if (docVersion < currentVersion || newTimestamp < currentTimestamp) {
            console.log(
              `[STALE_GUARD] Skipping stale update for product ${docId}. Current OpenSearch (v=${currentVersion}, ts=${new Date(
                currentTimestamp
              ).toISOString()}), Incoming DB (v=${docVersion}, ts=${new Date(newTimestamp).toISOString()})`
            );
            staleSkippedCount++;
            continue;
          }
        }
      } catch (getErr) {
        // 404 is normal when document is not yet in OpenSearch
        if (getErr.meta?.statusCode !== 404 && getErr.statusCode !== 404) {
          getErr.isRetryable = true;
          throw getErr;
        }
      }
    }

    // Index/Update in OpenSearch with atomic external_gte versioning
    try {
      await openSearchClient.index({
        index: INDEX_NAME,
        id: docId,
        version: docVersion,
        version_type: 'external_gte',
        refresh: true,
        body: {
          product_id: prod.id,
          name: prod.name,
          description: prod.description,
          category: prod.category,
          price: parseFloat(prod.price),
          image_url: prod.image_url,
          is_active: prod.is_active,
          inventory: prod.inventory,
          version: docVersion,
          updated_at: prod.latest_updated_at || prod.updated_at,
        },
      });
      syncedCount++;
    } catch (osErr) {
      const isVersionConflict =
        osErr.statusCode === 409 ||
        osErr.meta?.statusCode === 409 ||
        osErr.message?.includes('version_conflict_engine_exception');

      if (isVersionConflict) {
        console.log(
          `[STALE_GUARD] OpenSearch external version conflict for product ${docId} (v=${docVersion}). Newer version already indexed. Stale write safely prevented.`
        );
        staleSkippedCount++;
      } else {
        osErr.isRetryable = true;
        throw osErr;
      }
    }
  }

  return {
    syncedCount,
    staleSkippedCount,
    products,
  };
};

/**
 * Handles incoming Kafka order.placed event:
 * - Validates schema and event type
 * - Deduplicates against PostgreSQL processed_events
 * - Verifies order exists in PostgreSQL (safely handling synthetic historical test orders)
 * - Queries and synchronizes product inventory to OpenSearch
 * - Records successful event processing in processed_events
 *
 * @param {Object} event - Kafka event message payload
 * @param {Object} [options]
 * @param {string} [options.consumerName='hivemart-search-sync-v1'] - Deduplication consumer identifier
 * @returns {Promise<{ success: boolean, duplicate?: boolean, skipped?: boolean, reason?: string, syncedProducts?: number }>}
 */
export const handleOrderPlacedEvent = async (event, { consumerName = 'hivemart-search-sync-v1' } = {}) => {
  // 1. Validate Event Structure
  if (!event || typeof event !== 'object') {
    console.warn('[CONSUMER] Ignored non-object event payload.');
    return { success: true, skipped: true, reason: 'INVALID_PAYLOAD' };
  }

  const { event_id, event_type, aggregate_id, payload } = event;

  if (event_type !== 'order.placed' && event_type !== 'offline.sale.completed') {
    // Safely ignore events not handled by this consumer
    return { success: true, skipped: true, reason: `UNHANDLED_EVENT_TYPE:${event_type}` };
  }

  if (!event_id) {
    console.warn('[CONSUMER] Event missing event_id. Skipping permanently.');
    return { success: true, skipped: true, reason: 'MISSING_EVENT_ID' };
  }

  // 2. Deduplication check in PostgreSQL processed_events
  if (isValidUuid(event_id)) {
    let dupCheckRes;
    try {
      dupCheckRes = await pool.query(
        `SELECT 1 FROM processed_events WHERE event_id = $1::uuid AND consumer_name = $2`,
        [event_id, consumerName]
      );
    } catch (dbErr) {
      dbErr.isRetryable = true;
      throw dbErr;
    }

    if (dupCheckRes.rows.length > 0) {
      console.log(`[DEDUPLICATION] Event ${event_id} already processed by "${consumerName}". Skipping.`);
      return { success: true, duplicate: true };
    }
  }

  // 3. Verify order or bill exists in PostgreSQL
  let entityExists = false;
  if (aggregate_id && isValidUuid(aggregate_id)) {
    try {
      const checkTable = event_type === 'offline.sale.completed' ? 'offline_bills' : 'orders';
      const checkRes = await pool.query(`SELECT id FROM ${checkTable} WHERE id = $1::uuid`, [aggregate_id]);
      entityExists = checkRes.rows.length > 0;
    } catch (dbErr) {
      dbErr.isRetryable = true;
      throw dbErr;
    }
  }

  // Handle synthetic test orders/bills from earlier test runs safely
  if (!entityExists) {
    console.warn(
      `[CONSUMER] Entity "${aggregate_id}" not found in PostgreSQL (synthetic or deleted test entity). Acknowledging event ${event_id} without altering inventory.`
    );
    if (isValidUuid(event_id)) {
      try {
        await pool.query(
          `INSERT INTO processed_events (event_id, consumer_name, processed_at)
           VALUES ($1::uuid, $2, NOW())
           ON CONFLICT (event_id, consumer_name) DO NOTHING`,
          [event_id, consumerName]
        );
      } catch (dbErr) {
        dbErr.isRetryable = true;
        throw dbErr;
      }
    }
    return { success: true, skipped: true, reason: 'SYNTHETIC_ENTITY_NOT_FOUND' };
  }

  // 4. Extract distinct purchased product IDs
  const productIdsSet = new Set();

  // Primary source: authoritative database table
  try {
    if (event_type === 'offline.sale.completed') {
      const itemsRes = await pool.query(
        `SELECT DISTINCT product_id FROM offline_bill_items WHERE bill_id = $1::uuid`,
        [aggregate_id]
      );
      for (const row of itemsRes.rows) {
        if (row.product_id) productIdsSet.add(row.product_id);
      }
    } else {
      const itemsRes = await pool.query(
        `SELECT DISTINCT product_id FROM order_items WHERE order_id = $1::uuid`,
        [aggregate_id]
      );
      for (const row of itemsRes.rows) {
        if (row.product_id) productIdsSet.add(row.product_id);
      }
    }
  } catch (dbErr) {
    dbErr.isRetryable = true;
    throw dbErr;
  }

  // Fallback source: items in event payload
  if (productIdsSet.size === 0 && payload && Array.isArray(payload.items)) {
    for (const item of payload.items) {
      if (item.product_id && isValidUuid(item.product_id)) {
        productIdsSet.add(item.product_id);
      }
    }
  }

  const distinctProductIds = Array.from(productIdsSet);

  // 5. Synchronize fresh inventory from PostgreSQL to OpenSearch
  let syncResult = { syncedCount: 0, staleSkippedCount: 0 };
  if (distinctProductIds.length > 0) {
    syncResult = await syncProductsToOpenSearch(distinctProductIds);
    console.log(
      `[SEARCH_SYNC] Successfully synced ${syncResult.syncedCount} product(s) to OpenSearch for order ${aggregate_id} (stale skipped: ${syncResult.staleSkippedCount}).`
    );
  }

  // 6. Asynchronous Inventory Stock Alert Evaluation & State Transition
  const eventCity = payload?.city;
  if (eventCity && distinctProductIds.length > 0) {
    for (const pId of distinctProductIds) {
      try {
        await evaluateProductStock(pId, eventCity);
      } catch (alertErr) {
        console.error(`[CONSUMER_ALERT_EVAL_ERROR] Failed alert eval for ${pId} in ${eventCity}:`, alertErr.message);
      }
    }
  }

  // 7. Record event as processed in PostgreSQL processed_events
  if (isValidUuid(event_id)) {
    try {
      await pool.query(
        `INSERT INTO processed_events (event_id, consumer_name, processed_at)
         VALUES ($1::uuid, $2, NOW())
         ON CONFLICT (event_id, consumer_name) DO NOTHING`,
        [event_id, consumerName]
      );
    } catch (dbErr) {
      dbErr.isRetryable = true;
      throw dbErr;
    }
  }

  return {
    success: true,
    syncedProducts: syncResult.syncedCount,
    staleSkipped: syncResult.staleSkippedCount,
  };
};

export default {
  syncProductsToOpenSearch,
  handleOrderPlacedEvent,
  isValidUuid,
};


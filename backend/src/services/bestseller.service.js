import pool from '../config/database.js';
import { SUPPORTED_CITIES } from './alert.service.js';

const ADVISORY_LOCK_ID = 987654321;

/**
 * Returns month boundaries and days observed in the Asia/Kolkata business timezone.
 */
export const getKolkataMonthMetadata = async (client = pool) => {
  const res = await client.query(`
    SELECT 
      DATE_TRUNC('month', NOW() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata' as month_start,
      EXTRACT(DAY FROM NOW() AT TIME ZONE 'Asia/Kolkata')::int as days_observed,
      NOW() AT TIME ZONE 'Asia/Kolkata' as current_time_kolkata
  `);
  return {
    monthStart: res.rows[0].month_start,
    daysObserved: Math.max(1, res.rows[0].days_observed),
    currentTimeKolkata: res.rows[0].current_time_kolkata,
  };
};

/**
 * Computes monthly bestseller analytics for a specific city warehouse:
 * - Aggregates online customer orders (excluding CANCELLED and FAILED)
 * - Aggregates offline finalized counter bills (excluding DRAFT and CANCELLED)
 * - Calculates daily sales velocity, ranks, and estimated days of stock coverage
 * - Evaluates demand-based replenishment warnings
 *
 * @param {string} city - Warehouse city (e.g. 'Bengaluru')
 * @param {Object} [options]
 * @param {number} [options.limit=10] - Number of top bestsellers to return
 * @param {number} [options.coverageThresholdDays=7] - Warning threshold for stock coverage
 * @returns {Promise<Object>} Bestseller analytics report
 */
export const getCityBestsellers = async (city, { limit = 10, coverageThresholdDays = 7, client = pool } = {}) => {
  const normalizedCity = SUPPORTED_CITIES.find((c) => c.toLowerCase() === (city || '').toLowerCase());
  if (!normalizedCity) {
    const err = new Error(`City must be one of: ${SUPPORTED_CITIES.join(', ')}.`);
    err.statusCode = 400;
    throw err;
  }

  const { monthStart, daysObserved } = await getKolkataMonthMetadata(client);

  // Authoritative query combining online confirmed orders and offline finalized counter sales
  const query = `
    WITH online_sales AS (
      SELECT 
        oi.product_id,
        COALESCE(SUM(oi.quantity), 0)::int as online_units
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      WHERE LOWER(o.city) = LOWER($1)
        AND o.status NOT IN ('CANCELLED', 'FAILED')
        AND o.created_at >= $2
      GROUP BY oi.product_id
    ),
    offline_sales AS (
      SELECT 
        obi.product_id,
        COALESCE(SUM(obi.quantity), 0)::int as offline_units
      FROM offline_bills ob
      JOIN offline_bill_items obi ON ob.id = obi.bill_id
      WHERE LOWER(ob.city) = LOWER($1)
        AND ob.status = 'FINALIZED'
        AND ob.created_at >= $2
      GROUP BY obi.product_id
    ),
    combined_sales AS (
      SELECT 
        p.id as product_id,
        p.name as product_name,
        p.category as product_category,
        p.price as product_price,
        p.image_url,
        i.quantity as current_stock,
        COALESCE(ons.online_units, 0)::int as online_units,
        COALESCE(offs.offline_units, 0)::int as offline_units,
        (COALESCE(ons.online_units, 0) + COALESCE(offs.offline_units, 0))::int as total_units
      FROM products p
      JOIN inventory i ON p.id = i.product_id AND LOWER(i.city) = LOWER($1)
      LEFT JOIN online_sales ons ON p.id = ons.product_id
      LEFT JOIN offline_sales offs ON p.id = offs.product_id
      WHERE p.is_active = true
    )
    SELECT *
    FROM combined_sales
    WHERE total_units > 0
    ORDER BY total_units DESC, current_stock ASC
    LIMIT $3
  `;

  const salesRes = await client.query(query, [normalizedCity, monthStart, Math.min(50, Math.max(1, limit))]);
  const rows = salesRes.rows;

  const hasSufficientHistory = rows.length > 0;
  const bestsellers = [];

  let rank = 1;
  for (const row of rows) {
    const totalUnits = row.total_units;
    const avgDailySales = Number((totalUnits / daysObserved).toFixed(2));
    const currentStock = Number(row.current_stock);

    let daysRemaining = null;
    let replenishmentWarning = false;

    if (avgDailySales > 0) {
      daysRemaining = Number((currentStock / avgDailySales).toFixed(1));
      if (daysRemaining <= coverageThresholdDays && currentStock > 0) {
        replenishmentWarning = true;
      }
    }

    bestsellers.push({
      rank: rank++,
      productId: row.product_id,
      productName: row.product_name,
      category: row.product_category,
      price: row.product_price,
      imageUrl: row.image_url,
      currentStock,
      onlineUnits: row.online_units,
      offlineUnits: row.offline_units,
      totalUnits,
      avgDailySales,
      daysOfStockRemaining: daysRemaining,
      replenishmentWarning,
    });
  }

  return {
    city: normalizedCity,
    monthStart,
    daysObserved,
    hasSufficientHistory,
    totalBestsellers: bestsellers.length,
    coverageThresholdDays,
    bestsellers,
  };
};

/**
 * Evaluates and manages BESTSELLER_REPLENISHMENT alerts for a specific city.
 * If a top product has stock coverage < threshold days, dispatches early demand warning.
 */
export const evaluateBestsellerReplenishmentAlerts = async (city, { client = pool, thresholdDays = 7 } = {}) => {
  const analytics = await getCityBestsellers(city, { limit: 10, coverageThresholdDays: thresholdDays, client });

  let warningsGenerated = 0;
  let warningsResolved = 0;

  for (const item of analytics.bestsellers) {
    // Check existing active or acknowledged bestseller alert
    const existingAlertRes = await client.query(
      `SELECT id, status FROM inventory_alerts
       WHERE product_id = $1 AND city = $2 
         AND alert_type = 'BESTSELLER_REPLENISHMENT'
         AND status IN ('ACTIVE', 'ACKNOWLEDGED')`,
      [item.productId, city]
    );

    const existingAlert = existingAlertRes.rows[0];

    if (item.replenishmentWarning) {
      const details = {
        avgDailySales: item.avgDailySales,
        daysOfStockRemaining: item.daysOfStockRemaining,
        totalUnits: item.totalUnits,
        rank: item.rank,
        thresholdDays,
      };

      if (!existingAlert) {
        // Create new BESTSELLER_REPLENISHMENT alert
        const newAlertRes = await client.query(
          `INSERT INTO inventory_alerts (
             product_id, city, alert_type, severity, current_stock, threshold_value, status, details, created_at, updated_at
           ) VALUES ($1, $2, 'BESTSELLER_REPLENISHMENT', 'WARNING', $3, $4, 'ACTIVE', $5, NOW(), NOW())
           RETURNING id`,
          [item.productId, city, item.currentStock, thresholdDays, JSON.stringify(details)]
        );

        const newAlertId = newAlertRes.rows[0].id;

        // Dispatch notifications to retailers assigned to this city
        const retailersRes = await client.query(
          `SELECT u.id
           FROM users u
           JOIN retailer_profiles rp ON u.id = rp.user_id
           WHERE LOWER(rp.assigned_city) = LOWER($1)
             AND rp.approval_status = 'APPROVED'
             AND u.is_active = true`,
          [city]
        );

        const title = `[DEMAND WARNING] High-Velocity Replenishment Needed: ${item.productName} in ${city}`;
        const message = `${item.productName} is a top seller this month (#${item.rank}) with ${item.totalUnits} units sold (avg ${item.avgDailySales} units/day). At current demand, remaining ${item.currentStock} units will last an estimated ${item.daysOfStockRemaining} days. Restock recommended.`;

        for (const ret of retailersRes.rows) {
          await client.query(
            `INSERT INTO notifications (
               recipient_user_id, alert_id, notification_type, title, message, is_read, created_at
             ) VALUES ($1, $2, 'BESTSELLER_WARNING', $3, $4, false, NOW())`,
            [ret.id, newAlertId, title, message]
          );
        }

        warningsGenerated++;
      } else {
        // Update details on existing alert without duplicate notification
        await client.query(
          `UPDATE inventory_alerts
           SET current_stock = $1, details = $2, updated_at = NOW()
           WHERE id = $3`,
          [item.currentStock, JSON.stringify(details), existingAlert.id]
        );
      }
    } else if (existingAlert && (!item.replenishmentWarning || item.currentStock === 0)) {
      // Stock coverage recovered (e.g. restocked) or 0 (standard OUT_OF_STOCK handles 0 stock)
      await client.query(
        `UPDATE inventory_alerts
         SET status = 'RESOLVED', resolved_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [existingAlert.id]
      );
      warningsResolved++;
    }
  }

  return {
    city,
    warningsGenerated,
    warningsResolved,
  };
};

/**
 * Scheduled/Triggered Analytics Job:
 * Recalculates daily sales metrics, updates sales_analytics_daily, and evaluates bestseller warnings.
 * Uses PostgreSQL advisory lock to ensure single-worker execution across multiple instances.
 */
export const runDailyAnalyticsWorker = async () => {
  const client = await pool.connect();
  try {
    // 1. Attempt advisory lock
    const lockRes = await client.query('SELECT pg_try_advisory_lock($1) as acquired', [ADVISORY_LOCK_ID]);
    if (!lockRes.rows[0].acquired) {
      console.log('[ANALYTICS_WORKER] Another analytics job is currently running. Skipping execution.');
      return { skipped: true, reason: 'LOCKED' };
    }

    console.log('[ANALYTICS_WORKER] Acquired lock. Running daily sales aggregation and bestseller evaluation...');

    // 2. Aggregate today's sales into sales_analytics_daily for each product and city
    const todaySalesQuery = `
      WITH today_online AS (
        SELECT 
          oi.product_id,
          o.city,
          COALESCE(SUM(oi.quantity), 0)::int as online_units
        FROM orders o
        JOIN order_items oi ON o.id = oi.order_id
        WHERE o.status NOT IN ('CANCELLED', 'FAILED')
          AND o.created_at >= (DATE_TRUNC('day', NOW() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata')
        GROUP BY oi.product_id, o.city
      ),
      today_offline AS (
        SELECT 
          obi.product_id,
          ob.city,
          COALESCE(SUM(obi.quantity), 0)::int as offline_units
        FROM offline_bills ob
        JOIN offline_bill_items obi ON ob.id = obi.bill_id
        WHERE ob.status = 'FINALIZED'
          AND ob.created_at >= (DATE_TRUNC('day', NOW() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata')
        GROUP BY obi.product_id, ob.city
      ),
      combined AS (
        SELECT 
          COALESCE(o.product_id, f.product_id) as product_id,
          COALESCE(o.city, f.city) as city,
          COALESCE(o.online_units, 0)::int as online_units,
          COALESCE(f.offline_units, 0)::int as offline_units,
          (COALESCE(o.online_units, 0) + COALESCE(f.offline_units, 0))::int as total_units
        FROM today_online o
        FULL OUTER JOIN today_offline f ON o.product_id = f.product_id AND o.city = f.city
      )
      INSERT INTO sales_analytics_daily (
        product_id, city, sales_date, online_units, offline_units, total_units, updated_at
      )
      SELECT 
        product_id, city, (NOW() AT TIME ZONE 'Asia/Kolkata')::date, online_units, offline_units, total_units, NOW()
      FROM combined
      WHERE total_units > 0
      ON CONFLICT (product_id, city, sales_date) DO UPDATE SET
        online_units = EXCLUDED.online_units,
        offline_units = EXCLUDED.offline_units,
        total_units = EXCLUDED.total_units,
        updated_at = NOW();
    `;

    await client.query(todaySalesQuery);

    // 3. Evaluate bestseller replenishment warnings across all 5 cities
    const cityResults = [];
    for (const city of SUPPORTED_CITIES) {
      const cityRes = await evaluateBestsellerReplenishmentAlerts(city, { client });
      cityResults.push(cityRes);
    }

    console.log('[ANALYTICS_WORKER] Successfully completed analytics refresh across all cities.');

    return {
      success: true,
      timestamp: new Date().toISOString(),
      citiesRefreshed: cityResults.length,
      cities: cityResults,
    };
  } finally {
    // Always release advisory lock
    await client.query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK_ID]).catch(() => {});
    client.release();
  }
};

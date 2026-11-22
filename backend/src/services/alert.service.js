import pool from '../config/database.js';
import { isValidUUID } from '../utils/validation.js';

export const DEFAULT_THRESHOLDS = {
  early_warning: 20,
  minimum: 10,
  critical: 5,
};

export const SUPPORTED_CITIES = ['Bengaluru', 'Hyderabad', 'Chennai', 'Mumbai', 'Delhi'];

/**
 * Fetches configured threshold settings for a product and city,
 * falling back to system defaults if not explicitly configured.
 */
export const getEffectiveThresholds = async (productId, city, client = pool) => {
  const res = await client.query(
    `SELECT early_warning_threshold, minimum_stock_threshold, critical_stock_threshold, enabled
     FROM stock_alert_settings
     WHERE product_id = $1 AND city = $2`,
    [productId, city]
  );

  if (res.rows.length > 0 && res.rows[0].enabled) {
    return {
      early_warning: res.rows[0].early_warning_threshold,
      minimum: res.rows[0].minimum_stock_threshold,
      critical: res.rows[0].critical_stock_threshold,
      isCustom: true,
      enabled: true,
    };
  }

  return {
    ...DEFAULT_THRESHOLDS,
    isCustom: false,
    enabled: true,
  };
};

/**
 * Classifies current stock level into a deterministic severity state.
 *
 * Hierarchy:
 * Stock == 0       -> OUT_OF_STOCK (URGENT)
 * 0 < Stock <= 5   -> CRITICAL_STOCK (CRITICAL)
 * 5 < Stock <= 10  -> LOW_STOCK (WARNING)
 * 10 < Stock <= 20 -> REORDER_SOON (INFO)
 * Stock > 20       -> HEALTHY (no standard alert)
 */
export const classifyStockSeverity = (currentStock, thresholds = DEFAULT_THRESHOLDS) => {
  const stock = Number(currentStock);

  if (stock <= 0) {
    return {
      alertType: 'OUT_OF_STOCK',
      severity: 'URGENT',
      thresholdValue: 0,
      titlePrefix: '[OUT OF STOCK]',
      description: 'Stock is completely depleted (0 units remaining).',
    };
  }

  if (stock <= thresholds.critical) {
    return {
      alertType: 'CRITICAL_STOCK',
      severity: 'CRITICAL',
      thresholdValue: thresholds.critical,
      titlePrefix: '[CRITICAL STOCK]',
      description: `Stock has reached critical level (<= ${thresholds.critical} units).`,
    };
  }

  if (stock <= thresholds.minimum) {
    return {
      alertType: 'LOW_STOCK',
      severity: 'WARNING',
      thresholdValue: thresholds.minimum,
      titlePrefix: '[LOW STOCK]',
      description: `Stock is low (<= ${thresholds.minimum} units). Reorder recommended.`,
    };
  }

  if (stock <= thresholds.early_warning) {
    return {
      alertType: 'REORDER_SOON',
      severity: 'INFO',
      thresholdValue: thresholds.early_warning,
      titlePrefix: '[REORDER SOON]',
      description: `Stock is approaching minimum threshold (<= ${thresholds.early_warning} units).`,
    };
  }

  return {
    alertType: null,
    severity: 'HEALTHY',
    thresholdValue: null,
    titlePrefix: '',
    description: 'Stock is healthy.',
  };
};

/**
 * Evaluates stock for a specific product and city directly from authoritative PostgreSQL inventory.
 * Atomically creates, transitions, or resolves alerts and dispatches retailer notifications.
 *
 * Deduplication & State Rules:
 * 1. At most one standard stock alert (OUT_OF_STOCK, CRITICAL_STOCK, LOW_STOCK, REORDER_SOON)
 *    is active for a (product_id, city) pair at any given time.
 * 2. If stock remains in the same severity condition across successive transactions,
 *    existing alert stock is updated without creating duplicate notifications.
 * 3. If stock drops across multiple thresholds in a single sale, only the highest severity
 *    alert is created, and lower severity alerts are resolved.
 * 4. When restocked above threshold, previous alerts are marked RESOLVED.
 * 5. Notifications are only dispatched on meaningful state transitions.
 *
 * @param {string} productId - Product UUID
 * @param {string} city - Warehouse city
 * @param {Object} [options]
 * @param {Object} [options.client] - PostgreSQL client for transactional execution
 * @returns {Promise<Object>} Summary of evaluation result
 */
export const evaluateProductStock = async (productId, city, { client = pool } = {}) => {
  if (!isValidUUID(productId)) {
    return { evaluated: false, reason: 'INVALID_PRODUCT_ID' };
  }

  // 1. Fetch current authoritative inventory and product details from PostgreSQL
  const invRes = await client.query(
    `SELECT i.quantity, p.name, p.category, p.is_active
     FROM inventory i
     JOIN products p ON i.product_id = p.id
     WHERE i.product_id = $1 AND i.city = $2`,
    [productId, city]
  );

  if (invRes.rows.length === 0) {
    return { evaluated: false, reason: 'INVENTORY_NOT_FOUND' };
  }

  const { quantity: currentStock, name: productName, is_active } = invRes.rows[0];
  if (!is_active) {
    return { evaluated: false, reason: 'PRODUCT_INACTIVE' };
  }

  // 2. Fetch configured thresholds
  const thresholds = await getEffectiveThresholds(productId, city, client);
  const classification = classifyStockSeverity(currentStock, thresholds);

  // 3. Query existing active or acknowledged standard alerts for this product & city
  const activeAlertsRes = await client.query(
    `SELECT id, alert_type, severity, current_stock, status
     FROM inventory_alerts
     WHERE product_id = $1 AND city = $2 
       AND status IN ('ACTIVE', 'ACKNOWLEDGED')
       AND alert_type != 'BESTSELLER_REPLENISHMENT'`,
    [productId, city]
  );

  const existingAlert = activeAlertsRes.rows[0] || null;

  // Case 1: Healthy Stock (> early_warning_threshold)
  if (classification.severity === 'HEALTHY') {
    if (existingAlert) {
      // Stock increased above threshold (Restocked). Resolve existing alert.
      await client.query(
        `UPDATE inventory_alerts
         SET status = 'RESOLVED',
             resolved_at = NOW(),
             updated_at = NOW(),
             current_stock = $1
         WHERE id = $2`,
        [currentStock, existingAlert.id]
      );

      return {
        evaluated: true,
        productId,
        city,
        currentStock,
        severity: 'HEALTHY',
        action: 'RESOLVED_EXISTING_ALERT',
        resolvedAlertId: existingAlert.id,
      };
    }

    return {
      evaluated: true,
      productId,
      city,
      currentStock,
      severity: 'HEALTHY',
      action: 'NONE',
    };
  }

  // Case 2: In an Alert Condition (OUT_OF_STOCK, CRITICAL_STOCK, LOW_STOCK, REORDER_SOON)
  const { alertType, severity, thresholdValue, titlePrefix, description } = classification;

  // Subcase 2A: Same condition is already active
  if (existingAlert && existingAlert.alert_type === alertType) {
    // Update current stock on existing alert without re-notifying (Deduplication)
    await client.query(
      `UPDATE inventory_alerts
       SET current_stock = $1,
           threshold_value = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [currentStock, thresholdValue, existingAlert.id]
    );

    return {
      evaluated: true,
      productId,
      city,
      currentStock,
      severity,
      alertType,
      action: 'UPDATED_EXISTING_ALERT',
      alertId: existingAlert.id,
      duplicateSuppressed: true,
    };
  }

  // Subcase 2B: State Transition (e.g. LOW_STOCK -> CRITICAL_STOCK or OUT_OF_STOCK, or partial restock)
  // Resolve any existing superseded alert
  if (existingAlert) {
    await client.query(
      `UPDATE inventory_alerts
       SET status = 'RESOLVED',
           resolved_at = NOW(),
           updated_at = NOW(),
           current_stock = $1
       WHERE id = $2`,
      [currentStock, existingAlert.id]
    );
  }

  // Insert the new alert
  const newAlertRes = await client.query(
    `INSERT INTO inventory_alerts (
       product_id, city, alert_type, severity, current_stock, threshold_value, status, created_at, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE', NOW(), NOW())
     RETURNING *`,
    [productId, city, alertType, severity, currentStock, thresholdValue]
  );

  const newAlert = newAlertRes.rows[0];

  // Dispatch notification to authorized retailers assigned to this city
  const retailersRes = await client.query(
    `SELECT u.id
     FROM users u
     JOIN retailer_profiles rp ON u.id = rp.user_id
     WHERE LOWER(rp.assigned_city) = LOWER($1)
       AND rp.approval_status = 'APPROVED'
       AND u.is_active = true`,
    [city]
  );

  const notificationTitle = `${titlePrefix} ${productName} in ${city}`;
  const notificationMessage = `Stock in ${city} warehouse has reached ${currentStock} units (Threshold: ${thresholdValue}). ${description}`;

  let notificationsCreated = 0;
  for (const ret of retailersRes.rows) {
    await client.query(
      `INSERT INTO notifications (
         recipient_user_id, alert_id, notification_type, title, message, is_read, created_at
       ) VALUES ($1, $2, 'STOCK_ALERT', $3, $4, false, NOW())`,
      [ret.id, newAlert.id, notificationTitle, notificationMessage]
    );
    notificationsCreated++;
  }

  return {
    evaluated: true,
    productId,
    city,
    currentStock,
    severity,
    alertType,
    action: 'CREATED_NEW_ALERT',
    alertId: newAlert.id,
    notificationsCreated,
  };
};

/**
 * Reconciles inventory alerts for all active products across all supported cities.
 * Controlled read-only inventory scan that establishes initial baseline alerts without altering stock.
 */
export const reconcileAllInventoryAlerts = async () => {
  const invRows = await pool.query(
    `SELECT i.product_id, i.city, i.quantity
     FROM inventory i
     JOIN products p ON i.product_id = p.id
     WHERE p.is_active = true
     ORDER BY i.city, p.name`
  );

  let processedCount = 0;
  let createdCount = 0;
  let resolvedCount = 0;

  for (const row of invRows.rows) {
    const res = await evaluateProductStock(row.product_id, row.city);
    processedCount++;
    if (res.action === 'CREATED_NEW_ALERT') createdCount++;
    if (res.action === 'RESOLVED_EXISTING_ALERT') resolvedCount++;
  }

  return {
    processedCount,
    createdCount,
    resolvedCount,
  };
};

/**
 * Retrieves paginated notifications for a retailer user with filtering.
 */
export const getRetailerNotifications = async (retailerUserId, { isRead = null, alertType = null, page = 1, limit = 20 } = {}) => {
  const offset = (Math.max(1, parseInt(page, 10)) - 1) * Math.max(1, parseInt(limit, 10));
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10)));

  const whereClauses = ['n.recipient_user_id = $1'];
  const params = [retailerUserId];
  let paramIdx = 2;

  if (isRead !== null && isRead !== undefined && isRead !== '') {
    whereClauses.push(`n.is_read = $${paramIdx++}`);
    params.push(isRead === 'true' || isRead === true);
  }

  if (alertType && alertType !== 'ALL') {
    whereClauses.push(`a.alert_type = $${paramIdx++}`);
    params.push(alertType);
  }

  const whereStr = whereClauses.join(' AND ');

  const countRes = await pool.query(
    `SELECT COUNT(*)::int as total
     FROM notifications n
     LEFT JOIN inventory_alerts a ON n.alert_id = a.id
     WHERE ${whereStr}`,
    params
  );

  const total = countRes.rows[0].total;

  const listQuery = `
    SELECT 
      n.id,
      n.notification_type,
      n.title,
      n.message,
      n.is_read,
      n.created_at,
      n.read_at,
      a.id as alert_id,
      a.alert_type,
      a.severity,
      a.current_stock,
      a.threshold_value,
      a.status as alert_status,
      a.details as alert_details,
      p.id as product_id,
      p.name as product_name,
      p.category as product_category,
      p.image_url,
      a.city
    FROM notifications n
    LEFT JOIN inventory_alerts a ON n.alert_id = a.id
    LEFT JOIN products p ON a.product_id = p.id
    WHERE ${whereStr}
    ORDER BY n.created_at DESC
    LIMIT $${paramIdx++} OFFSET $${paramIdx++}
  `;

  params.push(safeLimit, offset);
  const listRes = await pool.query(listQuery, params);

  return {
    notifications: listRes.rows,
    pagination: {
      total,
      page: Math.max(1, parseInt(page, 10)),
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit) || 1,
    },
  };
};

/**
 * Returns count of unread notifications for a user.
 */
export const getUnreadNotificationCount = async (userId) => {
  const res = await pool.query(
    `SELECT COUNT(*)::int as unread_count
     FROM notifications
     WHERE recipient_user_id = $1 AND is_read = false`,
    [userId]
  );
  return res.rows[0].unread_count || 0;
};

/**
 * Marks a single notification as read, enforcing recipient ownership.
 */
export const markNotificationAsRead = async (userId, notificationId) => {
  const res = await pool.query(
    `UPDATE notifications
     SET is_read = true, read_at = NOW()
     WHERE id = $1 AND recipient_user_id = $2
     RETURNING id, is_read, read_at`,
    [notificationId, userId]
  );

  if (res.rows.length === 0) {
    const err = new Error('Notification not found or access denied.');
    err.statusCode = 404;
    throw err;
  }

  return res.rows[0];
};

/**
 * Marks all unread notifications for a user as read.
 */
export const markAllNotificationsAsRead = async (userId) => {
  const res = await pool.query(
    `UPDATE notifications
     SET is_read = true, read_at = NOW()
     WHERE recipient_user_id = $1 AND is_read = false
     RETURNING id`,
    [userId]
  );
  return { markedCount: res.rows.length };
};

/**
 * Acknowledges an alert by an authorized retailer or admin.
 */
export const acknowledgeAlert = async (userId, alertId, cityScope = null) => {
  if (!isValidUUID(alertId)) {
    const err = new Error('Invalid alert ID.');
    err.statusCode = 400;
    throw err;
  }

  const whereParams = [alertId, userId];
  let cityClause = '';
  if (cityScope) {
    cityClause = 'AND LOWER(city) = LOWER($3)';
    whereParams.push(cityScope);
  }

  const res = await pool.query(
    `UPDATE inventory_alerts
     SET status = 'ACKNOWLEDGED',
         acknowledged_at = NOW(),
         acknowledged_by = $2,
         updated_at = NOW()
     WHERE id = $1 AND status = 'ACTIVE' ${cityClause}
     RETURNING *`,
    whereParams
  );

  if (res.rows.length === 0) {
    const checkRes = await pool.query(`SELECT id, status, city FROM inventory_alerts WHERE id = $1`, [alertId]);
    if (checkRes.rows.length === 0) {
      const err = new Error('Alert not found.');
      err.statusCode = 404;
      throw err;
    }
    if (cityScope && checkRes.rows[0].city.toLowerCase() !== cityScope.toLowerCase()) {
      const err = new Error('Access denied: alert belongs to another city warehouse.');
      err.statusCode = 403;
      throw err;
    }
    // Already acknowledged or resolved
    return checkRes.rows[0];
  }

  return res.rows[0];
};

/**
 * Retrieves stock alerts for a specific city warehouse (for Retailers).
 */
export const getCityStockAlerts = async (city, { status = 'ACTIVE', severity = null, page = 1, limit = 20 } = {}) => {
  const offset = (Math.max(1, parseInt(page, 10)) - 1) * Math.max(1, parseInt(limit, 10));
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10)));

  const whereClauses = ['LOWER(a.city) = LOWER($1)'];
  const params = [city];
  let paramIdx = 2;

  if (status && status !== 'ALL') {
    whereClauses.push(`a.status = $${paramIdx++}`);
    params.push(status);
  }

  if (severity && severity !== 'ALL') {
    whereClauses.push(`a.severity = $${paramIdx++}`);
    params.push(severity);
  }

  const whereStr = whereClauses.join(' AND ');

  const countRes = await pool.query(
    `SELECT COUNT(*)::int as total FROM inventory_alerts a WHERE ${whereStr}`,
    params
  );
  const total = countRes.rows[0].total;

  const listQuery = `
    SELECT 
      a.id,
      a.product_id,
      a.city,
      a.alert_type,
      a.severity,
      a.current_stock,
      a.threshold_value,
      a.status,
      a.details,
      a.created_at,
      a.updated_at,
      a.acknowledged_at,
      p.name as product_name,
      p.category as product_category,
      p.image_url,
      p.price
    FROM inventory_alerts a
    JOIN products p ON a.product_id = p.id
    WHERE ${whereStr}
    ORDER BY 
      CASE a.severity
        WHEN 'URGENT' THEN 1
        WHEN 'CRITICAL' THEN 2
        WHEN 'WARNING' THEN 3
        WHEN 'INFO' THEN 4
        ELSE 5
      END ASC,
      a.created_at DESC
    LIMIT $${paramIdx++} OFFSET $${paramIdx++}
  `;

  params.push(safeLimit, offset);
  const listRes = await pool.query(listQuery, params);

  return {
    alerts: listRes.rows,
    pagination: {
      total,
      page: Math.max(1, parseInt(page, 10)),
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit) || 1,
    },
  };
};

/**
 * Retrieves platform-wide stock alerts with overview counts across all cities (for Admins).
 */
export const getAdminStockAlertsOverview = async ({ city = null, severity = null, status = 'ACTIVE', page = 1, limit = 50 } = {}) => {
  const offset = (Math.max(1, parseInt(page, 10)) - 1) * Math.max(1, parseInt(limit, 10));
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10)));

  // Aggregate counts by severity and city
  const [countsBySeverityRes, countsByCityRes] = await Promise.all([
    pool.query(`
      SELECT severity, COUNT(*)::int as count
      FROM inventory_alerts
      WHERE status = 'ACTIVE'
      GROUP BY severity
    `),
    pool.query(`
      SELECT city, COUNT(*)::int as total_active,
             COUNT(*) FILTER (WHERE severity = 'URGENT')::int as out_of_stock,
             COUNT(*) FILTER (WHERE severity = 'CRITICAL')::int as critical_stock,
             COUNT(*) FILTER (WHERE severity = 'WARNING')::int as low_stock,
             COUNT(*) FILTER (WHERE severity = 'INFO')::int as reorder_soon
      FROM inventory_alerts
      WHERE status = 'ACTIVE'
      GROUP BY city
      ORDER BY city
    `),
  ]);

  const whereClauses = [];
  const params = [];
  let paramIdx = 1;

  if (city && city !== 'ALL') {
    whereClauses.push(`LOWER(a.city) = LOWER($${paramIdx++})`);
    params.push(city);
  }

  if (status && status !== 'ALL') {
    whereClauses.push(`a.status = $${paramIdx++}`);
    params.push(status);
  }

  if (severity && severity !== 'ALL') {
    whereClauses.push(`a.severity = $${paramIdx++}`);
    params.push(severity);
  }

  const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  const countRes = await pool.query(`SELECT COUNT(*)::int as total FROM inventory_alerts a ${whereStr}`, params);
  const total = countRes.rows[0].total;

  const listQuery = `
    SELECT 
      a.id,
      a.product_id,
      a.city,
      a.alert_type,
      a.severity,
      a.current_stock,
      a.threshold_value,
      a.status,
      a.details,
      a.created_at,
      a.updated_at,
      p.name as product_name,
      p.category as product_category,
      p.image_url,
      p.price
    FROM inventory_alerts a
    JOIN products p ON a.product_id = p.id
    ${whereStr}
    ORDER BY 
      CASE a.severity
        WHEN 'URGENT' THEN 1
        WHEN 'CRITICAL' THEN 2
        WHEN 'WARNING' THEN 3
        WHEN 'INFO' THEN 4
        ELSE 5
      END ASC,
      a.created_at DESC
    LIMIT $${paramIdx++} OFFSET $${paramIdx++}
  `;

  params.push(safeLimit, offset);
  const listRes = await pool.query(listQuery, params);

  return {
    overview: {
      bySeverity: countsBySeverityRes.rows,
      byCity: countsByCityRes.rows,
    },
    alerts: listRes.rows,
    pagination: {
      total,
      page: Math.max(1, parseInt(page, 10)),
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit) || 1,
    },
  };
};

/**
 * Updates or creates stock alert settings for a product and city (Admin only).
 * Validates threshold hierarchy: early_warning >= minimum >= critical >= 0.
 * Automatically triggers immediate re-evaluation of current stock against new thresholds.
 */
export const updateStockThresholdSetting = async (adminUserId, {
  productId,
  city,
  earlyWarningThreshold,
  minimumStockThreshold,
  criticalStockThreshold,
  enabled = true,
}) => {
  if (!isValidUUID(productId)) {
    const err = new Error('Invalid product UUID.');
    err.statusCode = 400;
    throw err;
  }

  const normalizedCity = SUPPORTED_CITIES.find((c) => c.toLowerCase() === (city || '').toLowerCase());
  if (!normalizedCity) {
    const err = new Error(`City must be one of: ${SUPPORTED_CITIES.join(', ')}.`);
    err.statusCode = 400;
    throw err;
  }

  const early = parseInt(earlyWarningThreshold, 10);
  const min = parseInt(minimumStockThreshold, 10);
  const crit = parseInt(criticalStockThreshold, 10);

  if (isNaN(early) || isNaN(min) || isNaN(crit) || early < 0 || min < 0 || crit < 0) {
    const err = new Error('Thresholds must be non-negative integers.');
    err.statusCode = 400;
    throw err;
  }

  if (early < min || min < crit) {
    const err = new Error('Invalid hierarchy: Early warning threshold must be >= minimum threshold, and minimum threshold must be >= critical threshold.');
    err.statusCode = 400;
    throw err;
  }

  const upsertRes = await pool.query(
    `INSERT INTO stock_alert_settings (
       product_id, city, early_warning_threshold, minimum_stock_threshold, critical_stock_threshold, enabled, updated_by, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
     ON CONFLICT (product_id, city) DO UPDATE SET
       early_warning_threshold = EXCLUDED.early_warning_threshold,
       minimum_stock_threshold = EXCLUDED.minimum_stock_threshold,
       critical_stock_threshold = EXCLUDED.critical_stock_threshold,
       enabled = EXCLUDED.enabled,
       updated_by = EXCLUDED.updated_by,
       updated_at = NOW()
     RETURNING *`,
    [productId, normalizedCity, early, min, crit, enabled, adminUserId]
  );

  // Immediately re-evaluate stock with the new threshold
  const evalResult = await evaluateProductStock(productId, normalizedCity);

  return {
    setting: upsertRes.rows[0],
    evalResult,
  };
};

/**
 * Returns current stock thresholds for all products in a city, with defaults where unset.
 */
export const getStockThresholdSettings = async ({ city = null, productId = null, page = 1, limit = 50 } = {}) => {
  const offset = (Math.max(1, parseInt(page, 10)) - 1) * Math.max(1, parseInt(limit, 10));
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10)));

  const whereClauses = ['p.is_active = true'];
  const params = [];
  let paramIdx = 1;

  if (city && city !== 'ALL') {
    whereClauses.push(`LOWER(i.city) = LOWER($${paramIdx++})`);
    params.push(city);
  }

  if (productId && isValidUUID(productId)) {
    whereClauses.push(`p.id = $${paramIdx++}`);
    params.push(productId);
  }

  const whereStr = `WHERE ${whereClauses.join(' AND ')}`;

  const countRes = await pool.query(
    `SELECT COUNT(*)::int as total
     FROM products p
     JOIN inventory i ON p.id = i.product_id
     ${whereStr}`,
    params
  );
  const total = countRes.rows[0].total;

  const query = `
    SELECT 
      p.id as product_id,
      p.name as product_name,
      p.category as product_category,
      i.city,
      i.quantity as current_stock,
      s.id as setting_id,
      COALESCE(s.early_warning_threshold, 20) as early_warning_threshold,
      COALESCE(s.minimum_stock_threshold, 10) as minimum_stock_threshold,
      COALESCE(s.critical_stock_threshold, 5) as critical_stock_threshold,
      COALESCE(s.enabled, true) as enabled,
      s.updated_at as setting_updated_at
    FROM products p
    JOIN inventory i ON p.id = i.product_id
    LEFT JOIN stock_alert_settings s ON p.id = s.product_id AND i.city = s.city
    ${whereStr}
    ORDER BY i.city, p.name
    LIMIT $${paramIdx++} OFFSET $${paramIdx++}
  `;

  params.push(safeLimit, offset);
  const res = await pool.query(query, params);

  return {
    settings: res.rows,
    pagination: {
      total,
      page: Math.max(1, parseInt(page, 10)),
      limit: safeLimit,
      totalPages: Math.ceil(total / safeLimit) || 1,
    },
  };
};


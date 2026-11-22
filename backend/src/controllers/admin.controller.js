import pool from '../config/database.js';
import bcrypt from 'bcrypt';
import { isValidUUID } from '../utils/validation.js';
import * as posService from '../services/pos.service.js';
import * as alertService from '../services/alert.service.js';
import * as bestsellerService from '../services/bestseller.service.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SUPPORTED_CITIES = ['Bengaluru', 'Hyderabad', 'Chennai', 'Mumbai', 'Delhi'];
const VALID_APPROVAL_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'];

/**
 * GET /api/admin/overview
 * Platform statistics and overview
 */
export const getOverview = async (req, res, next) => {
  try {
    const [
      customersRes,
      retailersRes,
      pendingRetailersRes,
      productsRes,
      cityInventoryRes,
      recentOrdersRes,
      offlineStatsRes,
      alertsOverviewRes,
    ] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int as count FROM users WHERE LOWER(role) = 'customer'`),
      pool.query(`SELECT COUNT(*)::int as count FROM users WHERE LOWER(role) = 'retailer'`),
      pool.query(`SELECT COUNT(*)::int as count FROM retailer_profiles WHERE approval_status = 'PENDING'`),
      pool.query(`SELECT COUNT(*)::int as count FROM products WHERE is_active = true`),
      pool.query(`
        SELECT 
          city,
          SUM(quantity)::int as total_stock,
          COUNT(*)::int as product_count,
          COUNT(*) FILTER (WHERE quantity < 10)::int as low_stock_count
        FROM inventory
        GROUP BY city
        ORDER BY city
      `),
      pool.query(`
        SELECT 
          o.id,
          o.user_id,
          o.city,
          o.total_amount,
          o.status,
          o.created_at,
          COUNT(oi.id)::int as total_items
        FROM orders o
        LEFT JOIN order_items oi ON o.id = oi.order_id
        GROUP BY o.id
        ORDER BY o.created_at DESC
        LIMIT 5
      `),
      pool.query(`
        SELECT 
          COUNT(*)::int as total_offline_bills,
          COUNT(*) FILTER (WHERE status = 'FINALIZED')::int as finalized_offline_bills,
          COALESCE(SUM(total_amount) FILTER (WHERE status = 'FINALIZED'), 0)::numeric(12, 2) as total_offline_revenue
        FROM offline_bills
      `),
      pool.query(`
        SELECT 
          COUNT(*)::int as total_active,
          COUNT(*) FILTER (WHERE severity = 'URGENT')::int as out_of_stock,
          COUNT(*) FILTER (WHERE severity = 'CRITICAL')::int as critical_stock,
          COUNT(*) FILTER (WHERE severity = 'WARNING' AND alert_type = 'LOW_STOCK')::int as low_stock,
          COUNT(*) FILTER (WHERE severity = 'INFO')::int as reorder_soon,
          COUNT(*) FILTER (WHERE alert_type = 'BESTSELLER_REPLENISHMENT')::int as bestseller_warnings
        FROM inventory_alerts
        WHERE status = 'ACTIVE'
      `),
    ]);

    res.status(200).json({
      status: 'ok',
      data: {
        total_customers: customersRes.rows[0].count,
        total_retailers: retailersRes.rows[0].count,
        pending_retailers: pendingRetailersRes.rows[0].count,
        total_products: productsRes.rows[0].count,
        city_inventory: cityInventoryRes.rows,
        recent_orders: recentOrdersRes.rows,
        offline_stats: offlineStatsRes.rows[0],
        alerts_overview: alertsOverviewRes ? alertsOverviewRes.rows[0] : null,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/admin/offline/overview
 * Overview of offline retail sales and recent bills across all hubs
 */
export const getOfflineOverview = async (req, res, next) => {
  try {
    const overview = await posService.getAdminOfflineOverview();
    res.status(200).json({
      status: 'ok',
      data: overview,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/admin/inventory/movements
 * Immutable inventory movements audit log
 */
export const getInventoryMovements = async (req, res, next) => {
  try {
    const result = await posService.getAdminInventoryMovements(req.query);
    res.status(200).json({
      status: 'ok',
      data: result.movements,
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/admin/offline/bills/:id
 * Retrieve full bill details by ID
 */
export const getAdminBillById = async (req, res, next) => {
  try {
    const result = await posService.getAdminBillById(req.params.id);
    res.status(200).json({
      status: 'ok',
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/admin/retailers
 * List all retailers with their profile status and city assignment
 */
export const listRetailers = async (req, res, next) => {
  try {
    const query = `
      SELECT 
        u.id,
        u.name,
        u.email,
        u.role,
        u.is_active,
        u.created_at,
        rp.id as profile_id,
        rp.assigned_city,
        rp.approval_status,
        rp.updated_at
      FROM users u
      LEFT JOIN retailer_profiles rp ON u.id = rp.user_id
      WHERE LOWER(u.role) = 'retailer'
      ORDER BY u.created_at DESC
    `;

    const result = await pool.query(query);

    res.status(200).json({
      status: 'ok',
      data: result.rows,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/admin/retailers
 * Create and configure a new retailer account
 */
export const createRetailer = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { name, email, password, assignedCity, approvalStatus = 'APPROVED' } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({
        status: 'error',
        message: 'Name must be a valid string of at least 2 characters.',
      });
    }

    if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide a valid email address.',
      });
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({
        status: 'error',
        message: 'Password must be at least 6 characters long.',
      });
    }

    if (!assignedCity || !SUPPORTED_CITIES.includes(assignedCity)) {
      return res.status(400).json({
        status: 'error',
        message: `Assigned city must be one of: ${SUPPORTED_CITIES.join(', ')}.`,
      });
    }

    const normalizedStatus = (approvalStatus || 'APPROVED').toUpperCase();
    if (!VALID_APPROVAL_STATUSES.includes(normalizedStatus)) {
      return res.status(400).json({
        status: 'error',
        message: `Approval status must be one of: ${VALID_APPROVAL_STATUSES.join(', ')}.`,
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const trimmedName = name.trim();

    // Check existing
    const existing = await client.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [normalizedEmail]);
    if (existing.rows.length > 0) {
      return res.status(409).json({
        status: 'error',
        message: 'Email is already registered.',
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await client.query('BEGIN');

    const userRes = await client.query(
      `INSERT INTO users (name, email, password_hash, role, is_active)
       VALUES ($1, $2, $3, 'retailer', true)
       RETURNING id, name, email, role, is_active, created_at`,
      [trimmedName, normalizedEmail, passwordHash]
    );

    const user = userRes.rows[0];

    const profileRes = await client.query(
      `INSERT INTO retailer_profiles (user_id, assigned_city, approval_status)
       VALUES ($1, $2, $3)
       RETURNING id as profile_id, assigned_city, approval_status, created_at, updated_at`,
      [user.id, assignedCity, normalizedStatus]
    );

    await client.query('COMMIT');

    const profile = profileRes.rows[0];

    res.status(201).json({
      status: 'ok',
      data: {
        ...user,
        ...profile,
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

/**
 * PATCH /api/admin/retailers/:id/status
 * Update approval status: PENDING, APPROVED, REJECTED, SUSPENDED
 */
export const updateRetailerStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { approvalStatus } = req.body;

    if (!isValidUUID(id)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid retailer user ID.',
      });
    }

    const normalizedStatus = (approvalStatus || '').toUpperCase();
    if (!VALID_APPROVAL_STATUSES.includes(normalizedStatus)) {
      return res.status(400).json({
        status: 'error',
        message: `Invalid approval status. Must be one of: ${VALID_APPROVAL_STATUSES.join(', ')}.`,
      });
    }

    const updateRes = await pool.query(
      `UPDATE retailer_profiles
       SET approval_status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $2
       RETURNING id, user_id, assigned_city, approval_status, updated_at`,
      [normalizedStatus, id]
    );

    if (updateRes.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Retailer profile not found for this user.',
      });
    }

    res.status(200).json({
      status: 'ok',
      data: updateRes.rows[0],
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/admin/retailers/:id/city
 * Reassign retailer to another supported city
 */
export const updateRetailerCity = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { assignedCity } = req.body;

    if (!isValidUUID(id)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid retailer user ID.',
      });
    }

    if (!assignedCity || !SUPPORTED_CITIES.includes(assignedCity)) {
      return res.status(400).json({
        status: 'error',
        message: `Invalid city. Must be one of: ${SUPPORTED_CITIES.join(', ')}.`,
      });
    }

    const updateRes = await pool.query(
      `UPDATE retailer_profiles
       SET assigned_city = $1, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $2
       RETURNING id, user_id, assigned_city, approval_status, updated_at`,
      [assignedCity, id]
    );

    if (updateRes.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Retailer profile not found for this user.',
      });
    }

    res.status(200).json({
      status: 'ok',
      data: updateRes.rows[0],
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/admin/retailers/:id/active
 * Toggle user active/deactivated state
 */
export const updateRetailerActive = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (!isValidUUID(id)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid retailer user ID.',
      });
    }

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        status: 'error',
        message: 'isActive must be a boolean value.',
      });
    }

    const updateRes = await pool.query(
      `UPDATE users
       SET is_active = $1
       WHERE id = $2
       RETURNING id, name, email, role, is_active, created_at`,
      [isActive, id]
    );

    if (updateRes.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found.',
      });
    }

    res.status(200).json({
      status: 'ok',
      data: updateRes.rows[0],
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/admin/stock-alerts
 * Cross-city overview and list of active stock alerts
 */
export const getAdminStockAlerts = async (req, res, next) => {
  try {
    const { city, severity, status, page, limit } = req.query;
    const result = await alertService.getAdminStockAlertsOverview({
      city,
      severity,
      status,
      page,
      limit,
    });

    res.status(200).json({
      status: 'ok',
      data: result.alerts,
      overview: result.overview,
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/admin/bestsellers
 * Monthly bestseller analytics across all cities or for a requested city
 */
export const getAdminBestsellers = async (req, res, next) => {
  try {
    const { city, limit } = req.query;
    const targetCity = city && city !== 'ALL' ? city : null;
    const limitNum = limit ? parseInt(limit, 10) : 10;

    if (targetCity) {
      const result = await bestsellerService.getCityBestsellers(targetCity, { limit: limitNum });
      return res.status(200).json({
        status: 'ok',
        data: result,
      });
    }

    const cityAnalytics = [];
    for (const c of alertService.SUPPORTED_CITIES) {
      const cityRes = await bestsellerService.getCityBestsellers(c, { limit: limitNum });
      cityAnalytics.push(cityRes);
    }

    res.status(200).json({
      status: 'ok',
      data: {
        cities: cityAnalytics,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/admin/stock-thresholds
 * Returns stock alert threshold configurations across products and cities
 */
export const getAdminStockThresholds = async (req, res, next) => {
  try {
    const { city, productId, page, limit } = req.query;
    const result = await alertService.getStockThresholdSettings({
      city,
      productId,
      page,
      limit,
    });

    res.status(200).json({
      status: 'ok',
      data: result.settings,
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/admin/stock-thresholds/:id or PUT /api/admin/stock-thresholds
 * Updates product stock alert thresholds and re-evaluates stock immediately
 */
export const updateAdminStockThreshold = async (req, res, next) => {
  try {
    const {
      productId,
      city,
      earlyWarningThreshold,
      minimumStockThreshold,
      criticalStockThreshold,
      enabled,
    } = req.body;

    const result = await alertService.updateStockThresholdSetting(req.user.id, {
      productId: productId || req.params.id,
      city,
      earlyWarningThreshold,
      minimumStockThreshold,
      criticalStockThreshold,
      enabled,
    });

    res.status(200).json({
      status: 'ok',
      data: result.setting,
      evalResult: result.evalResult,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/admin/analytics/refresh
 * Triggers daily sales aggregation and bestseller replenishment evaluation
 */
export const refreshAnalytics = async (req, res, next) => {
  try {
    const result = await bestsellerService.runDailyAnalyticsWorker();
    res.status(200).json({
      status: 'ok',
      data: result,
    });
  } catch (err) {
    next(err);
  }
};



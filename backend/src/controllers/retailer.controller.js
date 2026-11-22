import pool from '../config/database.js';
import * as alertService from '../services/alert.service.js';
import * as bestsellerService from '../services/bestseller.service.js';
import { getAuthorizedRetailerProfile } from '../services/pos.service.js';

/**
 * GET /api/retailer/dashboard
 * Retrieves retailer profile information, assigned city warehouse inventory,
 * today's offline sales summary, recent bills, active alert metrics, and top bestsellers
 */
export const getDashboard = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Fetch user and retailer profile
    const profileRes = await pool.query(
      `SELECT u.id as user_id, u.name, u.email, u.role, u.is_active,
              rp.id as profile_id, rp.assigned_city, rp.approval_status, rp.updated_at
       FROM users u
       JOIN retailer_profiles rp ON u.id = rp.user_id
       WHERE u.id = $1`,
      [userId]
    );

    if (profileRes.rows.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Retailer profile not found.',
      });
    }

    const profileData = profileRes.rows[0];
    const assignedCity = profileData.assigned_city;

    // Fetch inventory for the retailer's assigned city
    const inventoryRes = await pool.query(
      `SELECT 
         p.id,
         p.name,
         p.category,
         p.price,
         p.image_url,
         p.is_active,
         i.quantity as city_stock,
         i.updated_at as inventory_updated_at
       FROM products p
       JOIN inventory i ON p.id = i.product_id
       WHERE i.city = $1 AND p.is_active = true
       ORDER BY p.name ASC`,
      [assignedCity]
    );

    const inventory = inventoryRes.rows;

    // Calculate basic inventory metrics
    const totalProducts = inventory.length;
    const totalUnits = inventory.reduce((sum, item) => sum + (Number(item.city_stock) || 0), 0);
    const lowStockCount = inventory.filter((item) => Number(item.city_stock) > 0 && Number(item.city_stock) < 10).length;
    const outOfStockCount = inventory.filter((item) => Number(item.city_stock) === 0).length;

    // Fetch today's offline sales, recent bills, active alerts summary, and top bestsellers
    const [todaySalesRes, recentBillsRes, alertsSummaryRes, bestsellersData] = await Promise.all([
      pool.query(
        `SELECT 
           COUNT(*)::int as count,
           COALESCE(SUM(total_amount), 0)::numeric(12, 2) as total_amount
         FROM offline_bills
         WHERE retailer_id = $1 AND status = 'FINALIZED' AND created_at >= CURRENT_DATE`,
        [userId]
      ),
      pool.query(
        `SELECT 
           ob.id, ob.bill_number, ob.city, ob.status, ob.total_amount, ob.created_at, ob.finalized_at,
           COUNT(obi.id)::int as item_count
         FROM offline_bills ob
         LEFT JOIN offline_bill_items obi ON ob.id = obi.bill_id
         WHERE ob.retailer_id = $1
         GROUP BY ob.id
         ORDER BY ob.created_at DESC
         LIMIT 5`,
        [userId]
      ),
      pool.query(
        `SELECT 
           COUNT(*)::int as total_active,
           COUNT(*) FILTER (WHERE severity = 'URGENT')::int as out_of_stock,
           COUNT(*) FILTER (WHERE severity = 'CRITICAL')::int as critical_stock,
           COUNT(*) FILTER (WHERE severity = 'WARNING' AND alert_type = 'LOW_STOCK')::int as low_stock,
           COUNT(*) FILTER (WHERE severity = 'INFO')::int as reorder_soon,
           COUNT(*) FILTER (WHERE alert_type = 'BESTSELLER_REPLENISHMENT')::int as bestseller_warnings
         FROM inventory_alerts
         WHERE LOWER(city) = LOWER($1) AND status = 'ACTIVE'`,
        [assignedCity]
      ),
      bestsellerService.getCityBestsellers(assignedCity, { limit: 5 }).catch((err) => {
        console.warn(`[BESTSELLER_ERROR] ${err.message}`);
        return { bestsellers: [], hasSufficientHistory: false };
      }),
    ]);

    const alertMetrics = alertsSummaryRes.rows[0] || {
      total_active: 0,
      out_of_stock: 0,
      critical_stock: 0,
      low_stock: 0,
      reorder_soon: 0,
      bestseller_warnings: 0,
    };

    res.status(200).json({
      status: 'ok',
      data: {
        retailer: {
          id: profileData.user_id,
          name: profileData.name,
          email: profileData.email,
          role: profileData.role,
          profile_id: profileData.profile_id,
          assigned_city: profileData.assigned_city,
          approval_status: profileData.approval_status,
          updated_at: profileData.updated_at,
        },
        metrics: {
          total_products: totalProducts,
          total_units: totalUnits,
          low_stock_count: lowStockCount,
          out_of_stock_count: outOfStockCount,
          today_finalized_bills: todaySalesRes.rows[0].count,
          today_sales_total: todaySalesRes.rows[0].total_amount,
          stock_alerts: {
            active_alerts: alertMetrics.total_active,
            out_of_stock: alertMetrics.out_of_stock,
            critical_stock: alertMetrics.critical_stock,
            low_stock: alertMetrics.low_stock,
            reorder_soon: alertMetrics.reorder_soon,
            bestseller_warnings: alertMetrics.bestseller_warnings,
          },
        },
        top_bestsellers: bestsellersData.bestsellers || [],
        inventory,
        recent_bills: recentBillsRes.rows,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/retailer/notifications
 * Retrieves notifications for the authenticated retailer, supporting filters by read status & alert type.
 */
export const getNotifications = async (req, res, next) => {
  try {
    const { is_read, type, page, limit } = req.query;
    const result = await alertService.getRetailerNotifications(req.user.id, {
      isRead: is_read,
      alertType: type,
      page,
      limit,
    });

    res.status(200).json({
      status: 'ok',
      data: result.notifications,
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/retailer/notifications/unread-count
 * Returns the unread notification count for the retailer navbar badge.
 */
export const getUnreadNotificationCount = async (req, res, next) => {
  try {
    const unreadCount = await alertService.getUnreadNotificationCount(req.user.id);
    res.status(200).json({
      status: 'ok',
      data: {
        unread_count: unreadCount,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/retailer/notifications/:id/read
 * Marks a notification as read, enforcing recipient ownership.
 */
export const markNotificationRead = async (req, res, next) => {
  try {
    const updated = await alertService.markNotificationAsRead(req.user.id, req.params.id);
    res.status(200).json({
      status: 'ok',
      data: updated,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/retailer/notifications/read-all
 * Marks all unread notifications for the retailer as read.
 */
export const markAllNotificationsRead = async (req, res, next) => {
  try {
    const result = await alertService.markAllNotificationsAsRead(req.user.id);
    res.status(200).json({
      status: 'ok',
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/retailer/notifications/:id/acknowledge
 * Acknowledges the underlying alert.
 */
export const acknowledgeNotificationAlert = async (req, res, next) => {
  try {
    const profile = await getAuthorizedRetailerProfile(req.user.id);
    const updated = await alertService.acknowledgeAlert(req.user.id, req.params.id, profile.assigned_city);
    res.status(200).json({
      status: 'ok',
      data: updated,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/retailer/stock-alerts
 * Returns stock alerts for the retailer's assigned city warehouse.
 */
export const getStockAlerts = async (req, res, next) => {
  try {
    const profile = await getAuthorizedRetailerProfile(req.user.id);
    const { status, severity, page, limit } = req.query;

    const result = await alertService.getCityStockAlerts(profile.assigned_city, {
      status,
      severity,
      page,
      limit,
    });

    res.status(200).json({
      status: 'ok',
      data: result.alerts,
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/retailer/bestsellers
 * Returns monthly bestseller analytics for the retailer's assigned city warehouse.
 */
export const getBestsellers = async (req, res, next) => {
  try {
    const profile = await getAuthorizedRetailerProfile(req.user.id);
    const { limit } = req.query;

    const result = await bestsellerService.getCityBestsellers(profile.assigned_city, {
      limit: limit ? parseInt(limit, 10) : 10,
    });

    res.status(200).json({
      status: 'ok',
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

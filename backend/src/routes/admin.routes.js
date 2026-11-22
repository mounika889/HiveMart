import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  getOverview,
  listRetailers,
  createRetailer,
  updateRetailerStatus,
  updateRetailerCity,
  updateRetailerActive,
  getOfflineOverview,
  getInventoryMovements,
  getAdminBillById,
  getAdminStockAlerts,
  getAdminBestsellers,
  getAdminStockThresholds,
  updateAdminStockThreshold,
  refreshAnalytics,
} from '../controllers/admin.controller.js';

const router = Router();

// Protect all admin endpoints with requireAuth and requireRole('admin')
router.use(requireAuth, requireRole('admin'));

router.get('/overview', getOverview);
router.get('/retailers', listRetailers);
router.post('/retailers', createRetailer);
router.patch('/retailers/:id/status', updateRetailerStatus);
router.patch('/retailers/:id/city', updateRetailerCity);
router.patch('/retailers/:id/active', updateRetailerActive);
router.get('/offline/overview', getOfflineOverview);
router.get('/inventory/movements', getInventoryMovements);
router.get('/offline/bills/:id', getAdminBillById);

// Sprint 9H: Smart Inventory Alerts, Thresholds, Bestsellers & Analytics
router.get('/stock-alerts', getAdminStockAlerts);
router.get('/bestsellers', getAdminBestsellers);
router.get('/stock-thresholds', getAdminStockThresholds);
router.patch('/stock-thresholds/:id', updateAdminStockThreshold);
router.put('/stock-thresholds', updateAdminStockThreshold);
router.post('/analytics/refresh', refreshAnalytics);

export default router;

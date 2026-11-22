import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  getDashboard,
  getNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  acknowledgeNotificationAlert,
  getStockAlerts,
  getBestsellers,
} from '../controllers/retailer.controller.js';
import posRoutes from './pos.routes.js';

const router = Router();

// Protect all retailer endpoints with requireAuth and requireRole('retailer')
router.use(requireAuth, requireRole('retailer'));

router.get('/dashboard', getDashboard);
router.use('/pos', posRoutes);

// Smart Inventory Notifications & Alerts
router.get('/notifications', getNotifications);
router.get('/notifications/unread-count', getUnreadNotificationCount);
router.patch('/notifications/read-all', markAllNotificationsRead);
router.patch('/notifications/:id/read', markNotificationRead);
router.patch('/notifications/:id/acknowledge', acknowledgeNotificationAlert);

// Warehouse Stock Alerts & Bestsellers
router.get('/stock-alerts', getStockAlerts);
router.get('/bestsellers', getBestsellers);

export default router;

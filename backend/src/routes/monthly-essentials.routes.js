import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import * as essentialsController from '../controllers/monthly-essentials.controller.js';

const router = Router();

// Enforce authentication and strictly customer role on all monthly essentials endpoints
router.use(requireAuth);
router.use(requireRole('customer'));

// Reminders endpoints (must be before :id routes to prevent param collisions)
router.get('/reminders', essentialsController.getReminders);
router.patch('/reminders/:id/read', essentialsController.markReminderRead);

// List CRUD endpoints
router.post('/', essentialsController.createList);
router.get('/', essentialsController.getLists);
router.get('/:id', essentialsController.getList);
router.put('/:id', essentialsController.updateList);
router.patch('/:id/status', essentialsController.toggleStatus);
router.delete('/:id', essentialsController.deleteList);

// Item management endpoints
router.post('/:id/items', essentialsController.addItem);
router.put('/:id/items/:itemId', essentialsController.updateItem);
router.delete('/:id/items/:itemId', essentialsController.removeItem);

// Cart integration endpoint
router.post('/:id/add-to-cart', essentialsController.addToCart);

export default router;


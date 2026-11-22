import { Router } from 'express';
import { getOrders, getOrderById } from '../controllers/order.controller.js';
import requireAuth from '../middleware/auth.js';

const router = Router();

// Orders require authentication
router.use(requireAuth);

router.get('/', getOrders);
router.get('/:id', getOrderById);

export default router;


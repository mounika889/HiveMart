import { Router } from 'express';
import { checkout } from '../controllers/checkout.controller.js';
import requireAuth from '../middleware/auth.js';

const router = Router();

// Checkout requires authentication
router.use(requireAuth);

router.post('/', checkout);

export default router;


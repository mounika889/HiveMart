import { Router } from 'express';
import { getCart, addItem, updateItemQuantity, removeItem, clearCart } from '../controllers/cart.controller.js';
import requireAuth from '../middleware/auth.js';

const router = Router();

// All cart routes require authentication
router.use(requireAuth);

router.get('/', getCart);
router.post('/items', addItem);
router.patch('/items/:productId', updateItemQuantity);
router.delete('/items/:productId', removeItem);
router.delete('/', clearCart);

export default router;


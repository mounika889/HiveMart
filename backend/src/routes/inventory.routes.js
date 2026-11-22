import { Router } from 'express';
import { getProductInventory } from '../controllers/inventory.controller.js';

const router = Router();

router.get('/:productId', getProductInventory);

export default router;


import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
  createDraft,
  getActiveDraft,
  updateDraftItems,
  cancelDraft,
  finalizeBill,
  listBills,
  getBillById,
} from '../controllers/pos.controller.js';

const router = Router();

// Protect all POS routes: must be authenticated and have APPROVED retailer profile
router.use(requireAuth, requireRole('retailer'));

router.post('/bills', createDraft);
router.get('/bills/draft', getActiveDraft);
router.put('/bills/:id/items', updateDraftItems);
router.post('/bills/:id/cancel', cancelDraft);
router.post('/bills/:id/finalize', finalizeBill);
router.get('/bills', listBills);
router.get('/bills/:id', getBillById);

export default router;


import { Router } from 'express';
import {
  getHealth,
  getDbHealth,
  getSearchHealth,
  getKafkaHealth,
} from '../controllers/health.controller.js';

const router = Router();

router.get('/', getHealth);
router.get('/db', getDbHealth);
router.get('/search', getSearchHealth);
router.get('/kafka', getKafkaHealth);

export default router;

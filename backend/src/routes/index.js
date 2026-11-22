import { Router } from 'express';
import healthRoutes from './health.routes.js';
import productRoutes from './product.routes.js';
import categoryRoutes from './category.routes.js';
import inventoryRoutes from './inventory.routes.js';
import authRoutes from './auth.routes.js';
import cartRoutes from './cart.routes.js';
import searchRoutes from './search.routes.js';
import checkoutRoutes from './checkout.routes.js';
import orderRoutes from './order.routes.js';
import adminRoutes from './admin.routes.js';
import retailerRoutes from './retailer.routes.js';
import monthlyEssentialsRoutes from './monthly-essentials.routes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/products', productRoutes);
router.use('/categories', categoryRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/cart', cartRoutes);
router.use('/search', searchRoutes);
router.use('/checkout', checkoutRoutes);
router.use('/orders', orderRoutes);
router.use('/admin', adminRoutes);
router.use('/retailer', retailerRoutes);
router.use('/customer/monthly-essentials', monthlyEssentialsRoutes);

export default router;

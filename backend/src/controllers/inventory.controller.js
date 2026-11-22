import * as inventoryService from '../services/inventory.service.js';

/**
 * Controller to handle GET /api/inventory/:productId
 */
export const getProductInventory = async (req, res, next) => {
  try {
    const inventoryData = await inventoryService.getInventoryByProductId(req.params.productId);
    res.status(200).json({
      status: 'ok',
      data: inventoryData,
    });
  } catch (err) {
    next(err);
  }
};


import * as productService from '../services/product.service.js';

/**
 * Controller to handle GET /api/categories
 */
export const getCategories = async (req, res, next) => {
  try {
    const categories = await productService.getCategories();
    res.status(200).json({
      status: 'ok',
      data: categories,
    });
  } catch (err) {
    next(err);
  }
};


import * as searchService from '../services/search.service.js';

/**
 * Controller to handle GET /api/search
 */
export const searchProducts = async (req, res, next) => {
  try {
    const result = await searchService.searchProducts(req.query);
    res.status(200).json({
      status: 'ok',
      data: result.products,
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
};


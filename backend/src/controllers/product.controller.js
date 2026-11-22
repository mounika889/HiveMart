import * as productService from '../services/product.service.js';

/**
 * Controller to handle GET /api/products
 */
export const getProducts = async (req, res, next) => {
  try {
    const result = await productService.listProducts(req.query);
    res.status(200).json({
      status: 'ok',
      data: result.products,
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Controller to handle GET /api/products/:id
 */
export const getProductById = async (req, res, next) => {
  try {
    const product = await productService.getProductById(req.params.id);
    res.status(200).json({
      status: 'ok',
      data: product,
    });
  } catch (err) {
    next(err);
  }
};


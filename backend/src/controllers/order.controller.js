import * as orderService from '../services/order.service.js';

/**
 * Controller to handle GET /api/orders
 */
export const getOrders = async (req, res, next) => {
  try {
    const orders = await orderService.listUserOrders(req.user.id);
    res.status(200).json({
      status: 'ok',
      data: orders,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Controller to handle GET /api/orders/:id
 */
export const getOrderById = async (req, res, next) => {
  try {
    const order = await orderService.getOrderById(req.user.id, req.params.id);
    res.status(200).json({
      status: 'ok',
      data: order,
    });
  } catch (err) {
    next(err);
  }
};


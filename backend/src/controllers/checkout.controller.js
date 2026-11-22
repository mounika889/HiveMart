import * as checkoutService from '../services/checkout.service.js';

/**
 * Controller to handle POST /api/checkout
 */
export const checkout = async (req, res, next) => {
  try {
    const { city, idempotencyKey } = req.body;
    const result = await checkoutService.processCheckout(req.user.id, { city, idempotencyKey });

    const statusCode = result.is_idempotent_replay ? 200 : 201;
    res.status(statusCode).json({
      status: 'ok',
      data: result.order,
      ...(result.is_idempotent_replay ? { message: 'Idempotent replay: Order already processed.' } : {}),
    });
  } catch (err) {
    next(err);
  }
};


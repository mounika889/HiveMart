import * as cartService from '../services/cart.service.js';

export const getCart = async (req, res, next) => {
  try {
    const cart = await cartService.getCart(req.user.id, req.query.city);
    res.status(200).json({
      status: 'ok',
      data: cart,
    });
  } catch (err) {
    next(err);
  }
};

export const addItem = async (req, res, next) => {
  try {
    const { productId, quantity, city } = req.body;
    const cart = await cartService.addItemToCart(req.user.id, { productId, quantity, city });
    res.status(201).json({
      status: 'ok',
      data: cart,
    });
  } catch (err) {
    next(err);
  }
};

export const updateItemQuantity = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { quantity, city } = req.body;
    const cart = await cartService.updateItemQuantity(req.user.id, productId, quantity, city);
    res.status(200).json({
      status: 'ok',
      data: cart,
    });
  } catch (err) {
    next(err);
  }
};

export const removeItem = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const result = await cartService.removeItemFromCart(req.user.id, productId);
    res.status(200).json({
      status: 'ok',
      message: result.message,
    });
  } catch (err) {
    next(err);
  }
};

export const clearCart = async (req, res, next) => {
  try {
    const result = await cartService.clearCart(req.user.id);
    res.status(200).json({
      status: 'ok',
      message: result.message,
    });
  } catch (err) {
    next(err);
  }
};


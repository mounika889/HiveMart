import * as posService from '../services/pos.service.js';

export const createDraft = async (req, res, next) => {
  try {
    const result = await posService.createDraftBill(req.user.id, req.body);
    res.status(201).json({
      status: 'ok',
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

export const getActiveDraft = async (req, res, next) => {
  try {
    const result = await posService.getActiveDraft(req.user.id);
    res.status(200).json({
      status: 'ok',
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

export const updateDraftItems = async (req, res, next) => {
  try {
    const result = await posService.updateDraftItems(req.user.id, req.params.id, req.body);
    res.status(200).json({
      status: 'ok',
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

export const cancelDraft = async (req, res, next) => {
  try {
    const result = await posService.cancelDraftBill(req.user.id, req.params.id);
    res.status(200).json({
      status: 'ok',
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

export const finalizeBill = async (req, res, next) => {
  try {
    const { idempotencyKey, paymentMethod } = req.body;
    const result = await posService.finalizeBill(req.user.id, req.params.id, {
      idempotencyKey,
      paymentMethod,
    });

    const statusCode = result.is_idempotent_replay ? 200 : 201;
    res.status(statusCode).json({
      status: 'ok',
      data: {
        bill: result.bill,
        sale: result.sale,
        items: result.items,
      },
      ...(result.is_idempotent_replay
        ? { message: 'Idempotent replay: Bill already finalized.' }
        : {}),
    });
  } catch (err) {
    next(err);
  }
};

export const listBills = async (req, res, next) => {
  try {
    const result = await posService.listRetailerBills(req.user.id, req.query);
    res.status(200).json({
      status: 'ok',
      data: result.bills,
      pagination: result.pagination,
    });
  } catch (err) {
    next(err);
  }
};

export const getBillById = async (req, res, next) => {
  try {
    const result = await posService.getRetailerBillById(req.user.id, req.params.id);
    res.status(200).json({
      status: 'ok',
      data: result,
    });
  } catch (err) {
    next(err);
  }
};


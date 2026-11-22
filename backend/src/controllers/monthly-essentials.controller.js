import * as essentialsService from '../services/monthly-essentials.service.js';

export async function createList(req, res, next) {
  try {
    const userId = req.user.id;
    const { name, shopping_day, reminder_days_before } = req.body;
    const list = await essentialsService.createList(userId, { name, shopping_day, reminder_days_before });
    res.status(201).json({
      status: 'success',
      message: 'Monthly essentials list created successfully.',
      data: list,
    });
  } catch (err) {
    next(err);
  }
}

export async function getLists(req, res, next) {
  try {
    const userId = req.user.id;
    const lists = await essentialsService.getUserLists(userId);
    res.status(200).json({
      status: 'success',
      data: lists,
    });
  } catch (err) {
    next(err);
  }
}

export async function getList(req, res, next) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const city = req.query.city || 'Bengaluru';
    const list = await essentialsService.getListById(userId, id, city);
    res.status(200).json({
      status: 'success',
      data: list,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateList(req, res, next) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { name, shopping_day, reminder_days_before } = req.body;
    const updated = await essentialsService.updateList(userId, id, { name, shopping_day, reminder_days_before });
    res.status(200).json({
      status: 'success',
      message: 'Monthly essentials list updated successfully.',
      data: updated,
    });
  } catch (err) {
    next(err);
  }
}

export async function toggleStatus(req, res, next) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { is_active } = req.body;
    const updated = await essentialsService.toggleListStatus(userId, id, is_active);
    res.status(200).json({
      status: 'success',
      message: `Monthly essentials list ${updated.is_active ? 'resumed' : 'paused'} successfully.`,
      data: updated,
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteList(req, res, next) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const result = await essentialsService.deleteList(userId, id);
    res.status(200).json({
      status: 'success',
      message: result.message,
    });
  } catch (err) {
    next(err);
  }
}

export async function addItem(req, res, next) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { productId, product_id, quantity } = req.body;
    const targetProductId = productId || product_id;
    const item = await essentialsService.addItemToList(userId, id, {
      productId: targetProductId,
      quantity,
    });
    res.status(201).json({
      status: 'success',
      message: 'Item added to monthly essentials list.',
      data: item,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateItem(req, res, next) {
  try {
    const userId = req.user.id;
    const { id, itemId } = req.params;
    const { quantity } = req.body;
    const item = await essentialsService.updateItemQuantity(userId, id, itemId, quantity);
    res.status(200).json({
      status: 'success',
      message: 'Item quantity updated successfully.',
      data: item,
    });
  } catch (err) {
    next(err);
  }
}

export async function removeItem(req, res, next) {
  try {
    const userId = req.user.id;
    const { id, itemId } = req.params;
    const result = await essentialsService.removeItemFromList(userId, id, itemId);
    res.status(200).json({
      status: 'success',
      message: result.message,
    });
  } catch (err) {
    next(err);
  }
}

export async function getReminders(req, res, next) {
  try {
    const userId = req.user.id;
    const reminders = await essentialsService.getDueReminders(userId);
    res.status(200).json({
      status: 'success',
      data: reminders,
    });
  } catch (err) {
    next(err);
  }
}

export async function markReminderRead(req, res, next) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const reminder = await essentialsService.markReminderRead(userId, id);
    res.status(200).json({
      status: 'success',
      message: 'Reminder marked as read.',
      data: reminder,
    });
  } catch (err) {
    next(err);
  }
}

export async function addToCart(req, res, next) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const city = req.body.city || req.query.city || 'Bengaluru';
    const result = await essentialsService.addEssentialsToCart(userId, id, city);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}


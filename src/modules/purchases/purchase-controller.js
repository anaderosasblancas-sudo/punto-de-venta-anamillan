// Controller del módulo de compras.
const purchaseService = require('./purchase-service');
const { validateCreatePurchase } = require('./purchase-validation');
const AppError = require('../../shared/errors/app-error');

// POST /api/purchases
async function createPurchase(req, res, next) {
  try {
    const errors = validateCreatePurchase(req.body);
    if (errors.length > 0) {
      throw new AppError(errors.join('. '), 400);
    }

    const compra = await purchaseService.createPurchase({
      proveedor: req.body.proveedor,
      items: req.body.items,
      usuario: req.user,
    });

    return res.status(201).json({ success: true, data: compra });
  } catch (error) {
    return next(error);
  }
}

// GET /api/purchases
async function listPurchases(req, res, next) {
  try {
    const compras = await purchaseService.listPurchases({
      desde: req.query.desde,
      hasta: req.query.hasta,
    });
    return res.status(200).json({ success: true, data: compras });
  } catch (error) {
    return next(error);
  }
}

// GET /api/purchases/:id
async function getPurchaseById(req, res, next) {
  try {
    const purchaseId = Number(req.params.id);
    const compra = await purchaseService.getPurchaseById(purchaseId);
    return res.status(200).json({ success: true, data: compra });
  } catch (error) {
    return next(error);
  }
}

module.exports = { createPurchase, listPurchases, getPurchaseById };

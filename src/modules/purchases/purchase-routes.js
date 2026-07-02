// Rutas del módulo de compras.
const express = require('express');
const purchaseController = require('./purchase-controller');
const requireAuth = require('../../middlewares/require-auth');
const requireRole = require('../../middlewares/require-role');

const router = express.Router();

// Todas las rutas de compras requieren sesión activa, restringidas a
// encargado y administrador (mismos roles que los movimientos de inventario).
router.use(requireAuth);
router.use(requireRole(['administrador', 'encargado']));

router.get('/', purchaseController.listPurchases);
router.get('/:id', purchaseController.getPurchaseById);
router.post('/', purchaseController.createPurchase);

module.exports = router;

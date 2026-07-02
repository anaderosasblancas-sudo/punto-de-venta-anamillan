// Rutas del módulo de reportes. Solo lectura, restringido a encargado y administrador.
const express = require('express');
const reportController = require('./report-controller');
const requireAuth = require('../../middlewares/require-auth');
const requireRole = require('../../middlewares/require-role');

const router = express.Router();

router.use(requireAuth);
router.use(requireRole(['administrador', 'encargado']));

router.get('/sales-summary', reportController.getSalesSummary);
router.get('/sales-detail', reportController.getSalesDetail);
router.get('/inventory-movements', reportController.getInventoryMovements);

module.exports = router;

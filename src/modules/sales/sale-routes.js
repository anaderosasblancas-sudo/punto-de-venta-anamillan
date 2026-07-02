// Rutas del módulo de ventas.
const express = require('express');
const saleController = require('./sale-controller');
const requireAuth = require('../../middlewares/require-auth');
const requireRole = require('../../middlewares/require-role');

const router = express.Router();

router.use(requireAuth);

// Disponible para cualquier rol autenticado (cajero, encargado, administrador)
router.get('/scan/:codigo', saleController.scanProduct);
router.post('/', saleController.createSale);
router.get('/:folio', saleController.getSaleByFolio);

// RN-04: las devoluciones solo puede procesarlas encargado o administrador
router.post(
  '/:folio/return',
  requireRole(['encargado', 'administrador']),
  saleController.createReturn
);

module.exports = router;

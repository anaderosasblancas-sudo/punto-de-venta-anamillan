// Rutas del módulo de corte de caja.
const express = require('express');
const cashShiftController = require('./cash-shift-controller');
const requireAuth = require('../../middlewares/require-auth');
const requireRole = require('../../middlewares/require-role');

const router = express.Router();

router.use(requireAuth);

// Apertura y cierre disponibles para cualquier rol autenticado
// (un cajero abre y cierra su propio turno; un encargado también puede operar caja).
router.post('/open', cashShiftController.openShift);
router.post('/:id/close', cashShiftController.closeShift);
router.get('/:id', cashShiftController.getShiftById);

// Historial de cortes: solo encargado y administrador (HU-C03)
router.get(
  '/',
  requireRole(['administrador', 'encargado']),
  cashShiftController.listShifts
);

module.exports = router;

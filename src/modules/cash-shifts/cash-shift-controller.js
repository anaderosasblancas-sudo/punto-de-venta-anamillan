// Controller del módulo de corte de caja.
const cashShiftService = require('./cash-shift-service');
const { validateOpenShift, validateCloseShift } = require('./cash-shift-validation');
const AppError = require('../../shared/errors/app-error');

// POST /api/cash-shifts/open
async function openShift(req, res, next) {
  try {
    const errors = validateOpenShift(req.body);
    if (errors.length > 0) {
      throw new AppError(errors.join('. '), 400);
    }

    const shift = await cashShiftService.openShift({
      cajaId: req.body.caja_id,
      fondoApertura: req.body.fondo_apertura,
      usuarioId: req.user.id,
    });

    return res.status(201).json({ success: true, data: shift });
  } catch (error) {
    return next(error);
  }
}

// GET /api/cash-shifts/:id
async function getShiftById(req, res, next) {
  try {
    const shiftId = Number(req.params.id);
    const shift = await cashShiftService.getShiftById(shiftId);
    return res.status(200).json({ success: true, data: shift });
  } catch (error) {
    return next(error);
  }
}

// POST /api/cash-shifts/:id/close
async function closeShift(req, res, next) {
  try {
    const shiftId = Number(req.params.id);
    const errors = validateCloseShift(req.body);
    if (errors.length > 0) {
      throw new AppError(errors.join('. '), 400);
    }

    const closedShift = await cashShiftService.closeShift({
      shiftId,
      efectivoContado: req.body.efectivo_contado,
    });

    return res.status(200).json({ success: true, data: closedShift });
  } catch (error) {
    return next(error);
  }
}

// GET /api/cash-shifts
async function listShifts(req, res, next) {
  try {
    const filters = {
      cajaId: req.query.caja_id ? Number(req.query.caja_id) : undefined,
      desde: req.query.desde,
      hasta: req.query.hasta,
    };

    const shifts = await cashShiftService.listShifts(filters);
    return res.status(200).json({ success: true, data: shifts });
  } catch (error) {
    return next(error);
  }
}

module.exports = { openShift, getShiftById, closeShift, listShifts };

// Controller del módulo de reportes.
const reportService = require('./report-service');

// GET /api/reports/sales-summary
async function getSalesSummary(req, res, next) {
  try {
    const summary = await reportService.getSalesSummary({
      desde: req.query.desde,
      hasta: req.query.hasta,
    });
    return res.status(200).json({ success: true, data: summary });
  } catch (error) {
    return next(error);
  }
}

// GET /api/reports/sales-detail
async function getSalesDetail(req, res, next) {
  try {
    const detail = await reportService.getSalesDetail({
      desde: req.query.desde,
      hasta: req.query.hasta,
      cajaId: req.query.caja_id ? Number(req.query.caja_id) : undefined,
      usuarioId: req.query.usuario_id ? Number(req.query.usuario_id) : undefined,
    });
    return res.status(200).json({ success: true, data: detail });
  } catch (error) {
    return next(error);
  }
}

// GET /api/reports/inventory-movements
async function getInventoryMovements(req, res, next) {
  try {
    const movements = await reportService.getInventoryMovements({
      desde: req.query.desde,
      hasta: req.query.hasta,
      tipo: req.query.tipo,
      productoId: req.query.producto_id ? Number(req.query.producto_id) : undefined,
    });
    return res.status(200).json({ success: true, data: movements });
  } catch (error) {
    return next(error);
  }
}

module.exports = { getSalesSummary, getSalesDetail, getInventoryMovements };

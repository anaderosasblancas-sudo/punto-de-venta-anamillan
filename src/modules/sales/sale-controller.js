// Controller del módulo de ventas.
const saleService = require('./sale-service');
const productService = require('../products/product-service');
const { validateCreateSale, validateReturn } = require('./sale-validation');
const AppError = require('../../shared/errors/app-error');

// GET /api/sales/scan/:codigo
// Busca un producto por código de barras para agregarlo al ticket (HU-V01).
// No descuenta stock: solo confirma disponibilidad y datos para mostrar en el ticket.
async function scanProduct(req, res, next) {
  try {
    const product = await productService.getProductByBarcode(req.params.codigo);

    if (!product) {
      // HU-V01 Escenario 2
      throw new AppError('Código no encontrado', 404);
    }

    if (product.estado === 'inactivo') {
      // HU-P03 Escenario 2
      throw new AppError('Producto no disponible para venta', 400);
    }

    return res.status(200).json({
      success: true,
      data: {
        producto_id: product.id,
        nombre: product.nombre,
        precio_unitario: product.precio_venta,
        stock_disponible: product.stock_actual,
      },
    });
  } catch (error) {
    return next(error);
  }
}

// POST /api/sales
async function createSale(req, res, next) {
  try {
    const errors = validateCreateSale(req.body);
    if (errors.length > 0) {
      throw new AppError(errors.join('. '), 400);
    }

    const venta = await saleService.createSale({
      items: req.body.items,
      metodoPago: req.body.metodo_pago,
      montoEfectivo: req.body.monto_efectivo,
      montoTarjeta: req.body.monto_tarjeta,
      cajaId: req.body.caja_id,
      usuario: req.user,
      autorizacion: req.body.autorizacion,
    });

    return res.status(201).json({ success: true, data: venta });
  } catch (error) {
    return next(error);
  }
}

// GET /api/sales/:folio
async function getSaleByFolio(req, res, next) {
  try {
    const venta = await saleService.getSaleByFolio(req.params.folio);
    return res.status(200).json({ success: true, data: venta });
  } catch (error) {
    return next(error);
  }
}

// POST /api/sales/:folio/return
// Restringido a encargado/administrador en la ruta (RN-04).
async function createReturn(req, res, next) {
  try {
    const errors = validateReturn(req.body);
    if (errors.length > 0) {
      throw new AppError(errors.join('. '), 400);
    }

    const devolucion = await saleService.createReturn({
      folio: req.params.folio,
      tipo: req.body.tipo || 'total',
      detalleVentaIds: req.body.detalle_venta_ids || [],
      usuario: req.user,
    });

    return res.status(201).json({ success: true, data: devolucion });
  } catch (error) {
    return next(error);
  }
}

module.exports = { scanProduct, createSale, getSaleByFolio, createReturn };

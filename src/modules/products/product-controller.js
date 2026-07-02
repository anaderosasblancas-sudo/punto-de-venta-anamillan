// Controller del módulo de productos.
// Recibe la petición HTTP, valida el input y delega la lógica al service.
const productService = require('./product-service');
const {
  validateCreateProduct,
  validateUpdatePrice,
  validateStockEntry,
  validateStockAdjustment,
} = require('./product-validation');
const AppError = require('../../shared/errors/app-error');

// POST /api/products
async function createProduct(req, res, next) {
  try {
    const errors = validateCreateProduct(req.body);
    if (errors.length > 0) {
      // HU-P01 Escenario 3: campos obligatorios vacíos
      throw new AppError(errors.join('. '), 400);
    }

    const product = await productService.createProduct(req.body);
    return res.status(201).json({ success: true, data: product });
  } catch (error) {
    return next(error);
  }
}

// GET /api/products/:id
async function getProductById(req, res, next) {
  try {
    const productId = Number(req.params.id);
    const product = await productService.getProductById(productId);
    return res.status(200).json({ success: true, data: product });
  } catch (error) {
    return next(error);
  }
}

// GET /api/products
async function listProducts(req, res, next) {
  try {
    const filters = {
      codigo_barras: req.query.codigo_barras,
      nombre: req.query.nombre,
      categoria_id: req.query.categoria_id ? Number(req.query.categoria_id) : undefined,
      estado: req.query.estado,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    };

    const result = await productService.listProducts(filters);
    return res.status(200).json({
      success: true,
      data: result.items,
      pagination: result.pagination,
    });
  } catch (error) {
    return next(error);
  }
}

// GET /api/products/barcode/:codigo
// Endpoint usado por la pantalla de cobro para el escaneo (HU-V01).
async function getProductByBarcode(req, res, next) {
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

    return res.status(200).json({ success: true, data: product });
  } catch (error) {
    return next(error);
  }
}

// PATCH /api/products/:id/price
async function updateProductPrice(req, res, next) {
  try {
    const productId = Number(req.params.id);
    const errors = validateUpdatePrice(req.body);
    if (errors.length > 0) {
      throw new AppError(errors.join('. '), 400);
    }

    // req.user es adjuntado por el middleware requireAuth
    const userId = req.user.id;
    const updated = await productService.updateProductPrice(
      productId,
      req.body.precio_venta,
      userId
    );

    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    return next(error);
  }
}

// PATCH /api/products/:id
async function updateProduct(req, res, next) {
  try {
    const productId = Number(req.params.id);
    const updated = await productService.updateProduct(productId, req.body);
    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    return next(error);
  }
}

// GET /api/products/:id/price-history
async function getPriceHistory(req, res, next) {
  try {
    const productId = Number(req.params.id);
    const history = await productService.getPriceHistory(productId);
    return res.status(200).json({ success: true, data: history });
  } catch (error) {
    return next(error);
  }
}

// PATCH /api/products/:id/deactivate
async function deactivateProduct(req, res, next) {
  try {
    const productId = Number(req.params.id);
    const product = await productService.deactivateProduct(productId);
    return res.status(200).json({ success: true, data: product });
  } catch (error) {
    return next(error);
  }
}

// GET /api/products/categories
async function getCategories(req, res, next) {
  try {
    const categories = await productService.getCategories();
    return res.status(200).json({ success: true, data: categories });
  } catch (error) {
    return next(error);
  }
}

// GET /api/products/alerts/low-stock
async function getLowStockProducts(req, res, next) {
  try {
    const products = await productService.getLowStockProducts();
    return res.status(200).json({ success: true, data: products });
  } catch (error) {
    return next(error);
  }
}

// POST /api/products/stock-entries
async function registerStockEntry(req, res, next) {
  try {
    const errors = validateStockEntry(req.body);
    if (errors.length > 0) {
      throw new AppError(errors.join('. '), 400);
    }

    const userId = req.user.id;
    const product = await productService.registerStockEntry({
      productoId: req.body.producto_id,
      cantidad: req.body.cantidad,
      proveedor: req.body.proveedor,
      usuarioId: userId,
    });

    return res.status(201).json({ success: true, data: product });
  } catch (error) {
    return next(error);
  }
}

// POST /api/products/stock-adjustments
async function applyStockAdjustment(req, res, next) {
  try {
    const errors = validateStockAdjustment(req.body);
    if (errors.length > 0) {
      throw new AppError(errors.join('. '), 400);
    }

    const userId = req.user.id;
    const product = await productService.applyStockAdjustment({
      productoId: req.body.producto_id,
      cantidad: req.body.cantidad,
      motivo: req.body.motivo,
      usuarioId: userId,
    });

    return res.status(200).json({ success: true, data: product });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createProduct,
  getProductById,
  listProducts,
  getCategories,
  getProductByBarcode,
  updateProductPrice,
  updateProduct,
  getPriceHistory,
  deactivateProduct,
  getLowStockProducts,
  registerStockEntry,
  applyStockAdjustment,
};

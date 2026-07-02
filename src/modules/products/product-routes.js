// Rutas del módulo de productos.
// Convención de nombre de archivo: inglés, minúsculas, con guión.
const express = require('express');
const productController = require('./product-controller');
const requireAuth = require('../../middlewares/require-auth');
const requireRole = require('../../middlewares/require-role');

const router = express.Router();

// Todas las rutas de productos requieren sesión activa
router.use(requireAuth);

// Búsqueda por código de barras — usada por la pantalla de cobro (HU-V01).
// Disponible para cualquier rol autenticado (cajero, encargado, administrador).
router.get('/barcode/:codigo', productController.getProductByBarcode);

// Alertas de stock bajo (HU-I02) — visible para encargado y administrador
router.get(
  '/alerts/low-stock',
  requireRole(['administrador', 'encargado']),
  productController.getLowStockProducts
);

// Listado de categorías para el formulario de productos — debe ir antes de '/:id'
// para que Express no interprete "categories" como un id de producto.
router.get('/categories', productController.getCategories);

// Listado general y consulta individual — disponible para todos los roles autenticados
router.get('/', productController.listProducts);
router.get('/:id', productController.getProductById);
router.get('/:id/price-history', productController.getPriceHistory);

// Creación y edición de catálogo — solo administrador (HU-P01, HU-P02)
router.post('/', requireRole(['administrador']), productController.createProduct);
router.patch('/:id', requireRole(['administrador']), productController.updateProduct);
router.patch(
  '/:id/price',
  requireRole(['administrador']),
  productController.updateProductPrice
);
router.patch(
  '/:id/deactivate',
  requireRole(['administrador']),
  productController.deactivateProduct
);

// Movimientos de inventario — administrador y encargado (HU-I01, HU-I03)
router.post(
  '/stock-entries',
  requireRole(['administrador', 'encargado']),
  productController.registerStockEntry
);
router.post(
  '/stock-adjustments',
  requireRole(['administrador', 'encargado']),
  productController.applyStockAdjustment
);

module.exports = router;

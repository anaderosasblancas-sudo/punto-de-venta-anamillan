// Configuración principal de Express.
// Aquí se registran middlewares globales y las rutas de cada módulo.
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { mountSwaggerDocs } = require('./config/swagger');

const productRoutes = require('./modules/products/product-routes');
const userRoutes = require('./modules/users/user-routes');
const authRoutes = require('./modules/auth/auth-routes');
const saleRoutes = require('./modules/sales/sale-routes');
const cashShiftRoutes = require('./modules/cash-shifts/cash-shift-routes');
const clientRoutes = require('./modules/clients/client-routes');
const purchaseRoutes = require('./modules/purchases/purchase-routes');
const reportRoutes = require('./modules/reports/report-routes');
const errorHandler = require('./middlewares/error-handler');

const app = express();

app.use(cors());
app.use(express.json());

// Healthcheck simple para verificar que el servidor está vivo
app.get('/api/health', (req, res) => {
  res.status(200).json({ success: true, data: { status: 'ok' } });
});

// Rutas de módulos
app.use('/api/products', productRoutes);
app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/cash-shifts', cashShiftRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/reports', reportRoutes);

mountSwaggerDocs(app);

// Ruta no encontrada
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Ruta no encontrada' });
});

// Middleware global de manejo de errores (siempre al final)
app.use(errorHandler);

module.exports = app;

// ejemplo-integracion/app.example.js
//
// EJEMPLO de referencia — NO reemplaza tu app.js real.
// Muestra las dos líneas que debes agregar a tu archivo existente
// para exponer la documentación Swagger.

import express from 'express';
import { mountSwaggerDocs } from '../src/config/swagger.js';

const app = express();
app.use(express.json());

// --- Agrega esta línea junto con el resto de tus middlewares/rutas ---
mountSwaggerDocs(app); // expone GET /api-docs y GET /api-docs.json
// ----------------------------------------------------------------------

// ... aquí van tus rutas reales: app.use('/api/productos', productRoutes), etc.

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
  console.log(`Documentación Swagger en http://localhost:${PORT}/api-docs`);
});

// src/config/swagger.js
//
// Integración de Swagger UI para servir la documentación OpenAPI de la API.
// Archivo nuevo y autocontenido: no modifica ningún archivo existente del
// proyecto. Solo se debe importar y montar en tu app.js / server.js (ver
// instrucciones en README-SWAGGER.md).

import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carga el documento OpenAPI (docs/openapi.yaml, relativo a la raíz del proyecto)
const openapiPath = path.join(__dirname, '..', '..', 'docs', 'openapi.yaml');
const swaggerDocument = YAML.load(openapiPath);

// Opciones visuales de Swagger UI
const swaggerUiOptions = {
  customSiteTitle: 'API POS ITH - Documentación',
  swaggerOptions: {
    persistAuthorization: true, // conserva el token JWT ingresado entre recargas
  },
};

/**
 * Monta la documentación Swagger en la app de Express.
 * Uso en app.js:
 *
 *   import { mountSwaggerDocs } from './src/config/swagger.js';
 *   mountSwaggerDocs(app);
 *
 * Rutas expuestas:
 *   GET /api-docs          -> interfaz interactiva de Swagger UI
 *   GET /api-docs.json     -> documento OpenAPI en formato JSON crudo
 */
export function mountSwaggerDocs(app, basePath = '/api-docs') {
  app.use(basePath, swaggerUi.serve, swaggerUi.setup(swaggerDocument, swaggerUiOptions));

  // Expone el JSON crudo, útil para clientes generadores de código (openapi-generator, Postman, etc.)
  app.get(`${basePath}.json`, (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerDocument);
  });
}

export default mountSwaggerDocs;

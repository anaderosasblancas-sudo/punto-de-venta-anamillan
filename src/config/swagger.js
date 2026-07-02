// Integración de Swagger UI para servir la documentación OpenAPI de la API.
const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');

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
 *
 * Rutas expuestas:
 *   GET /api-docs          -> interfaz interactiva de Swagger UI
 *   GET /api-docs.json     -> documento OpenAPI en formato JSON crudo
 */
function mountSwaggerDocs(app, basePath = '/api-docs') {
  app.use(basePath, swaggerUi.serve, swaggerUi.setup(swaggerDocument, swaggerUiOptions));

  app.get(`${basePath}.json`, (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerDocument);
  });
}

module.exports = { mountSwaggerDocs };

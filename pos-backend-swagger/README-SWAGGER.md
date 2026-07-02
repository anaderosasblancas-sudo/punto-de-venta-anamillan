# Documentación Swagger/OpenAPI — POS ITH

Este paquete contiene **solo archivos nuevos**. No modifica ningún archivo existente
de tu proyecto; tú decides dónde y cómo montarlo.

## Contenido

```
pos-backend-swagger/
├── docs/
│   └── openapi.yaml              <- especificación OpenAPI 3.0 completa (22 endpoints)
├── src/
│   └── config/
│       └── swagger.js            <- integración con swagger-ui-express
├── ejemplo-integracion/
│   └── app.example.js            <- ejemplo de cómo montar el módulo en tu app real
├── package.json                  <- dependencias a fusionar con tu package.json
└── README-SWAGGER.md
```

## 1. Instalación

```bash
npm install swagger-ui-express yamljs
```

## 2. Integración (2 líneas en tu app.js real)

```js
import { mountSwaggerDocs } from './src/config/swagger.js';

// ... después de crear tu app de Express:
mountSwaggerDocs(app);
```

Esto expone:
- `GET /api-docs` — interfaz interactiva de Swagger UI
- `GET /api-docs.json` — el documento OpenAPI en JSON crudo (útil para Postman,
  generadores de clientes, etc.)

Revisa `ejemplo-integracion/app.example.js` para un ejemplo mínimo completo.

## 3. Ubicación de los archivos

- Copia `docs/openapi.yaml` a la raíz de tu proyecto (o ajusta la ruta en
  `src/config/swagger.js` si prefieres otra ubicación).
- Copia `src/config/swagger.js` dentro de tu carpeta `src/config/` existente.

## 4. Qué cubre `openapi.yaml`

22 endpoints agrupados en 6 módulos, con parámetros, ejemplos de
request/response y códigos de error (400, 401, 403, 404, 409, 500)
extraídos directamente de las historias de usuario y reglas de negocio de `spec.md`:

| Módulo | Endpoints |
|---|---|
| **Autenticación** | `POST /auth/login` (JWT) |
| **Productos** | CRUD + baja lógica (US-P01–P03) y códigos de barras (US-P05) |
| **Categorías** | listar, crear, eliminar (US-P04) |
| **Ventas** | registrar venta (US-V01/V02), descuentos (US-V03), cancelar (US-V04), devoluciones (US-V05), reimprimir (US-V06) |
| **Inventario** | entradas (US-I01), ajustes (US-I02), alertas de stock mínimo (US-I03), historial (US-I04), reporte de existencias (US-I05) |
| **Turnos y Corte de Caja** | apertura (US-C01), retiros (US-C03), corte parcial (US-C02), corte final (US-C04), históricos (US-C05) |

Todos los esquemas siguen el formato de respuesta del proyecto:
- Éxito: `{ "success": true, "data": ... }`
- Error: `{ "success": false, "error": "Mensaje descriptivo" }`

## 5. Autenticación en Swagger UI

En la interfaz `/api-docs`, haz clic en **Authorize** e ingresa tu token JWT
(sin el prefijo `Bearer`, Swagger UI lo agrega automáticamente). El token se
persiste entre recargas gracias a `persistAuthorization: true`.

## 6. Ajustes que probablemente necesites

- **Rutas base**: el documento usa `/api/...` como prefijo (ver `servers` en
  `openapi.yaml`). Ajusta si tu proyecto usa otro prefijo.
- **Nombres de campos**: se usó camelCase en inglés para el cuerpo de las
  peticiones (siguiendo la convención de código del proyecto), aunque las
  tablas en Supabase están en español. Ajusta los `schemas` si tu capa de
  serialización expone los nombres de otra forma.
- **Roles**: los códigos 403 asumen roles `cajero`, `supervisor`,
  `administrador` codificados en el JWT; ajusta si tu implementación difiere.

# Backend — Sistema POS Minisuper

Implementación de los módulos de negocio del backend, basada en `spec.md`,
`plan.md` y `tasks.md`. Sigue las convenciones de `skill-ith-backend.md`
(archivos en inglés con guiones, comentarios en español, respuestas
`{ success, data }` / `{ success, error }`, tablas en español).

## Instalación

```bash
npm install
cp .env.example .env
# Completa SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY y JWT_SECRET en .env
npm run dev
```

El servidor arranca en `http://localhost:4000` (o el `PORT` que definas).
Verifica que está vivo con `GET /api/health`.

## ⚠️ Acción requerida antes de probar: ajuste al schema.sql

El módulo de autenticación bloquea sesiones simultáneas en distintas cajas
(HU-U02 Escenario 3) usando una columna que **no existe** en el `schema.sql`
original. Ejecuta esto en Supabase antes de probar login:

```sql
ALTER TABLE usuarios ADD COLUMN caja_activa_id INTEGER REFERENCES cajas(id);
```

Sin esta columna, todo intento de login fallará con un error de Supabase.

## Módulos implementados

| Módulo | Archivos | Tareas de tasks.md cubiertas |
|---|---|---|
| Productos | `src/modules/products/` | T-PROD-01 a 09, T-INV-01 a 06 |
| Usuarios | `src/modules/users/` | T-USR-01 a 04 |
| Autenticación | `src/modules/auth/` | T-AUTH-01, 02, 03, 04, 06 |
| Ventas | `src/modules/sales/` | T-VEN-01 a 13 |
| Corte de caja | `src/modules/cash-shifts/` | T-COR-01 a 08 |

## Módulos pendientes (no incluidos en este entregable)

- **Reportes** (T-REP-01 a 03): reporte de ventas del día, comparativa por
  caja, exportación a PDF. No implementado todavía.
- **Seguridad transversal** (T-SEC-01 a 03): log de auditoría dedicado (hoy
  solo se audita vía `historial_precios` y `movimientos_inventario`, no hay
  tabla de auditoría genérica para intentos de acceso no autorizado),
  forzado de HTTPS en producción, y rate limiting en el endpoint de login.
- **Testing** (T-TEST-01 a 04): no se incluyó ninguna suite automatizada
  (Vitest/Supertest). Los cálculos de dinero y los 3 escenarios de
  HU-C02 fueron verificados manualmente durante el desarrollo, pero no
  quedaron como tests ejecutables en el repositorio.

## Limitaciones técnicas conocidas

### 1. No hay transacciones atómicas reales

Supabase JS (PostgREST) no soporta transacciones multi-tabla desde el
cliente. Las operaciones de `createSale` y `createReturn`
(`src/modules/sales/sale-service.js`) hacen varias escrituras secuenciales
(`detalle_venta`, `productos`, `movimientos_inventario`). Si una de esas
escrituras falla a mitad de camino (ej. corte de red), no hay rollback
automático y la base de datos puede quedar en un estado parcialmente
actualizado.

**Recomendación:** migrar esta lógica a una función RPC de PostgreSQL
(`plpgsql`) invocada vía `supabase.rpc(...)`, envuelta en una transacción
real con `BEGIN`/`COMMIT`/`ROLLBACK`.

### 2. Folios generados por conteo, no por secuencia SQL

`src/shared/utils/folio-generator.js` genera el siguiente folio contando
filas existentes (`COUNT(*) + 1`). Bajo alta concurrencia (dos ventas en la
misma caja en el mismo instante) existe una ventana teórica de condición de
carrera que podría generar folios duplicados. A la escala de 2–5 cajas de un
minisuper el riesgo es bajo, pero no es una garantía matemática.

**Recomendación:** usar una secuencia nativa de PostgreSQL (`SEQUENCE`) por
caja, o una constraint `UNIQUE` con reintento ante colisión.

### 3. RN-09 (no cerrar caja con venta en proceso) no tiene validación real

El sistema actual nunca persiste un "ticket en progreso": toda venta se crea
ya completa en una sola llamada a `POST /api/sales`. La función
`assertNoVentaEnProceso` en `cash-shift-service.js` existe como punto de
extensión documentado, pero hoy no tiene nada que verificar porque, por
diseño, nunca puede existir un ticket a medias en base de datos.

Si el frontend implementa guardado de tickets en curso (por ejemplo, para el
modo offline de 30 minutos descrito en `plan.md`), esta función deberá
actualizarse para consultar esa tabla.

### 4. Mecanismo de autorización de descuentos

HU-V02 Escenario 2 pide un "código de autorización" sin especificar el
mecanismo exacto. Se implementó como `usuario_id` + `password` de un
encargado/administrador, enviados en el body de la venta
(`req.body.autorizacion`), no como un PIN numérico corto. Si el frontend
espera un flujo de PIN de 4-6 dígitos, este mecanismo deberá ajustarse en
`src/modules/sales/sale-service.js` (función `validateAuthorizationCode`).

## Estructura de carpetas

```
backend/
├── src/
│   ├── app.js                  # Configuración de Express y registro de rutas
│   ├── server.js               # Punto de entrada
│   ├── config/
│   │   ├── supabase-client.js
│   │   └── constants.js
│   ├── middlewares/
│   │   ├── error-handler.js
│   │   ├── require-auth.js
│   │   └── require-role.js
│   ├── modules/
│   │   ├── products/
│   │   ├── users/
│   │   ├── auth/
│   │   ├── sales/
│   │   └── cash-shifts/
│   └── shared/
│       ├── errors/app-error.js
│       └── utils/
│           ├── folio-generator.js
│           └── money.js
├── package.json
├── .env.example
└── README.md
```

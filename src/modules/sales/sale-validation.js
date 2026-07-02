// Validaciones manuales para el módulo de ventas.
const METODOS_PAGO_VALIDOS = ['efectivo', 'tarjeta', 'mixto'];

// Valida el payload de una venta completa antes de procesarla (HU-V03).
function validateCreateSale(body) {
  const errors = [];

  if (!Array.isArray(body.items) || body.items.length === 0) {
    errors.push('La venta debe incluir al menos un artículo');
    return errors; // sin items no tiene caso seguir validando
  }

  body.items.forEach((item, index) => {
    if (!item.producto_id || typeof item.producto_id !== 'number') {
      errors.push(`El artículo en la posición ${index} no tiene un producto_id válido`);
    }
    if (!item.cantidad || typeof item.cantidad !== 'number' || item.cantidad <= 0) {
      errors.push(`El artículo en la posición ${index} debe tener una cantidad mayor a 0`);
    }
    if (item.descuento_pct !== undefined && item.descuento_pct !== null) {
      if (typeof item.descuento_pct !== 'number' || item.descuento_pct < 0 || item.descuento_pct > 100) {
        errors.push(`El descuento porcentual del artículo en la posición ${index} debe estar entre 0 y 100`);
      }
    }
    if (item.descuento_monto !== undefined && item.descuento_monto !== null) {
      if (typeof item.descuento_monto !== 'number' || item.descuento_monto < 0) {
        errors.push(`El descuento en monto del artículo en la posición ${index} debe ser mayor o igual a 0`);
      }
    }
  });

  if (!body.metodo_pago || !METODOS_PAGO_VALIDOS.includes(body.metodo_pago)) {
    errors.push(`El método de pago debe ser uno de: ${METODOS_PAGO_VALIDOS.join(', ')}`);
  }

  if (!body.caja_id || typeof body.caja_id !== 'number') {
    errors.push('El campo caja_id es obligatorio');
  }

  const montoEfectivo = body.monto_efectivo ?? 0;
  const montoTarjeta = body.monto_tarjeta ?? 0;

  if (typeof montoEfectivo !== 'number' || montoEfectivo < 0) {
    errors.push('El campo monto_efectivo debe ser un número mayor o igual a 0');
  }
  if (typeof montoTarjeta !== 'number' || montoTarjeta < 0) {
    errors.push('El campo monto_tarjeta debe ser un número mayor o igual a 0');
  }

  if (body.metodo_pago === 'efectivo' && montoEfectivo <= 0) {
    errors.push('Debes indicar el monto en efectivo recibido');
  }
  if (body.metodo_pago === 'tarjeta' && montoTarjeta <= 0) {
    errors.push('Debes indicar el monto pagado con tarjeta');
  }
  if (body.metodo_pago === 'mixto' && montoEfectivo <= 0 && montoTarjeta <= 0) {
    errors.push('Para pago mixto debes indicar al menos un monto en efectivo o tarjeta');
  }

  return errors;
}

// Valida el payload de devolución (HU-V04).
function validateReturn(body) {
  const errors = [];

  if (body.tipo && !['total', 'parcial'].includes(body.tipo)) {
    errors.push('El campo tipo debe ser "total" o "parcial"');
  }

  if (body.tipo === 'parcial') {
    if (!Array.isArray(body.detalle_venta_ids) || body.detalle_venta_ids.length === 0) {
      errors.push('Para una devolución parcial debes indicar las líneas (detalle_venta_ids) a devolver');
    }
  }

  return errors;
}

module.exports = { validateCreateSale, validateReturn, METODOS_PAGO_VALIDOS };

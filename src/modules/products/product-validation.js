// Validaciones manuales para el módulo de productos.
// No se usa ninguna librería externa de validación; cada función
// retorna un mensaje de error (string) o null si el valor es válido.

const MOTIVOS_AJUSTE_VALIDOS = [
  'Merma',
  'Robo',
  'Error de conteo',
  'Entrada manual',
  'Otro',
];

// Valida el payload para crear un producto nuevo (HU-P01).
function validateCreateProduct(body) {
  const errors = [];

  if (!body.codigo_barras || typeof body.codigo_barras !== 'string' || !body.codigo_barras.trim()) {
    errors.push('El campo codigo_barras es obligatorio');
  }

  if (!body.nombre || typeof body.nombre !== 'string' || !body.nombre.trim()) {
    errors.push('El campo nombre es obligatorio');
  }

  if (body.precio_venta === undefined || body.precio_venta === null || body.precio_venta === '') {
    errors.push('El campo precio_venta es obligatorio');
  } else if (typeof body.precio_venta !== 'number' || Number.isNaN(body.precio_venta)) {
    errors.push('El campo precio_venta debe ser un número');
  } else if (body.precio_venta <= 0) {
    // RN-01: el precio de venta nunca puede ser $0.00 ni negativo
    errors.push('El precio debe ser mayor a $0.00');
  }

  if (!body.categoria_id || typeof body.categoria_id !== 'number') {
    errors.push('El campo categoria_id es obligatorio');
  }

  if (body.stock_actual !== undefined && body.stock_actual !== null) {
    if (typeof body.stock_actual !== 'number' || body.stock_actual < 0) {
      errors.push('El campo stock_actual debe ser un número mayor o igual a 0');
    }
  }

  if (body.stock_minimo !== undefined && body.stock_minimo !== null) {
    if (typeof body.stock_minimo !== 'number' || body.stock_minimo < 0) {
      errors.push('El campo stock_minimo debe ser un número mayor o igual a 0');
    }
  }

  if (body.precio_costo !== undefined && body.precio_costo !== null) {
    if (typeof body.precio_costo !== 'number' || body.precio_costo < 0) {
      errors.push('El campo precio_costo debe ser un número mayor o igual a 0');
    }
  }

  return errors;
}

// Valida el payload para actualizar el precio de un producto (HU-P02).
function validateUpdatePrice(body) {
  const errors = [];

  if (body.precio_venta === undefined || body.precio_venta === null || body.precio_venta === '') {
    errors.push('El campo precio_venta es obligatorio');
  } else if (typeof body.precio_venta !== 'number' || Number.isNaN(body.precio_venta)) {
    errors.push('El campo precio_venta debe ser un número');
  } else if (body.precio_venta <= 0) {
    // RN-01
    errors.push('El precio debe ser mayor a $0.00');
  }

  return errors;
}

// Valida el payload para una entrada de mercancía (HU-I01).
function validateStockEntry(body) {
  const errors = [];

  if (!body.producto_id || typeof body.producto_id !== 'number') {
    errors.push('El campo producto_id es obligatorio');
  }

  if (body.cantidad === undefined || body.cantidad === null) {
    errors.push('El campo cantidad es obligatorio');
  } else if (typeof body.cantidad !== 'number' || body.cantidad <= 0) {
    // HU-I01 Escenario 3: la cantidad debe ser mayor a 0
    errors.push('La cantidad debe ser mayor a 0');
  }

  return errors;
}

// Valida el payload para un ajuste manual de inventario (HU-I03, RN-07).
function validateStockAdjustment(body) {
  const errors = [];

  if (!body.producto_id || typeof body.producto_id !== 'number') {
    errors.push('El campo producto_id es obligatorio');
  }

  if (body.cantidad === undefined || body.cantidad === null) {
    errors.push('El campo cantidad es obligatorio');
  } else if (typeof body.cantidad !== 'number' || body.cantidad === 0) {
    errors.push('El campo cantidad debe ser un número distinto de 0');
  }

  // RN-07: el motivo es obligatorio y debe pertenecer a la lista predefinida
  if (!body.motivo || typeof body.motivo !== 'string' || !body.motivo.trim()) {
    errors.push('El motivo del ajuste es obligatorio');
  } else if (!MOTIVOS_AJUSTE_VALIDOS.includes(body.motivo)) {
    errors.push(
      `El motivo debe ser uno de los siguientes: ${MOTIVOS_AJUSTE_VALIDOS.join(', ')}`
    );
  }

  return errors;
}

module.exports = {
  validateCreateProduct,
  validateUpdatePrice,
  validateStockEntry,
  validateStockAdjustment,
  MOTIVOS_AJUSTE_VALIDOS,
};

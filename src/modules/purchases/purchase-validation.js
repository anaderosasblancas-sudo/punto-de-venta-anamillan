// Validaciones manuales para el módulo de compras.

// Valida el payload para registrar una compra nueva.
function validateCreatePurchase(body) {
  const errors = [];

  if (!body.proveedor || typeof body.proveedor !== 'string' || !body.proveedor.trim()) {
    errors.push('El campo proveedor es obligatorio');
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    errors.push('La compra debe incluir al menos un artículo');
    return errors; // sin items no tiene caso seguir validando
  }

  body.items.forEach((item, index) => {
    if (!item.producto_id || typeof item.producto_id !== 'number') {
      errors.push(`El artículo en la posición ${index} no tiene un producto_id válido`);
    }
    if (!item.cantidad || typeof item.cantidad !== 'number' || item.cantidad <= 0) {
      errors.push(`El artículo en la posición ${index} debe tener una cantidad mayor a 0`);
    }
    if (
      item.costo_unitario === undefined ||
      item.costo_unitario === null ||
      typeof item.costo_unitario !== 'number' ||
      item.costo_unitario < 0
    ) {
      errors.push(`El artículo en la posición ${index} debe tener un costo_unitario válido`);
    }
  });

  return errors;
}

module.exports = { validateCreatePurchase };

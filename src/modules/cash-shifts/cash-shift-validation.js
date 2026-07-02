// Validaciones manuales para el módulo de corte de caja.

// Valida el payload de apertura de caja (HU-C01).
function validateOpenShift(body) {
  const errors = [];

  if (!body.caja_id || typeof body.caja_id !== 'number') {
    errors.push('El campo caja_id es obligatorio');
  }

  // HU-C01 Escenario 3: fondo_apertura en $0.00 es válido,
  // pero debe ser un número y no puede ser negativo.
  if (body.fondo_apertura === undefined || body.fondo_apertura === null) {
    errors.push('El campo fondo_apertura es obligatorio');
  } else if (typeof body.fondo_apertura !== 'number' || Number.isNaN(body.fondo_apertura)) {
    errors.push('El campo fondo_apertura debe ser un número');
  } else if (body.fondo_apertura < 0) {
    errors.push('El fondo de apertura no puede ser negativo');
  }

  return errors;
}

// Valida el payload de cierre de caja (HU-C02).
function validateCloseShift(body) {
  const errors = [];

  if (body.efectivo_contado === undefined || body.efectivo_contado === null) {
    errors.push('El campo efectivo_contado es obligatorio');
  } else if (typeof body.efectivo_contado !== 'number' || Number.isNaN(body.efectivo_contado)) {
    errors.push('El campo efectivo_contado debe ser un número');
  } else if (body.efectivo_contado < 0) {
    errors.push('El campo efectivo_contado no puede ser negativo');
  }

  return errors;
}

module.exports = { validateOpenShift, validateCloseShift };

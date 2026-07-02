// Validaciones manuales para el módulo de clientes.

// Valida el payload para crear/actualizar un cliente.
function validateClient(body) {
  const errors = [];

  if (!body.nombre || typeof body.nombre !== 'string' || !body.nombre.trim()) {
    errors.push('El campo nombre es obligatorio');
  }

  if (body.email !== undefined && body.email !== null && body.email !== '') {
    if (typeof body.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
      errors.push('El email no tiene un formato válido');
    }
  }

  if (body.telefono !== undefined && body.telefono !== null && body.telefono !== '') {
    if (typeof body.telefono !== 'string') {
      errors.push('El campo telefono debe ser texto');
    }
  }

  return errors;
}

module.exports = { validateClient };

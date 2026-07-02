// Validaciones manuales para el módulo de usuarios.
const ROLES_VALIDOS = ['administrador', 'encargado', 'cajero'];

// Valida el payload para crear un usuario nuevo (HU-U01 Escenario 1).
function validateCreateUser(body) {
  const errors = [];

  if (!body.nombre || typeof body.nombre !== 'string' || !body.nombre.trim()) {
    errors.push('El campo nombre es obligatorio');
  }

  if (!body.email || typeof body.email !== 'string' || !body.email.trim()) {
    errors.push('El campo email es obligatorio');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
    errors.push('El email no tiene un formato válido');
  }

  if (!body.password || typeof body.password !== 'string' || body.password.length < 8) {
    errors.push('La contraseña temporal debe tener al menos 8 caracteres');
  }

  if (!body.rol || !ROLES_VALIDOS.includes(body.rol)) {
    errors.push(`El campo rol debe ser uno de: ${ROLES_VALIDOS.join(', ')}`);
  }

  if (body.descuento_max_pct !== undefined && body.descuento_max_pct !== null) {
    if (
      typeof body.descuento_max_pct !== 'number' ||
      body.descuento_max_pct < 0 ||
      body.descuento_max_pct > 100
    ) {
      errors.push('El campo descuento_max_pct debe ser un número entre 0 y 100');
    }
  }

  return errors;
}

// Valida el payload de login (HU-U02).
function validateLogin(body) {
  const errors = [];

  if (!body.email || typeof body.email !== 'string' || !body.email.trim()) {
    errors.push('El campo email es obligatorio');
  }

  if (!body.password || typeof body.password !== 'string' || !body.password.trim()) {
    errors.push('El campo password es obligatorio');
  }

  if (!body.caja_id || typeof body.caja_id !== 'number') {
    errors.push('El campo caja_id es obligatorio');
  }

  return errors;
}

// Valida el payload de cambio de contraseña forzado (HU-U01 Escenario 1, continuación).
function validateChangePassword(body) {
  const errors = [];

  if (!body.password_nueva || typeof body.password_nueva !== 'string' || body.password_nueva.length < 8) {
    errors.push('La nueva contraseña debe tener al menos 8 caracteres');
  }

  return errors;
}

module.exports = {
  validateCreateUser,
  validateLogin,
  validateChangePassword,
  ROLES_VALIDOS,
};

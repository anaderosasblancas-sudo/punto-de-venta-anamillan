// Lógica de negocio del módulo de usuarios.
const bcrypt = require('bcrypt');
const supabase = require('../../config/supabase-client');
const AppError = require('../../shared/errors/app-error');

const BCRYPT_ROUNDS = 12; // §5.3: mínimo 12 rounds

// Crea un usuario nuevo con contraseña temporal hasheada (HU-U01 Escenario 1).
// Solo puede invocarse por un administrador (verificado en la ruta).
async function createUser({ nombre, email, password, rol, descuentoMaxPct }) {
  const { data: existing, error: lookupError } = await supabase
    .from('usuarios')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (lookupError) {
    throw new AppError('Error al verificar el correo electrónico', 500);
  }

  if (existing) {
    throw new AppError('Ya existe un usuario registrado con ese correo electrónico', 409);
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const { data, error } = await supabase
    .from('usuarios')
    .insert({
      nombre,
      email,
      password_hash: passwordHash,
      rol,
      descuento_max_pct: descuentoMaxPct ?? 0,
      activo: true,
      intentos_fallidos: 0,
      bloqueado_hasta: null,
      forzar_cambio_pwd: true,
    })
    .select('id, nombre, email, rol, descuento_max_pct, activo, forzar_cambio_pwd, creado_en')
    .single();

  if (error) {
    throw new AppError('No se pudo crear el usuario', 500);
  }

  return data;
}

// Obtiene un usuario por id, sin exponer password_hash.
async function getUserById(userId) {
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, nombre, email, rol, descuento_max_pct, activo, forzar_cambio_pwd, creado_en')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw new AppError('Error al consultar el usuario', 500);
  }

  if (!data) {
    throw new AppError('Usuario no encontrado', 404);
  }

  return data;
}

// Lista todos los usuarios sin exponer password_hash.
async function listUsers() {
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, nombre, email, rol, descuento_max_pct, activo, forzar_cambio_pwd, creado_en')
    .order('nombre', { ascending: true });

  if (error) {
    throw new AppError('Error al listar usuarios', 500);
  }

  return data;
}

// Actualiza campos generales del usuario (nunca password_hash desde aquí).
async function updateUser(userId, fields) {
  // Excluimos explícitamente campos sensibles que no deben tocarse por esta vía
  const {
    password_hash: _ph,
    intentos_fallidos: _if,
    bloqueado_hasta: _bh,
    ...allowedFields
  } = fields;

  await getUserById(userId);

  const { data, error } = await supabase
    .from('usuarios')
    .update(allowedFields)
    .eq('id', userId)
    .select('id, nombre, email, rol, descuento_max_pct, activo, forzar_cambio_pwd, creado_en')
    .single();

  if (error) {
    throw new AppError('No se pudo actualizar el usuario', 500);
  }

  return data;
}

// Desactiva un usuario, validando que no tenga una caja abierta (HU-U01 Escenario 3).
async function deactivateUser(userId) {
  await getUserById(userId);

  // Buscamos si el usuario tiene un corte de caja con estado "abierto"
  const { data: openShift, error: shiftError } = await supabase
    .from('cortes_caja')
    .select('id')
    .eq('usuario_id', userId)
    .eq('estado', 'abierto')
    .maybeSingle();

  if (shiftError) {
    throw new AppError('Error al verificar el estado de caja del usuario', 500);
  }

  if (openShift) {
    throw new AppError(
      'El usuario tiene una caja abierta. Cierre el turno antes de desactivar',
      400
    );
  }

  const { data, error } = await supabase
    .from('usuarios')
    .update({ activo: false })
    .eq('id', userId)
    .select('id, nombre, email, rol, activo')
    .single();

  if (error) {
    throw new AppError('No se pudo desactivar el usuario', 500);
  }

  return data;
}

// Cambia la contraseña del usuario y limpia el flag de cambio forzado.
async function changePassword(userId, newPassword) {
  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

  const { data, error } = await supabase
    .from('usuarios')
    .update({ password_hash: passwordHash, forzar_cambio_pwd: false })
    .eq('id', userId)
    .select('id, nombre, email, rol, forzar_cambio_pwd')
    .single();

  if (error) {
    throw new AppError('No se pudo actualizar la contraseña', 500);
  }

  return data;
}

module.exports = {
  createUser,
  getUserById,
  listUsers,
  updateUser,
  deactivateUser,
  changePassword,
};

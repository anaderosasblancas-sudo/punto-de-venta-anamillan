// Lógica de negocio de autenticación: login, logout, bloqueo por intentos
// fallidos y control de sesión única por caja.
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const supabase = require('../../config/supabase-client');
const AppError = require('../../shared/errors/app-error');
const { LOGIN_MAX_INTENTOS, LOGIN_BLOQUEO_MINUTOS, JWT_EXPIRATION_MINUTES } = require('../../config/constants');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

// Genera un JWT propio de la aplicación (no el de Supabase Auth), porque
// necesitamos incluir el rol y la caja activa en el payload.
function generateToken(usuario) {
  return jwt.sign(
    {
      id: usuario.id,
      email: usuario.email,
      rol: usuario.rol,
      caja_id: usuario.caja_activa_id,
      requiere_cambio_password: usuario.forzar_cambio_pwd,
    },
    JWT_SECRET,
    { expiresIn: `${JWT_EXPIRATION_MINUTES}m` }
  );
}

// Procesa el login: valida credenciales, bloqueo, sesión única por caja (HU-U02).
async function login({ email, password, cajaId }) {
  const { data: usuario, error } = await supabase
    .from('usuarios')
    .select('*')
    .eq('email', email)
    .maybeSingle();

  if (error) {
    throw new AppError('Error al consultar el usuario', 500);
  }

  if (!usuario) {
    // No revelamos si el email existe o no, por seguridad
    throw new AppError('Credenciales inválidas', 401);
  }

  if (!usuario.activo) {
    throw new AppError('Esta cuenta de usuario está desactivada', 401);
  }

  // Verificamos si la cuenta está bloqueada por intentos fallidos (HU-U02 Escenario 2)
  if (usuario.bloqueado_hasta) {
    const bloqueadoHasta = new Date(usuario.bloqueado_hasta);
    if (bloqueadoHasta > new Date()) {
      throw new AppError(
        `Cuenta bloqueada temporalmente. Intenta de nuevo después de ${bloqueadoHasta.toLocaleTimeString()}`,
        423
      );
    }
  }

  const passwordValida = await bcrypt.compare(password, usuario.password_hash);

  if (!passwordValida) {
    const nuevosIntentos = (usuario.intentos_fallidos || 0) + 1;
    const updateData = { intentos_fallidos: nuevosIntentos };

    if (nuevosIntentos >= LOGIN_MAX_INTENTOS) {
      const bloqueadoHasta = new Date();
      bloqueadoHasta.setMinutes(bloqueadoHasta.getMinutes() + LOGIN_BLOQUEO_MINUTOS);
      updateData.bloqueado_hasta = bloqueadoHasta.toISOString();
    }

    await supabase.from('usuarios').update(updateData).eq('id', usuario.id);

    if (nuevosIntentos >= LOGIN_MAX_INTENTOS) {
      throw new AppError(
        `Cuenta bloqueada por ${LOGIN_BLOQUEO_MINUTOS} minutos tras demasiados intentos fallidos`,
        423
      );
    }

    throw new AppError('Credenciales inválidas', 401);
  }

  // Verificamos sesión activa en otra caja (HU-U02 Escenario 3)
  if (usuario.caja_activa_id && usuario.caja_activa_id !== cajaId) {
    const { data: cajaActiva } = await supabase
      .from('cajas')
      .select('numero')
      .eq('id', usuario.caja_activa_id)
      .maybeSingle();

    throw new AppError(
      `Ya tienes una sesión activa en ${cajaActiva ? cajaActiva.numero : 'otra caja'}`,
      409
    );
  }

  // Login exitoso: reseteamos intentos fallidos y registramos la caja activa
  const { data: usuarioActualizado, error: updateError } = await supabase
    .from('usuarios')
    .update({
      intentos_fallidos: 0,
      bloqueado_hasta: null,
      caja_activa_id: cajaId,
    })
    .eq('id', usuario.id)
    .select('*')
    .single();

  if (updateError) {
    throw new AppError('No se pudo iniciar sesión', 500);
  }

  const token = generateToken(usuarioActualizado);

  return {
    token,
    usuario: {
      id: usuarioActualizado.id,
      nombre: usuarioActualizado.nombre,
      email: usuarioActualizado.email,
      rol: usuarioActualizado.rol,
      requiere_cambio_password: usuarioActualizado.forzar_cambio_pwd,
    },
  };
}

// Cierra la sesión del usuario, liberando la caja activa.
async function logout(userId) {
  const { error } = await supabase
    .from('usuarios')
    .update({ caja_activa_id: null })
    .eq('id', userId);

  if (error) {
    throw new AppError('No se pudo cerrar la sesión', 500);
  }
}

module.exports = {
  login,
  logout,
  generateToken,
  JWT_SECRET,
};

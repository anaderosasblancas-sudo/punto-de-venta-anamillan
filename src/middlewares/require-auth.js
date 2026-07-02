// Middleware de autenticación: verifica el JWT propio de la aplicación
// (emitido por auth-service.js) y adjunta los datos del usuario a req.user.
const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase-client');
const AppError = require('../shared/errors/app-error');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('No se proporcionó un token de autenticación', 401);
    }

    const token = authHeader.split(' ')[1];

    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        throw new AppError('La sesión ha expirado, vuelve a iniciar sesión', 401);
      }
      throw new AppError('Token inválido', 401);
    }

    // Confirmamos que el usuario siga existiendo y activo
    // (cubre el caso de un usuario desactivado con un token aún vigente).
    const { data: usuario, error: usuarioError } = await supabase
      .from('usuarios')
      .select('id, nombre, email, rol, descuento_max_pct, activo, forzar_cambio_pwd, caja_activa_id')
      .eq('id', payload.id)
      .maybeSingle();

    if (usuarioError || !usuario) {
      throw new AppError('Usuario no encontrado en el sistema', 401);
    }

    if (!usuario.activo) {
      throw new AppError('Esta cuenta de usuario está desactivada', 401);
    }

    // Si la cuenta requiere cambio de contraseña, solo se permite el acceso
    // al endpoint de cambio de contraseña (HU-U01, continuación del Escenario 1).
    // Usamos originalUrl (no req.path) porque es absoluto sin importar en qué
    // router esté montado este middleware.
    const esRutaCambioPassword = req.originalUrl.startsWith('/api/auth/change-password');
    if (usuario.forzar_cambio_pwd && !esRutaCambioPassword) {
      throw new AppError('Debes cambiar tu contraseña antes de continuar', 403);
    }

    req.user = usuario;
    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = requireAuth;

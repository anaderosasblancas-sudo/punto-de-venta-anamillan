// Middleware de control de acceso basado en roles (RBAC, §5.3).
// Uso: requireRole(['administrador']) o requireRole(['administrador', 'encargado'])
const AppError = require('../shared/errors/app-error');

function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      // Esto no debería ocurrir si requireAuth se ejecuta antes,
      // pero protegemos por si el orden de middlewares cambia.
      return next(new AppError('No se proporcionó un token de autenticación', 401));
    }

    if (!allowedRoles.includes(req.user.rol)) {
      return next(new AppError('No tienes permisos para realizar esta acción', 403));
    }

    return next();
  };
}

module.exports = requireRole;

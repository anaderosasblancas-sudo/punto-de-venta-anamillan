// Middleware global de manejo de errores.
// Estandariza todas las respuestas de error en { success: false, error: "..." }
// y nunca expone detalles internos (stack traces) al cliente.
const AppError = require('../shared/errors/app-error');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Errores controlados por la aplicación (AppError)
  if (err instanceof AppError || err.isAppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
    });
  }

  // Errores no controlados: se registran en consola pero no se exponen
  console.error('Error no controlado:', err);
  return res.status(500).json({
    success: false,
    error: 'Ocurrió un error interno en el servidor',
  });
}

module.exports = errorHandler;

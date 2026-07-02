// Error de aplicación con código HTTP y mensaje descriptivo.
// Se usa en los services y se captura en el errorHandler global.
class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isAppError = true;
  }
}

module.exports = AppError;

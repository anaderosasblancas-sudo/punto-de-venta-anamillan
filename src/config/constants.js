// Constantes de negocio leídas desde variables de entorno, con valores
// por defecto razonables si no están definidas (no se debe asumir .env completo en tests).
module.exports = {
  LOGIN_MAX_INTENTOS: Number(process.env.LOGIN_MAX_INTENTOS) || 3,
  LOGIN_BLOQUEO_MINUTOS: Number(process.env.LOGIN_BLOQUEO_MINUTOS) || 10,
  DESCUENTO_MAX_DEFAULT_PCT: Number(process.env.DESCUENTO_MAX_DEFAULT_PCT) || 0,
  JWT_EXPIRATION_MINUTES: Number(process.env.JWT_EXPIRATION_MINUTES) || 30,
};

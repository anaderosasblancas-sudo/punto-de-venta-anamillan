// Controller del módulo de autenticación.
const authService = require('./auth-service');
const userService = require('../users/user-service');
const { validateLogin, validateChangePassword } = require('../users/user-validation');
const AppError = require('../../shared/errors/app-error');

// POST /api/auth/login
async function login(req, res, next) {
  try {
    const errors = validateLogin(req.body);
    if (errors.length > 0) {
      throw new AppError(errors.join('. '), 400);
    }

    const result = await authService.login({
      email: req.body.email,
      password: req.body.password,
      cajaId: req.body.caja_id,
    });

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
}

// POST /api/auth/logout
async function logout(req, res, next) {
  try {
    await authService.logout(req.user.id);
    return res.status(200).json({ success: true, data: { message: 'Sesión cerrada' } });
  } catch (error) {
    return next(error);
  }
}

// POST /api/auth/change-password
async function changePassword(req, res, next) {
  try {
    const errors = validateChangePassword(req.body);
    if (errors.length > 0) {
      throw new AppError(errors.join('. '), 400);
    }

    const updated = await userService.changePassword(req.user.id, req.body.password_nueva);
    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    return next(error);
  }
}

module.exports = { login, logout, changePassword };

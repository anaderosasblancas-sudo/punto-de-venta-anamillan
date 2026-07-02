// Controller del módulo de usuarios.
const userService = require('./user-service');
const { validateCreateUser } = require('./user-validation');
const AppError = require('../../shared/errors/app-error');

// POST /api/users
async function createUser(req, res, next) {
  try {
    const errors = validateCreateUser(req.body);
    if (errors.length > 0) {
      throw new AppError(errors.join('. '), 400);
    }

    const user = await userService.createUser({
      nombre: req.body.nombre,
      email: req.body.email,
      password: req.body.password,
      rol: req.body.rol,
      descuentoMaxPct: req.body.descuento_max_pct,
    });

    return res.status(201).json({ success: true, data: user });
  } catch (error) {
    return next(error);
  }
}

// GET /api/users
async function listUsers(req, res, next) {
  try {
    const users = await userService.listUsers();
    return res.status(200).json({ success: true, data: users });
  } catch (error) {
    return next(error);
  }
}

// GET /api/users/:id
async function getUserById(req, res, next) {
  try {
    const userId = Number(req.params.id);
    const user = await userService.getUserById(userId);
    return res.status(200).json({ success: true, data: user });
  } catch (error) {
    return next(error);
  }
}

// PATCH /api/users/:id
async function updateUser(req, res, next) {
  try {
    const userId = Number(req.params.id);
    const updated = await userService.updateUser(userId, req.body);
    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    return next(error);
  }
}

// PATCH /api/users/:id/deactivate
async function deactivateUser(req, res, next) {
  try {
    const userId = Number(req.params.id);
    const user = await userService.deactivateUser(userId);
    return res.status(200).json({ success: true, data: user });
  } catch (error) {
    return next(error);
  }
}

module.exports = { createUser, listUsers, getUserById, updateUser, deactivateUser };

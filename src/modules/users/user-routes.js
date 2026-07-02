// Rutas del módulo de usuarios.
// Toda la gestión de usuarios está restringida al rol administrador (HU-U01).
const express = require('express');
const userController = require('./user-controller');
const requireAuth = require('../../middlewares/require-auth');
const requireRole = require('../../middlewares/require-role');

const router = express.Router();

router.use(requireAuth);
router.use(requireRole(['administrador']));

router.post('/', userController.createUser);
router.get('/', userController.listUsers);
router.get('/:id', userController.getUserById);
router.patch('/:id', userController.updateUser);
router.patch('/:id/deactivate', userController.deactivateUser);

module.exports = router;

// Rutas del módulo de autenticación.
const express = require('express');
const authController = require('./auth-controller');
const requireAuth = require('../../middlewares/require-auth');

const router = express.Router();

// Login y logout no requieren sesión previa (excepto logout, que sí)
router.post('/login', authController.login);
router.post('/logout', requireAuth, authController.logout);

// Cambio de contraseña forzado requiere sesión, pero requireAuth permite
// el paso aunque forzar_cambio_pwd sea true solo para esta ruta exacta.
router.post('/change-password', requireAuth, authController.changePassword);

module.exports = router;

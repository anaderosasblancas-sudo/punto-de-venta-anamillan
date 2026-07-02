// Rutas del módulo de clientes.
const express = require('express');
const clientController = require('./client-controller');
const requireAuth = require('../../middlewares/require-auth');
const requireRole = require('../../middlewares/require-role');

const router = express.Router();

// Todas las rutas de clientes requieren sesión activa
router.use(requireAuth);

// Listado y consulta individual — disponible para todos los roles (se usa al elegir cliente en una venta)
router.get('/', clientController.listClients);
router.get('/:id', clientController.getClientById);

// Alta y edición — restringido a encargado y administrador
router.post('/', requireRole(['encargado', 'administrador']), clientController.createClient);
router.patch('/:id', requireRole(['encargado', 'administrador']), clientController.updateClient);

module.exports = router;

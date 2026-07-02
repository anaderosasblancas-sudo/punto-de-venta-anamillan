// Controller del módulo de clientes.
const clientService = require('./client-service');
const { validateClient } = require('./client-validation');
const AppError = require('../../shared/errors/app-error');

// GET /api/clients
async function listClients(req, res, next) {
  try {
    const clients = await clientService.listClients(req.query.nombre);
    return res.status(200).json({ success: true, data: clients });
  } catch (error) {
    return next(error);
  }
}

// GET /api/clients/:id
async function getClientById(req, res, next) {
  try {
    const clientId = Number(req.params.id);
    const client = await clientService.getClientById(clientId);
    return res.status(200).json({ success: true, data: client });
  } catch (error) {
    return next(error);
  }
}

// POST /api/clients
async function createClient(req, res, next) {
  try {
    const errors = validateClient(req.body);
    if (errors.length > 0) {
      throw new AppError(errors.join('. '), 400);
    }

    const client = await clientService.createClient(req.body);
    return res.status(201).json({ success: true, data: client });
  } catch (error) {
    return next(error);
  }
}

// PATCH /api/clients/:id
async function updateClient(req, res, next) {
  try {
    const errors = validateClient(req.body);
    if (errors.length > 0) {
      throw new AppError(errors.join('. '), 400);
    }

    const clientId = Number(req.params.id);
    const client = await clientService.updateClient(clientId, req.body);
    return res.status(200).json({ success: true, data: client });
  } catch (error) {
    return next(error);
  }
}

module.exports = { listClients, getClientById, createClient, updateClient };

// Lógica de negocio del módulo de clientes.
const supabase = require('../../config/supabase-client');
const AppError = require('../../shared/errors/app-error');

// Lista clientes, con filtro opcional por nombre.
async function listClients(nombre) {
  let query = supabase.from('clientes').select('*');

  if (nombre) {
    query = query.ilike('nombre', `%${nombre}%`);
  }

  const { data, error } = await query.order('nombre', { ascending: true });

  if (error) {
    throw new AppError('Error al listar clientes', 500);
  }

  return data;
}

// Obtiene un cliente por id. Lanza 404 si no existe.
async function getClientById(clientId) {
  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .eq('id', clientId)
    .maybeSingle();

  if (error) {
    throw new AppError('Error al consultar el cliente', 500);
  }

  if (!data) {
    throw new AppError('Cliente no encontrado', 404);
  }

  return data;
}

// Crea un cliente nuevo.
async function createClient(clientData) {
  const { data, error } = await supabase
    .from('clientes')
    .insert({
      nombre: clientData.nombre,
      telefono: clientData.telefono || null,
      email: clientData.email || null,
    })
    .select()
    .single();

  if (error) {
    throw new AppError('No se pudo crear el cliente', 500);
  }

  return data;
}

// Actualiza los datos de un cliente existente.
async function updateClient(clientId, fields) {
  await getClientById(clientId);

  const { data, error } = await supabase
    .from('clientes')
    .update({
      nombre: fields.nombre,
      telefono: fields.telefono || null,
      email: fields.email || null,
    })
    .eq('id', clientId)
    .select()
    .single();

  if (error) {
    throw new AppError('No se pudo actualizar el cliente', 500);
  }

  return data;
}

module.exports = {
  listClients,
  getClientById,
  createClient,
  updateClient,
};

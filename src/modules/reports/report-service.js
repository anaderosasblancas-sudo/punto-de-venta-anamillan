// Lógica de negocio del módulo de reportes.
// Todas las consultas son de solo lectura; no modifican datos.
const supabase = require('../../config/supabase-client');
const AppError = require('../../shared/errors/app-error');

// Resumen de ventas por caja y día (HU-R01), basado en la vista v_resumen_ventas_dia.
async function getSalesSummary({ desde, hasta } = {}) {
  let query = supabase.from('v_resumen_ventas_dia').select('*');

  if (desde) {
    query = query.gte('fecha', desde);
  }
  if (hasta) {
    query = query.lte('fecha', hasta);
  }

  const { data, error } = await query.order('fecha', { ascending: false });

  if (error) {
    throw new AppError('Error al consultar el resumen de ventas', 500);
  }

  return data;
}

// Historial de ventas detallado, con filtros opcionales.
async function getSalesDetail({ desde, hasta, cajaId, usuarioId } = {}) {
  let query = supabase
    .from('ventas')
    .select('id, folio, subtotal, descuento_total, total, estado, creado_en, cajas(numero), usuarios(nombre)');

  if (desde) {
    query = query.gte('creado_en', desde);
  }
  if (hasta) {
    query = query.lte('creado_en', hasta);
  }
  if (cajaId) {
    query = query.eq('caja_id', cajaId);
  }
  if (usuarioId) {
    query = query.eq('usuario_id', usuarioId);
  }

  const { data, error } = await query.order('creado_en', { ascending: false });

  if (error) {
    throw new AppError('Error al consultar el historial de ventas', 500);
  }

  return data.map((venta) => ({
    id: venta.id,
    folio: venta.folio,
    subtotal: venta.subtotal,
    descuento_total: venta.descuento_total,
    total: venta.total,
    estado: venta.estado,
    creado_en: venta.creado_en,
    caja: venta.cajas ? venta.cajas.numero : null,
    cajero: venta.usuarios ? venta.usuarios.nombre : null,
  }));
}

// Bitácora de movimientos de inventario, con filtros opcionales.
async function getInventoryMovements({ desde, hasta, tipo, productoId } = {}) {
  let query = supabase
    .from('movimientos_inventario')
    .select('id, tipo, cantidad, stock_antes, stock_despues, motivo, creado_en, productos(nombre), usuarios(nombre)');

  if (desde) {
    query = query.gte('creado_en', desde);
  }
  if (hasta) {
    query = query.lte('creado_en', hasta);
  }
  if (tipo) {
    query = query.eq('tipo', tipo);
  }
  if (productoId) {
    query = query.eq('producto_id', productoId);
  }

  const { data, error } = await query.order('creado_en', { ascending: false });

  if (error) {
    throw new AppError('Error al consultar los movimientos de inventario', 500);
  }

  return data.map((mov) => ({
    id: mov.id,
    tipo: mov.tipo,
    cantidad: mov.cantidad,
    stock_antes: mov.stock_antes,
    stock_despues: mov.stock_despues,
    motivo: mov.motivo,
    creado_en: mov.creado_en,
    producto: mov.productos ? mov.productos.nombre : null,
    usuario: mov.usuarios ? mov.usuarios.nombre : null,
  }));
}

module.exports = {
  getSalesSummary,
  getSalesDetail,
  getInventoryMovements,
};

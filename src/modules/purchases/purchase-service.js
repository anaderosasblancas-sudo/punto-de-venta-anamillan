// Lógica de negocio del módulo de compras.
// Registrar una compra incrementa el stock de cada producto y deja rastro
// en movimientos_inventario, igual que una venta lo decrementa.
const supabase = require('../../config/supabase-client');
const AppError = require('../../shared/errors/app-error');
const productService = require('../products/product-service');
const { generatePurchaseFolio } = require('../../shared/utils/folio-generator');
const { round2 } = require('../../shared/utils/money');

// Procesa una compra completa: calcula totales, incrementa stock y registra
// los movimientos de inventario correspondientes.
async function createPurchase({ proveedor, items, usuario }) {
  const lineItems = [];
  for (const item of items) {
    // eslint-disable-next-line no-await-in-loop
    const product = await productService.getProductById(item.producto_id);
    const subtotal = round2(item.costo_unitario * item.cantidad);
    lineItems.push({
      producto_id: product.id,
      nombre: product.nombre,
      cantidad: item.cantidad,
      costo_unitario: item.costo_unitario,
      subtotal,
    });
  }

  const total = round2(lineItems.reduce((acc, l) => acc + l.subtotal, 0));
  const folio = await generatePurchaseFolio();

  const { data: compra, error: compraError } = await supabase
    .from('compras')
    .insert({
      folio,
      proveedor,
      usuario_id: usuario.id,
      total,
    })
    .select()
    .single();

  if (compraError) {
    throw new AppError('No se pudo registrar la compra', 500);
  }

  for (const line of lineItems) {
    // eslint-disable-next-line no-await-in-loop
    const { error: detalleError } = await supabase.from('detalle_compra').insert({
      compra_id: compra.id,
      producto_id: line.producto_id,
      cantidad: line.cantidad,
      costo_unitario: line.costo_unitario,
      subtotal: line.subtotal,
    });

    if (detalleError) {
      throw new AppError('No se pudo registrar el detalle de la compra', 500);
    }

    // eslint-disable-next-line no-await-in-loop
    const product = await productService.getProductById(line.producto_id);
    const stockAntes = product.stock_actual;
    const stockDespues = stockAntes + line.cantidad;

    // eslint-disable-next-line no-await-in-loop
    const { error: stockError } = await supabase
      .from('productos')
      .update({ stock_actual: stockDespues })
      .eq('id', line.producto_id);

    if (stockError) {
      throw new AppError('No se pudo actualizar el inventario tras la compra', 500);
    }

    // eslint-disable-next-line no-await-in-loop
    await supabase.from('movimientos_inventario').insert({
      producto_id: line.producto_id,
      usuario_id: usuario.id,
      tipo: 'entrada',
      cantidad: line.cantidad,
      stock_antes: stockAntes,
      stock_despues: stockDespues,
      motivo: `Compra ${folio} — Proveedor: ${proveedor}`,
    });
  }

  return { ...compra, items: lineItems };
}

// Lista compras con filtro opcional por rango de fechas.
async function listPurchases({ desde, hasta } = {}) {
  let query = supabase.from('compras').select('*, usuarios(nombre)');

  if (desde) {
    query = query.gte('creado_en', desde);
  }
  if (hasta) {
    query = query.lte('creado_en', hasta);
  }

  const { data, error } = await query.order('creado_en', { ascending: false });

  if (error) {
    throw new AppError('Error al listar compras', 500);
  }

  return data.map((compra) => ({
    ...compra,
    usuario: compra.usuarios ? compra.usuarios.nombre : null,
    usuarios: undefined,
  }));
}

// Obtiene una compra completa por id, incluyendo sus líneas de detalle.
async function getPurchaseById(purchaseId) {
  const { data: compra, error } = await supabase
    .from('compras')
    .select('*, usuarios(nombre)')
    .eq('id', purchaseId)
    .maybeSingle();

  if (error) {
    throw new AppError('Error al consultar la compra', 500);
  }

  if (!compra) {
    throw new AppError('Compra no encontrada', 404);
  }

  const { data: detalle, error: detalleError } = await supabase
    .from('detalle_compra')
    .select('*, productos(nombre)')
    .eq('compra_id', compra.id);

  if (detalleError) {
    throw new AppError('Error al consultar el detalle de la compra', 500);
  }

  return {
    ...compra,
    usuario: compra.usuarios ? compra.usuarios.nombre : null,
    usuarios: undefined,
    items: detalle.map((d) => ({
      id: d.id,
      producto_id: d.producto_id,
      nombre: d.productos ? d.productos.nombre : null,
      cantidad: d.cantidad,
      costo_unitario: d.costo_unitario,
      subtotal: d.subtotal,
    })),
  };
}

module.exports = {
  createPurchase,
  listPurchases,
  getPurchaseById,
};

// Lógica de negocio del módulo de ventas.
// El cálculo de totales, cambio y descuento de stock SIEMPRE se hace en el
// backend, nunca confiando en valores enviados por el cliente.
const bcrypt = require('bcrypt');
const supabase = require('../../config/supabase-client');
const AppError = require('../../shared/errors/app-error');
const productService = require('../products/product-service');
const { generateSaleFolio } = require('../../shared/utils/folio-generator');
const { round2 } = require('../../shared/utils/money');

// Verifica que la caja tenga un turno abierto (RN-08).
// Lanza error si no hay corte abierto para esa caja.
async function assertCajaAbierta(cajaId) {
  const { data: corte, error } = await supabase
    .from('cortes_caja')
    .select('id, estado')
    .eq('caja_id', cajaId)
    .eq('estado', 'abierto')
    .maybeSingle();

  if (error) {
    throw new AppError('Error al verificar el estado de la caja', 500);
  }

  if (!corte) {
    throw new AppError('La caja no tiene un turno abierto. Realiza la apertura primero', 400);
  }

  return corte;
}

// Calcula el detalle de una línea de venta (subtotal con descuento aplicado),
// validando el producto y el stock disponible.
async function buildSaleLineItem(item, usuarioDescuentoMaxPct, autorizadoPor) {
  const product = await productService.getProductById(item.producto_id);

  if (product.estado === 'inactivo') {
    // HU-P03 Escenario 2
    throw new AppError(`El producto "${product.nombre}" no está disponible para venta`, 400);
  }

  if (item.cantidad > product.stock_actual) {
    // HU-V01 Escenario 4 (stock insuficiente)
    throw new AppError(
      `Stock insuficiente para "${product.nombre}". Disponible: ${product.stock_actual} unidades`,
      400
    );
  }

  const descuentoPct = item.descuento_pct || 0;
  const descuentoMontoSolicitado = item.descuento_monto || 0;

  // RN-03: el descuento del cajero está limitado a su porcentaje autorizado,
  // salvo que venga un código de autorización válido de un superior.
  if (descuentoPct > usuarioDescuentoMaxPct && !autorizadoPor) {
    throw new AppError(
      `El descuento de ${descuentoPct}% supera tu límite autorizado (${usuarioDescuentoMaxPct}%). Solicita autorización`,
      403
    );
  }

  const precioBase = round2(product.precio_venta * item.cantidad);
  // Si viene descuento_pct, es la fuente de verdad y el service la recalcula;
  // cualquier descuento_monto que mande el cliente junto con el porcentaje se
  // ignora (nunca se combinan). Sin porcentaje, se usa el monto fijo tal cual.
  const descuentoTotal = descuentoPct > 0
    ? round2(precioBase * (descuentoPct / 100))
    : round2(descuentoMontoSolicitado);

  if (descuentoTotal > precioBase) {
    // HU-V02 Escenario 3: el descuento no puede dejar el precio en negativo
    throw new AppError(
      `El descuento aplicado a "${product.nombre}" excede el precio del artículo`,
      400
    );
  }

  const subtotal = round2(precioBase - descuentoTotal);

  return {
    producto_id: product.id,
    nombre: product.nombre,
    cantidad: item.cantidad,
    precio_unitario: product.precio_venta,
    descuento_pct: descuentoPct,
    descuento_monto: descuentoTotal,
    subtotal,
  };
}

// Valida un código de autorización de descuento (encargado/administrador).
// El "código" en este sistema es el id + password del usuario autorizante.
async function validateAuthorizationCode({ usuarioId, password }) {
  if (!usuarioId || !password) {
    return null;
  }

  const { data: autorizante, error } = await supabase
    .from('usuarios')
    .select('id, rol, password_hash, activo')
    .eq('id', usuarioId)
    .maybeSingle();

  if (error || !autorizante || !autorizante.activo) {
    throw new AppError('Código de autorización inválido', 401);
  }

  if (!['encargado', 'administrador'].includes(autorizante.rol)) {
    throw new AppError('El usuario indicado no tiene permisos para autorizar descuentos', 401);
  }

  const passwordValida = await bcrypt.compare(password, autorizante.password_hash);
  if (!passwordValida) {
    throw new AppError('Código de autorización inválido', 401);
  }

  return autorizante.id;
}

// Procesa una venta completa: valida líneas, calcula totales, verifica el
// monto recibido, descuenta stock y registra movimientos de inventario.
async function createSale({ items, metodoPago, montoEfectivo, montoTarjeta, cajaId, usuario, autorizacion }) {
  await assertCajaAbierta(cajaId);

  let autorizadoPor = null;
  if (autorizacion) {
    autorizadoPor = await validateAuthorizationCode(autorizacion);
  }

  // Construimos cada línea, validando stock y descuentos antes de tocar la BD.
  const lineItems = [];
  for (const item of items) {
    // Se procesa secuencialmente para validar stock de forma consistente
    // si hay productos repetidos en el ticket.
    // eslint-disable-next-line no-await-in-loop
    const line = await buildSaleLineItem(item, usuario.descuento_max_pct || 0, autorizadoPor);
    lineItems.push(line);
  }

  const subtotal = round2(lineItems.reduce((acc, l) => acc + l.precio_unitario * l.cantidad, 0));
  const descuentoTotal = round2(lineItems.reduce((acc, l) => acc + l.descuento_monto, 0));
  const total = round2(subtotal - descuentoTotal);

  const efectivo = montoEfectivo || 0;
  const tarjeta = montoTarjeta || 0;
  const totalRecibido = round2(efectivo + tarjeta);

  // HU-V03 Escenario 4 / T-VEN-09: el monto recibido debe cubrir el total
  if (metodoPago !== 'tarjeta' && totalRecibido < total) {
    throw new AppError('Monto insuficiente para cubrir el total de la venta', 400);
  }
  if (metodoPago === 'tarjeta' && tarjeta < total) {
    throw new AppError('Monto insuficiente para cubrir el total de la venta', 400);
  }

  const cambio = metodoPago === 'tarjeta' ? 0 : round2(totalRecibido - total);

  const folio = await generateSaleFolio(cajaId);

  // Insertamos la cabecera de la venta
  const { data: venta, error: ventaError } = await supabase
    .from('ventas')
    .insert({
      folio,
      caja_id: cajaId,
      usuario_id: usuario.id,
      subtotal,
      descuento_total: descuentoTotal,
      total,
      monto_efectivo: metodoPago === 'tarjeta' ? 0 : efectivo,
      monto_tarjeta: metodoPago === 'efectivo' ? 0 : tarjeta,
      cambio,
      estado: 'completada',
    })
    .select()
    .single();

  if (ventaError) {
    throw new AppError('No se pudo registrar la venta', 500);
  }

  // Insertamos cada línea de detalle y descontamos stock.
  // Si algo falla a mitad de camino, no hay rollback automático porque
  // Supabase JS no soporta transacciones multi-tabla desde el cliente;
  // se documenta como limitación conocida (ver nota al final del archivo).
  for (const line of lineItems) {
    // eslint-disable-next-line no-await-in-loop
    const { error: detalleError } = await supabase.from('detalle_venta').insert({
      venta_id: venta.id,
      producto_id: line.producto_id,
      cantidad: line.cantidad,
      precio_unitario: line.precio_unitario,
      descuento_pct: line.descuento_pct,
      descuento_monto: line.descuento_monto,
      subtotal: line.subtotal,
    });

    if (detalleError) {
      throw new AppError('No se pudo registrar el detalle de la venta', 500);
    }

    // eslint-disable-next-line no-await-in-loop
    const product = await productService.getProductById(line.producto_id);
    const stockAntes = product.stock_actual;
    const stockDespues = stockAntes - line.cantidad;

    // eslint-disable-next-line no-await-in-loop
    const { error: stockError } = await supabase
      .from('productos')
      .update({ stock_actual: stockDespues })
      .eq('id', line.producto_id);

    if (stockError) {
      throw new AppError('No se pudo actualizar el inventario tras la venta', 500);
    }

    // eslint-disable-next-line no-await-in-loop
    await supabase.from('movimientos_inventario').insert({
      producto_id: line.producto_id,
      usuario_id: usuario.id,
      venta_id: venta.id,
      tipo: 'venta',
      cantidad: -line.cantidad,
      stock_antes: stockAntes,
      stock_despues: stockDespues,
      motivo: `Venta ${folio}`,
    });
  }

  return {
    ...venta,
    items: lineItems,
  };
}

// Obtiene una venta completa por folio, incluyendo sus líneas de detalle.
async function getSaleByFolio(folio) {
  const { data: venta, error } = await supabase
    .from('ventas')
    .select('*')
    .eq('folio', folio)
    .maybeSingle();

  if (error) {
    throw new AppError('Error al consultar la venta', 500);
  }

  if (!venta) {
    throw new AppError('Venta no encontrada', 404);
  }

  const { data: detalle, error: detalleError } = await supabase
    .from('detalle_venta')
    .select('*, productos(nombre)')
    .eq('venta_id', venta.id);

  if (detalleError) {
    throw new AppError('Error al consultar el detalle de la venta', 500);
  }

  return {
    ...venta,
    items: detalle.map((d) => ({
      id: d.id,
      producto_id: d.producto_id,
      nombre: d.productos ? d.productos.nombre : null,
      cantidad: d.cantidad,
      precio_unitario: d.precio_unitario,
      descuento_pct: d.descuento_pct,
      descuento_monto: d.descuento_monto,
      subtotal: d.subtotal,
    })),
  };
}

// Procesa una devolución total o parcial de una venta (HU-V04).
// Solo debe invocarse tras pasar requireRole(['encargado', 'administrador']) en la ruta.
async function createReturn({ folio, tipo, detalleVentaIds, usuario }) {
  const ventaOriginal = await getSaleByFolio(folio);

  if (ventaOriginal.estado !== 'completada') {
    throw new AppError('Solo se pueden devolver ventas en estado "completada"', 400);
  }

  const esDevolucionTotal = !tipo || tipo === 'total';

  const lineasADevolver = esDevolucionTotal
    ? ventaOriginal.items
    : ventaOriginal.items.filter((item) => detalleVentaIds.includes(item.id));

  if (lineasADevolver.length === 0) {
    throw new AppError('No se encontraron líneas válidas para la devolución', 400);
  }

  const totalDevolucion = round2(lineasADevolver.reduce((acc, l) => acc + l.subtotal, 0));
  const folioDevolucion = await generateSaleFolio(ventaOriginal.caja_id);

  const { data: devolucion, error: devolucionError } = await supabase
    .from('ventas')
    .insert({
      folio: folioDevolucion,
      caja_id: ventaOriginal.caja_id,
      usuario_id: usuario.id,
      subtotal: totalDevolucion,
      descuento_total: 0,
      total: totalDevolucion,
      monto_efectivo: ventaOriginal.monto_efectivo > 0 ? totalDevolucion : 0,
      monto_tarjeta: ventaOriginal.monto_tarjeta > 0 ? totalDevolucion : 0,
      cambio: 0,
      estado: esDevolucionTotal ? 'devolucion' : 'devolucion_parcial',
      venta_origen_id: ventaOriginal.id,
    })
    .select()
    .single();

  if (devolucionError) {
    throw new AppError('No se pudo registrar la devolución', 500);
  }

  // Reintegramos stock por cada línea devuelta
  for (const linea of lineasADevolver) {
    // eslint-disable-next-line no-await-in-loop
    const product = await productService.getProductById(linea.producto_id);
    const stockAntes = product.stock_actual;
    const stockDespues = stockAntes + linea.cantidad;

    // eslint-disable-next-line no-await-in-loop
    const { error: stockError } = await supabase
      .from('productos')
      .update({ stock_actual: stockDespues })
      .eq('id', linea.producto_id);

    if (stockError) {
      throw new AppError('No se pudo reintegrar el stock de la devolución', 500);
    }

    // eslint-disable-next-line no-await-in-loop
    await supabase.from('movimientos_inventario').insert({
      producto_id: linea.producto_id,
      usuario_id: usuario.id,
      venta_id: devolucion.id,
      tipo: 'devolucion',
      cantidad: linea.cantidad,
      stock_antes: stockAntes,
      stock_despues: stockDespues,
      motivo: `Devolución de venta ${folio}`,
    });

    // eslint-disable-next-line no-await-in-loop
    await supabase.from('detalle_venta').insert({
      venta_id: devolucion.id,
      producto_id: linea.producto_id,
      cantidad: linea.cantidad,
      precio_unitario: linea.precio_unitario,
      descuento_pct: 0,
      descuento_monto: 0,
      subtotal: linea.subtotal,
    });
  }

  // Si fue devolución total, marcamos la venta original como tal.
  // Si fue parcial, la venta original conserva su estado "completada".
  if (esDevolucionTotal) {
    await supabase.from('ventas').update({ estado: 'devolucion' }).eq('id', ventaOriginal.id);
  }

  return devolucion;
}

module.exports = {
  createSale,
  getSaleByFolio,
  createReturn,
  assertCajaAbierta,
};

// NOTA TÉCNICA: Supabase JS (PostgREST) no soporta transacciones ACID
// multi-tabla desde el cliente. Las operaciones de venta y devolución
// hacen varias escrituras secuenciales (detalle_venta, productos,
// movimientos_inventario). Si se requiere atomicidad estricta, la
// recomendación es migrar esta lógica a una función RPC de PostgreSQL
// (plpgsql) invocada vía supabase.rpc(), envuelta en una transacción real.

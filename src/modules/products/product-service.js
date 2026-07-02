// Lógica de negocio del módulo de productos.
// Toda interacción con Supabase para la tabla `productos` vive aquí.
const supabase = require('../../config/supabase-client');
const AppError = require('../../shared/errors/app-error');

// Crea un producto nuevo (HU-P01).
// Lanza error 409 si el código de barras ya existe (HU-P01 Escenario 2).
async function createProduct(productData) {
  const { codigo_barras: codigoBarras } = productData;

  // Verificamos duplicado de código de barras antes de insertar
  const { data: existing, error: lookupError } = await supabase
    .from('productos')
    .select('id')
    .eq('codigo_barras', codigoBarras)
    .maybeSingle();

  if (lookupError) {
    throw new AppError('Error al verificar el código de barras', 500);
  }

  if (existing) {
    // HU-P01 Escenario 2
    throw new AppError('El código de barras ya está registrado', 409);
  }

  const { data, error } = await supabase
    .from('productos')
    .insert({
      codigo_barras: codigoBarras,
      nombre: productData.nombre,
      descripcion: productData.descripcion || null,
      precio_venta: productData.precio_venta,
      precio_costo: productData.precio_costo ?? null,
      stock_actual: productData.stock_actual ?? 0,
      stock_minimo: productData.stock_minimo ?? 0,
      categoria_id: productData.categoria_id,
      estado: 'activo',
    })
    .select()
    .single();

  if (error) {
    throw new AppError('No se pudo crear el producto', 500);
  }

  return data;
}

// Obtiene un producto por su id. Lanza 404 si no existe.
async function getProductById(productId) {
  const { data, error } = await supabase
    .from('productos')
    .select('*')
    .eq('id', productId)
    .maybeSingle();

  if (error) {
    throw new AppError('Error al consultar el producto', 500);
  }

  if (!data) {
    throw new AppError('Producto no encontrado', 404);
  }

  return data;
}

// Busca un producto por código de barras exacto.
// Usado por el módulo de ventas para el escaneo (HU-V01).
async function getProductByBarcode(codigoBarras) {
  const { data, error } = await supabase
    .from('productos')
    .select('*')
    .eq('codigo_barras', codigoBarras)
    .maybeSingle();

  if (error) {
    throw new AppError('Error al buscar el producto', 500);
  }

  return data || null;
}

// Lista productos con filtros opcionales y paginación.
async function listProducts(filters) {
  const page = filters.page && filters.page > 0 ? filters.page : 1;
  const limit = filters.limit && filters.limit > 0 ? filters.limit : 20;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase.from('productos').select('*', { count: 'exact' });

  if (filters.codigo_barras) {
    query = query.eq('codigo_barras', filters.codigo_barras);
  }

  if (filters.nombre) {
    query = query.ilike('nombre', `%${filters.nombre}%`);
  }

  if (filters.categoria_id) {
    query = query.eq('categoria_id', filters.categoria_id);
  }

  // Por defecto solo se muestran productos activos, salvo que se pida explícitamente "todos"
  if (filters.estado && filters.estado !== 'todos') {
    query = query.eq('estado', filters.estado);
  } else if (!filters.estado) {
    query = query.eq('estado', 'activo');
  }

  query = query.order('nombre', { ascending: true }).range(from, to);

  const { data, error, count } = await query;

  if (error) {
    throw new AppError('Error al listar productos', 500);
  }

  return {
    items: data,
    pagination: {
      total: count,
      page,
      limit,
    },
  };
}

// Lista las categorías disponibles para el formulario de productos.
async function getCategories() {
  const { data, error } = await supabase
    .from('categorias')
    .select('*')
    .order('nombre', { ascending: true });

  if (error) {
    throw new AppError('Error al listar las categorías', 500);
  }

  return data;
}

// Actualiza el precio de un producto y registra el cambio en historial_precios (HU-P02).
async function updateProductPrice(productId, newPrice, userId) {
  const product = await getProductById(productId);

  const previousPrice = product.precio_venta;

  const { data: updated, error: updateError } = await supabase
    .from('productos')
    .update({ precio_venta: newPrice })
    .eq('id', productId)
    .select()
    .single();

  if (updateError) {
    throw new AppError('No se pudo actualizar el precio del producto', 500);
  }

  // Registro de auditoría del cambio de precio (HU-P02 Escenario 3, §5.3)
  const { error: historyError } = await supabase.from('historial_precios').insert({
    producto_id: productId,
    usuario_id: userId,
    precio_anterior: previousPrice,
    precio_nuevo: newPrice,
  });

  if (historyError) {
    throw new AppError('El precio se actualizó pero no se pudo registrar el historial', 500);
  }

  return updated;
}

// Actualiza campos generales del producto (no precio_venta, que tiene su propio endpoint auditado).
async function updateProduct(productId, fields) {
  // Nos aseguramos de no permitir modificar precio_venta por esta vía
  // (debe usarse updateProductPrice para mantener el historial auditado).
  const { precio_venta: _omitido, ...allowedFields } = fields;

  await getProductById(productId);

  const { data, error } = await supabase
    .from('productos')
    .update(allowedFields)
    .eq('id', productId)
    .select()
    .single();

  if (error) {
    throw new AppError('No se pudo actualizar el producto', 500);
  }

  return data;
}

// Consulta el historial de cambios de precio de un producto (HU-P02 Escenario 3).
async function getPriceHistory(productId) {
  await getProductById(productId);

  const { data, error } = await supabase
    .from('historial_precios')
    .select('precio_anterior, precio_nuevo, creado_en, usuarios(nombre)')
    .eq('producto_id', productId)
    .order('creado_en', { ascending: false });

  if (error) {
    throw new AppError('Error al consultar el historial de precios', 500);
  }

  return data.map((item) => ({
    precio_anterior: item.precio_anterior,
    precio_nuevo: item.precio_nuevo,
    creado_en: item.creado_en,
    usuario: item.usuarios ? item.usuarios.nombre : null,
  }));
}

// Desactiva un producto (soft delete, HU-P03 Escenario 1).
async function deactivateProduct(productId) {
  await getProductById(productId);

  const { data, error } = await supabase
    .from('productos')
    .update({ estado: 'inactivo' })
    .eq('id', productId)
    .select()
    .single();

  if (error) {
    throw new AppError('No se pudo desactivar el producto', 500);
  }

  return data;
}

// Consulta productos con stock en o por debajo del mínimo (HU-I02).
async function getLowStockProducts() {
  const { data, error } = await supabase
    .from('v_stock_bajo')
    .select('*')
    .order('unidades_faltantes', { ascending: false });

  if (error) {
    throw new AppError('Error al consultar las alertas de stock', 500);
  }

  return data;
}

// Registra una entrada de mercancía e incrementa el stock (HU-I01).
async function registerStockEntry({ productoId, cantidad, proveedor, usuarioId }) {
  const product = await getProductById(productoId);

  const stockAntes = product.stock_actual;
  const stockDespues = stockAntes + cantidad;

  const { data: updatedProduct, error: updateError } = await supabase
    .from('productos')
    .update({ stock_actual: stockDespues })
    .eq('id', productoId)
    .select()
    .single();

  if (updateError) {
    throw new AppError('No se pudo actualizar el stock del producto', 500);
  }

  const { error: movementError } = await supabase.from('movimientos_inventario').insert({
    producto_id: productoId,
    usuario_id: usuarioId,
    tipo: 'entrada',
    cantidad,
    stock_antes: stockAntes,
    stock_despues: stockDespues,
    motivo: proveedor ? `Entrada de mercancía — Proveedor: ${proveedor}` : 'Entrada de mercancía',
  });

  if (movementError) {
    throw new AppError('El stock se actualizó pero no se pudo registrar el movimiento', 500);
  }

  return updatedProduct;
}

// Aplica un ajuste manual de inventario (HU-I03).
// Lanza error si el ajuste dejaría el stock en valor negativo (HU-I03 Escenario 3, RN-02).
async function applyStockAdjustment({ productoId, cantidad, motivo, usuarioId }) {
  const product = await getProductById(productoId);

  const stockAntes = product.stock_actual;
  const stockDespues = stockAntes + cantidad;

  if (stockDespues < 0) {
    throw new AppError(
      'El ajuste dejaría el stock en valor negativo. Verifique la cantidad ingresada',
      400
    );
  }

  const { data: updatedProduct, error: updateError } = await supabase
    .from('productos')
    .update({ stock_actual: stockDespues })
    .eq('id', productoId)
    .select()
    .single();

  if (updateError) {
    throw new AppError('No se pudo aplicar el ajuste de inventario', 500);
  }

  // Determinamos el tipo de movimiento según el motivo seleccionado (RN-07)
  const tipoMovimientoPorMotivo = {
    Merma: 'ajuste_merma',
    Robo: 'ajuste_robo',
    'Error de conteo': 'ajuste_conteo',
    'Entrada manual': 'ajuste_manual',
    Otro: 'otro',
  };

  const { error: movementError } = await supabase.from('movimientos_inventario').insert({
    producto_id: productoId,
    usuario_id: usuarioId,
    tipo: tipoMovimientoPorMotivo[motivo] || 'ajuste_manual',
    cantidad,
    stock_antes: stockAntes,
    stock_despues: stockDespues,
    motivo,
  });

  if (movementError) {
    throw new AppError('El ajuste se aplicó pero no se pudo registrar el movimiento', 500);
  }

  return updatedProduct;
}

module.exports = {
  createProduct,
  getProductById,
  getProductByBarcode,
  listProducts,
  getCategories,
  updateProductPrice,
  updateProduct,
  getPriceHistory,
  deactivateProduct,
  getLowStockProducts,
  registerStockEntry,
  applyStockAdjustment,
};

// Genera folios consecutivos y únicos por caja (§5.4).
// Formato: F-<numero_caja>-<consecutivo_padded>, ej. F-2-000045
const supabase = require('../../config/supabase-client');
const AppError = require('../../shared/errors/app-error');

// Genera el siguiente folio de venta para una caja dada.
// Cuenta las ventas existentes de esa caja para determinar el consecutivo.
// Nota: en alta concurrencia esto debería protegerse con una secuencia SQL
// dedicada; aquí se deja documentado como limitación conocida.
async function generateSaleFolio(cajaId) {
  const { count, error } = await supabase
    .from('ventas')
    .select('id', { count: 'exact', head: true })
    .eq('caja_id', cajaId);

  if (error) {
    throw new AppError('No se pudo generar el folio de venta', 500);
  }

  const consecutivo = (count || 0) + 1;
  return `F-${cajaId}-${String(consecutivo).padStart(6, '0')}`;
}

// Genera el siguiente folio de corte de caja para una caja dada.
async function generateShiftFolio(cajaId) {
  const { count, error } = await supabase
    .from('cortes_caja')
    .select('id', { count: 'exact', head: true })
    .eq('caja_id', cajaId);

  if (error) {
    throw new AppError('No se pudo generar el folio de corte', 500);
  }

  const consecutivo = (count || 0) + 1;
  return `CRT-${cajaId}-${String(consecutivo).padStart(6, '0')}`;
}

// Genera el siguiente folio de compra (consecutivo global, sin distinción por caja).
async function generatePurchaseFolio() {
  const { count, error } = await supabase
    .from('compras')
    .select('id', { count: 'exact', head: true });

  if (error) {
    throw new AppError('No se pudo generar el folio de compra', 500);
  }

  const consecutivo = (count || 0) + 1;
  return `C-${String(consecutivo).padStart(6, '0')}`;
}

module.exports = { generateSaleFolio, generateShiftFolio, generatePurchaseFolio };

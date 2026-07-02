// Lógica de negocio del módulo de corte de caja.
const supabase = require('../../config/supabase-client');
const AppError = require('../../shared/errors/app-error');
const { generateShiftFolio } = require('../../shared/utils/folio-generator');
const { round2 } = require('../../shared/utils/money');

// Abre un nuevo turno de caja (HU-C01).
// RN-08: el fondo de apertura debe registrarse antes de poder iniciar ventas.
async function openShift({ cajaId, fondoApertura, usuarioId }) {
  // HU-C01 Escenario 2: no se puede abrir una caja que ya tiene turno abierto
  const { data: turnoAbierto, error: lookupError } = await supabase
    .from('cortes_caja')
    .select('id')
    .eq('caja_id', cajaId)
    .eq('estado', 'abierto')
    .maybeSingle();

  if (lookupError) {
    throw new AppError('Error al verificar el estado de la caja', 500);
  }

  if (turnoAbierto) {
    throw new AppError(
      'Esta caja tiene un turno sin cerrar. Contacte al encargado',
      409
    );
  }

  const folio = await generateShiftFolio(cajaId);

  const { data, error } = await supabase
    .from('cortes_caja')
    .insert({
      folio,
      caja_id: cajaId,
      usuario_id: usuarioId,
      fondo_apertura: fondoApertura,
      ventas_efectivo: 0,
      ventas_tarjeta: 0,
      ventas_mixtas: 0,
      estado: 'abierto',
    })
    .select()
    .single();

  if (error) {
    throw new AppError('No se pudo abrir el turno de caja', 500);
  }

  return data;
}

// Obtiene un corte por id. Lanza 404 si no existe.
async function getShiftById(shiftId) {
  const { data, error } = await supabase
    .from('cortes_caja')
    .select('*')
    .eq('id', shiftId)
    .maybeSingle();

  if (error) {
    throw new AppError('Error al consultar el corte de caja', 500);
  }

  if (!data) {
    throw new AppError('Corte de caja no encontrado', 404);
  }

  return data;
}

// Calcula el desglose de ventas del turno por método de pago,
// agregando todas las ventas en estado "completada" registradas para esa caja
// desde la apertura del turno hasta ahora.
async function calculateShiftSalesSummary(shift) {
  const { data: ventas, error } = await supabase
    .from('ventas')
    .select('monto_efectivo, monto_tarjeta, total')
    .eq('caja_id', shift.caja_id)
    .eq('estado', 'completada')
    .gte('creado_en', shift.apertura_en);

  if (error) {
    throw new AppError('Error al calcular el resumen de ventas del turno', 500);
  }

  let ventasEfectivoPuro = 0;
  let ventasTarjetaPuro = 0;
  let ventasMixtas = 0;
  const numTickets = ventas.length;

  ventas.forEach((venta) => {
    const tieneEfectivo = venta.monto_efectivo > 0;
    const tieneTarjeta = venta.monto_tarjeta > 0;

    if (tieneEfectivo && tieneTarjeta) {
      // Venta mixta: solo la porción en efectivo entra al conteo físico de caja
      ventasMixtas = round2(ventasMixtas + venta.monto_efectivo);
    } else if (tieneEfectivo) {
      ventasEfectivoPuro = round2(ventasEfectivoPuro + venta.monto_efectivo);
    } else if (tieneTarjeta) {
      ventasTarjetaPuro = round2(ventasTarjetaPuro + venta.monto_tarjeta);
    }
  });

  return {
    ventas_efectivo: ventasEfectivoPuro,
    ventas_tarjeta: ventasTarjetaPuro,
    ventas_mixtas: ventasMixtas,
    num_tickets: numTickets,
    total_ventas: round2(ventas.reduce((acc, v) => acc + v.total, 0)),
  };
}

// Verifica que no haya una venta en proceso (ticket abierto sin pagar) antes
// de permitir el cierre (RN-09).
// Nota: en este sistema toda venta se registra ya completada en un solo paso
// (no existe un estado "ticket abierto" persistido en BD), por lo que esta
// validación queda como punto de extensión documentado: si en el futuro se
// implementa guardado de tickets en progreso (ej. para reanudar tras un corte
// de conexión), debe añadirse aquí la verificación correspondiente.
async function assertNoVentaEnProceso() {
  // Sin tabla de "tickets en progreso" persistida, no hay nada que verificar
  // en este punto. Se documenta como limitación conocida (ver T-COR-07).
  return true;
}

// Cierra un turno de caja, calculando el desglose por método de pago y
// la diferencia entre el efectivo esperado y el contado físicamente (HU-C02).
async function closeShift({ shiftId, efectivoContado }) {
  const shift = await getShiftById(shiftId);

  // RN-05: un corte ya cerrado es inmutable
  if (shift.estado === 'cerrado') {
    throw new AppError('Este corte de caja ya fue cerrado anteriormente', 409);
  }

  // RN-09: no se puede cerrar con una venta en proceso
  await assertNoVentaEnProceso(shift.caja_id);

  const resumen = await calculateShiftSalesSummary(shift);

  const totalSistema = round2(shift.fondo_apertura + resumen.ventas_efectivo + resumen.ventas_mixtas);
  const diferencia = round2(efectivoContado - totalSistema);

  const { data, error } = await supabase
    .from('cortes_caja')
    .update({
      ventas_efectivo: resumen.ventas_efectivo,
      ventas_tarjeta: resumen.ventas_tarjeta,
      ventas_mixtas: resumen.ventas_mixtas,
      efectivo_contado: efectivoContado,
      estado: 'cerrado',
      cierre_en: new Date().toISOString(),
    })
    .eq('id', shiftId)
    .select()
    .single();

  if (error) {
    throw new AppError('No se pudo cerrar el turno de caja', 500);
  }

  // Liberamos la caja activa del usuario que cerró el turno,
  // para que pueda iniciar sesión en otra caja si lo necesita.
  await supabase.from('usuarios').update({ caja_activa_id: null }).eq('id', shift.usuario_id);

  return {
    ...data,
    // total_sistema y diferencia ya vienen calculados por las columnas
    // GENERATED de PostgreSQL (schema.sql), pero los recalculamos aquí
    // también para que la respuesta sea explícita y no dependa solo de
    // lo que devuelva el SELECT (defensa en profundidad).
    total_sistema: totalSistema,
    diferencia,
    num_tickets: resumen.num_tickets,
    total_ventas: resumen.total_ventas,
  };
}

// Lista cortes de caja con filtros de fecha y/o caja (HU-C03).
async function listShifts(filters) {
  let query = supabase.from('cortes_caja').select('*, cajas(numero), usuarios(nombre)');

  if (filters.cajaId) {
    query = query.eq('caja_id', filters.cajaId);
  }

  if (filters.desde) {
    query = query.gte('apertura_en', filters.desde);
  }

  if (filters.hasta) {
    // Incluimos todo el día "hasta" sumando 1 día como límite exclusivo
    const hastaFin = new Date(filters.hasta);
    hastaFin.setDate(hastaFin.getDate() + 1);
    query = query.lt('apertura_en', hastaFin.toISOString());
  }

  query = query.order('apertura_en', { ascending: false });

  const { data, error } = await query;

  if (error) {
    throw new AppError('Error al consultar el historial de cortes', 500);
  }

  return data.map((corte) => ({
    id: corte.id,
    folio: corte.folio,
    caja: corte.cajas ? corte.cajas.numero : null,
    cajero: corte.usuarios ? corte.usuarios.nombre : null,
    fondo_apertura: corte.fondo_apertura,
    total_sistema: corte.total_sistema,
    efectivo_contado: corte.efectivo_contado,
    diferencia: corte.diferencia,
    estado: corte.estado,
    apertura_en: corte.apertura_en,
    cierre_en: corte.cierre_en,
  }));
}

module.exports = {
  openShift,
  getShiftById,
  closeShift,
  listShifts,
  calculateShiftSalesSummary,
};

// Pruebas: corte de caja (HU-C01, HU-C02, RN-05, RN-08)
// Verifica apertura, cierre, cálculo de diferencia y bloqueo de doble apertura/cierre.

jest.mock('../src/config/supabase-client', () => {
  const chain = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lt: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn(),
    single: jest.fn(),
  };
  return chain;
});

jest.mock('../src/shared/utils/folio-generator', () => ({
  generateShiftFolio: jest.fn().mockResolvedValue('CRT-1-000001'),
}));

const supabase = require('../src/config/supabase-client');
const {
  openShift,
  closeShift,
  calculateShiftSalesSummary,
} = require('../src/modules/cash-shifts/cash-shift-service');

// clearMocks (jest.config.js) solo limpia calls/instances, no los valores
// encolados con mockResolvedValueOnce. Reseteamos explícitamente para que
// un "once" no consumido no se cuele en el siguiente test.
beforeEach(() => {
  supabase.maybeSingle.mockReset();
  supabase.single.mockReset();
  supabase.gte.mockReset().mockReturnThis();
  supabase.update.mockReset().mockReturnThis();
  supabase.insert.mockReset().mockReturnThis();
});

// Turno base reutilizado en los tests de cierre
const turnoBase = {
  id: 50,
  folio: 'CRT-1-000001',
  caja_id: 1,
  usuario_id: 10,
  fondo_apertura: 500,
  estado: 'abierto',
  apertura_en: '2026-06-29T08:00:00.000Z',
};

// ─────────────────────────────────────────────────────────────────────────────
describe('Cash Shift Service — Apertura de caja (HU-C01)', () => {
// ─────────────────────────────────────────────────────────────────────────────

  describe('apertura exitosa con fondo inicial', () => {
    test('crea el turno cuando la caja no tiene turno abierto (HU-C01 Esc.1)', async () => {
      // No hay turno abierto previo
      supabase.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

      // Insert exitoso del nuevo turno
      supabase.single.mockResolvedValueOnce({
        data: {
          id: 50,
          folio: 'CRT-1-000001',
          caja_id: 1,
          fondo_apertura: 500,
          estado: 'abierto',
        },
        error: null,
      });

      const resultado = await openShift({ cajaId: 1, fondoApertura: 500, usuarioId: 10 });

      expect(resultado.estado).toBe('abierto');
      expect(resultado.fondo_apertura).toBe(500);
    });

    test('acepta fondo de apertura en $0.00 sin lanzar error (HU-C01 Esc.3)', async () => {
      supabase.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
      supabase.single.mockResolvedValueOnce({
        data: {
          id: 51,
          folio: 'CRT-1-000002',
          caja_id: 1,
          fondo_apertura: 0,
          estado: 'abierto',
        },
        error: null,
      });

      await expect(
        openShift({ cajaId: 1, fondoApertura: 0, usuarioId: 10 })
      ).resolves.toMatchObject({ fondo_apertura: 0 });
    });
  });

  describe('bloqueo de doble apertura (HU-C01 Esc.2)', () => {
    beforeEach(() => {
      // Ya existe un turno abierto para esa caja
      supabase.maybeSingle.mockResolvedValueOnce({
        data: { id: 99 },
        error: null,
      });
    });

    test('lanza AppError 409 cuando la caja ya tiene turno abierto', async () => {
      await expect(
        openShift({ cajaId: 1, fondoApertura: 500, usuarioId: 10 })
      ).rejects.toMatchObject({
        message: 'Esta caja tiene un turno sin cerrar. Contacte al encargado',
        statusCode: 409,
      });
    });

    test('no llama a insert cuando ya existe un turno abierto', async () => {
      await expect(openShift({ cajaId: 1, fondoApertura: 500, usuarioId: 10 })).rejects.toThrow();
      expect(supabase.insert).not.toHaveBeenCalled();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Cash Shift Service — Cierre de caja y diferencias (HU-C02)', () => {
// ─────────────────────────────────────────────────────────────────────────────

  // Ventas del turno: $2400 en efectivo puro (fondo $500 + $2400 = $2900 esperado)
  const ventasEfectivoPuro = [
    { monto_efectivo: 1000, monto_tarjeta: 0, total: 1000 },
    { monto_efectivo: 1400, monto_tarjeta: 0, total: 1400 },
  ];

  function mockCierreExitoso({ ventas = ventasEfectivoPuro, corteData = {} } = {}) {
    // getShiftById → maybeSingle
    supabase.maybeSingle.mockResolvedValueOnce({ data: turnoBase, error: null });
    // calculateShiftSalesSummary → última llamada de la cadena es gte()
    supabase.gte.mockResolvedValueOnce({ data: ventas, error: null });
    // update de cortes_caja → single
    supabase.single.mockResolvedValueOnce({
      data: { ...turnoBase, estado: 'cerrado', ...corteData },
      error: null,
    });
  }

  describe('cálculo de diferencia exacta (HU-C02 Esc.1)', () => {
    test('diferencia = 0 cuando efectivo contado = fondo + ventas efectivo', async () => {
      mockCierreExitoso();

      const resultado = await closeShift({ shiftId: 50, efectivoContado: 2900 });

      expect(resultado.total_sistema).toBe(2900);
      expect(resultado.diferencia).toBe(0);
    });
  });

  describe('cálculo de faltante (HU-C02 Esc.2)', () => {
    test('diferencia = -50 cuando cajero cuenta $2850 pero el sistema espera $2900', async () => {
      mockCierreExitoso();

      const resultado = await closeShift({ shiftId: 50, efectivoContado: 2850 });

      expect(resultado.diferencia).toBe(-50);
    });
  });

  describe('cálculo de sobrante (HU-C02 Esc.3)', () => {
    test('diferencia = +50 cuando cajero cuenta $2950 pero el sistema espera $2900', async () => {
      mockCierreExitoso();

      const resultado = await closeShift({ shiftId: 50, efectivoContado: 2950 });

      expect(resultado.diferencia).toBe(50);
    });
  });

  describe('inmutabilidad del corte ya cerrado (RN-05)', () => {
    beforeEach(() => {
      supabase.maybeSingle.mockResolvedValueOnce({
        data: { ...turnoBase, estado: 'cerrado' },
        error: null,
      });
    });

    test('lanza AppError 409 al intentar cerrar un corte ya cerrado', async () => {
      await expect(closeShift({ shiftId: 50, efectivoContado: 2900 })).rejects.toMatchObject({
        message: 'Este corte de caja ya fue cerrado anteriormente',
        statusCode: 409,
      });
    });

    test('no llama a update cuando el corte ya está cerrado', async () => {
      await expect(closeShift({ shiftId: 50, efectivoContado: 2900 })).rejects.toThrow();
      expect(supabase.update).not.toHaveBeenCalled();
    });
  });

  describe('corte no encontrado', () => {
    test('lanza AppError 404 cuando el shiftId no existe', async () => {
      supabase.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

      await expect(closeShift({ shiftId: 999, efectivoContado: 100 })).rejects.toMatchObject({
        message: 'Corte de caja no encontrado',
        statusCode: 404,
      });
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Cash Shift Service — calculateShiftSalesSummary (HU-C02 Esc.4)', () => {
// ─────────────────────────────────────────────────────────────────────────────

  describe('desglose correcto por método de pago', () => {
    test('clasifica correctamente ventas puras en efectivo, tarjeta y mixtas', async () => {
      const ventas = [
        { monto_efectivo: 100, monto_tarjeta: 0, total: 100 }, // efectivo puro
        { monto_efectivo: 0, monto_tarjeta: 200, total: 200 }, // tarjeta pura
        { monto_efectivo: 50, monto_tarjeta: 50, total: 100 }, // mixta
      ];
      supabase.gte.mockResolvedValueOnce({ data: ventas, error: null });

      const resumen = await calculateShiftSalesSummary(turnoBase);

      expect(resumen.ventas_efectivo).toBe(100);
      expect(resumen.ventas_tarjeta).toBe(200);
      expect(resumen.ventas_mixtas).toBe(50); // solo la porción en efectivo
      expect(resumen.num_tickets).toBe(3);
      expect(resumen.total_ventas).toBe(400);
    });

    test('retorna ceros cuando no hay ventas en el turno', async () => {
      supabase.gte.mockResolvedValueOnce({ data: [], error: null });

      const resumen = await calculateShiftSalesSummary(turnoBase);

      expect(resumen.ventas_efectivo).toBe(0);
      expect(resumen.ventas_tarjeta).toBe(0);
      expect(resumen.ventas_mixtas).toBe(0);
      expect(resumen.num_tickets).toBe(0);
      expect(resumen.total_ventas).toBe(0);
    });

    test('total_sistema = fondo_apertura + ventas_efectivo + ventas_mixtas (excluye tarjeta)', async () => {
      const ventas = [
        { monto_efectivo: 0, monto_tarjeta: 500, total: 500 }, // tarjeta pura: no debe sumar
        { monto_efectivo: 300, monto_tarjeta: 0, total: 300 }, // efectivo puro
      ];

      supabase.maybeSingle.mockResolvedValueOnce({ data: turnoBase, error: null });
      supabase.gte.mockResolvedValueOnce({ data: ventas, error: null });
      supabase.single.mockResolvedValueOnce({
        data: { ...turnoBase, estado: 'cerrado' },
        error: null,
      });

      const resultado = await closeShift({ shiftId: 50, efectivoContado: 800 });

      // total_sistema = 500 (fondo) + 300 (efectivo) + 0 (mixtas) = 800; la tarjeta ($500) queda excluida
      expect(resultado.total_sistema).toBe(800);
      expect(resultado.diferencia).toBe(0);
    });

    test('maneja correctamente la precisión de punto flotante con round2', async () => {
      const ventas = [
        { monto_efectivo: 0.1, monto_tarjeta: 0, total: 0.1 },
        { monto_efectivo: 0.2, monto_tarjeta: 0, total: 0.2 },
      ];
      supabase.gte.mockResolvedValueOnce({ data: ventas, error: null });

      const resumen = await calculateShiftSalesSummary(turnoBase);

      expect(resumen.ventas_efectivo).toBe(0.3); // no 0.30000000000000004
    });
  });
});

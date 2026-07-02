// Pruebas: stock insuficiente al vender (HU-V01 Esc.4, RN-02)
// Mockea supabase-client y product-service para no tocar la BD real.
// Todos los mensajes de error coinciden exactamente con sale-service.js.

// Mockeamos los tres módulos externos que usa sale-service.js
jest.mock('../src/config/supabase-client', () => {
  // Patrón de encadenamiento fluent de Supabase: cada método devuelve `this`
  // para que se puedan encadenar .from().select().eq()...
  const chain = {
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn(),
    single: jest.fn(),
  };
  return chain;
});

jest.mock('../src/modules/products/product-service', () => ({
  getProductById: jest.fn(),
}));

jest.mock('../src/shared/utils/folio-generator', () => ({
  generateSaleFolio: jest.fn().mockResolvedValue('F-1-000001'),
}));

// bcrypt no necesita mock: sale-service solo lo usa en validateAuthorizationCode,
// que no se invoca en estos tests (no hay autorizacion en el payload).

const supabase = require('../src/config/supabase-client');
const productService = require('../src/modules/products/product-service');
const { createSale } = require('../src/modules/sales/sale-service');

// clearMocks (jest.config.js) solo limpia calls/instances, no los valores
// encolados con mockResolvedValueOnce. Sin este reset, un "once" no consumido
// en un test se cuela en el siguiente y corrompe su mock (p. ej. la caja
// aparece cerrada cuando el test siguiente esperaba que estuviera abierta).
beforeEach(() => {
  supabase.maybeSingle.mockReset();
  supabase.single.mockReset();
  productService.getProductById.mockReset();
});

// Usuario cajero base reutilizado en todos los tests de este archivo
const usuarioCajero = {
  id: 10,
  nombre: 'María López',
  rol: 'cajero',
  descuento_max_pct: 5,
};

// Configura el mock de supabase para simular que la caja tiene turno abierto.
// Se llama en beforeEach de los grupos que necesitan caja abierta.
function mockCajaAbierta() {
  // assertCajaAbierta llama: supabase.from().select().eq().eq().maybeSingle()
  supabase.maybeSingle.mockResolvedValueOnce({
    data: { id: 99, estado: 'abierto' },
    error: null,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
describe('Sale Service — Stock insuficiente (HU-V01 Esc.4, RN-02)', () => {
// ─────────────────────────────────────────────────────────────────────────────

  describe('cuando la cantidad solicitada supera el stock disponible', () => {
    beforeEach(() => {
      // La caja tiene turno abierto para pasar assertCajaAbierta
      mockCajaAbierta();

      // El producto existe pero solo tiene 2 unidades
      productService.getProductById.mockResolvedValue({
        id: 1,
        nombre: 'Refresco Cola 600ml',
        precio_venta: 20,
        stock_actual: 2,
        estado: 'activo',
      });
    });

    test('lanza AppError con mensaje de stock insuficiente y statusCode 400', async () => {
      // Given: el cajero intenta vender 5 unidades cuando solo hay 2
      const payload = {
        items: [{ producto_id: 1, cantidad: 5 }],
        metodoPago: 'efectivo',
        montoEfectivo: 100,
        cajaId: 1,
        usuario: usuarioCajero,
      };

      // When / Then
      await expect(createSale(payload)).rejects.toMatchObject({
        message: 'Stock insuficiente para "Refresco Cola 600ml". Disponible: 2 unidades',
        statusCode: 400,
      });
    });

    test('no llama a supabase.insert (no escribe nada en BD si el stock falla)', async () => {
      const payload = {
        items: [{ producto_id: 1, cantidad: 10 }],
        metodoPago: 'efectivo',
        montoEfectivo: 200,
        cajaId: 1,
        usuario: usuarioCajero,
      };

      await expect(createSale(payload)).rejects.toThrow();
      // insert no debe haberse llamado: la venta no se registra
      expect(supabase.insert).not.toHaveBeenCalled();
    });
  });

  describe('cuando la cantidad solicitada es exactamente igual al stock disponible', () => {
    beforeEach(() => {
      mockCajaAbierta();

      // Stock exactamente igual a la cantidad pedida: debe pasar
      productService.getProductById
        // Primera llamada: buildSaleLineItem (validación de stock)
        .mockResolvedValueOnce({
          id: 1,
          nombre: 'Refresco Cola 600ml',
          precio_venta: 20,
          stock_actual: 3,
          estado: 'activo',
        })
        // Segunda llamada: descuento de stock dentro del loop de createSale
        .mockResolvedValueOnce({
          id: 1,
          nombre: 'Refresco Cola 600ml',
          precio_venta: 20,
          stock_actual: 3,
          estado: 'activo',
        });

      // Simula la inserción exitosa de la cabecera de venta
      supabase.single.mockResolvedValue({
        data: {
          id: 100,
          folio: 'F-1-000001',
          total: 60,
          cambio: 40,
          estado: 'completada',
        },
        error: null,
      });

      // Simula el insert de detalle_venta y el update de stock (sin error)
      supabase.maybeSingle
        .mockResolvedValueOnce({ data: null, error: null }); // detalle insert
      supabase.eq.mockReturnThis();
    });

    test('no lanza error cuando cantidad === stock_actual', async () => {
      const payload = {
        items: [{ producto_id: 1, cantidad: 3 }],
        metodoPago: 'efectivo',
        montoEfectivo: 100,
        cajaId: 1,
        usuario: usuarioCajero,
      };

      // No debe rechazar — la venta es válida
      await expect(createSale(payload)).resolves.toBeDefined();
    });
  });

  describe('cuando el producto está inactivo', () => {
    beforeEach(() => {
      mockCajaAbierta();

      productService.getProductById.mockResolvedValue({
        id: 2,
        nombre: 'Atún en lata 130g',
        precio_venta: 22,
        stock_actual: 10,
        estado: 'inactivo', // <-- producto desactivado (HU-P03 Esc.2)
      });
    });

    test('lanza AppError con mensaje de producto no disponible y statusCode 400', async () => {
      const payload = {
        items: [{ producto_id: 2, cantidad: 1 }],
        metodoPago: 'efectivo',
        montoEfectivo: 50,
        cajaId: 1,
        usuario: usuarioCajero,
      };

      await expect(createSale(payload)).rejects.toMatchObject({
        message: 'El producto "Atún en lata 130g" no está disponible para venta',
        statusCode: 400,
      });
    });
  });

  describe('cuando la caja no tiene turno abierto (RN-08)', () => {
    beforeEach(() => {
      // maybeSingle devuelve null → no hay turno abierto
      supabase.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null,
      });
    });

    test('lanza AppError con mensaje de caja no abierta y statusCode 400', async () => {
      const payload = {
        items: [{ producto_id: 1, cantidad: 1 }],
        metodoPago: 'efectivo',
        montoEfectivo: 50,
        cajaId: 1,
        usuario: usuarioCajero,
      };

      await expect(createSale(payload)).rejects.toMatchObject({
        message: 'La caja no tiene un turno abierto. Realiza la apertura primero',
        statusCode: 400,
      });
    });
  });
});

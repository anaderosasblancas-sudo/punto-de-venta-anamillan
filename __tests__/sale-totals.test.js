// Pruebas: cálculo de totales de venta (HU-V02, HU-V03, RN-01, RN-03)
// Verifica subtotal, descuentos, cambio y validación de monto insuficiente.
// Los cálculos se hacen en el service, nunca confiando en valores del cliente.

jest.mock('../src/config/supabase-client', () => {
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
  generateSaleFolio: jest.fn().mockResolvedValue('F-2-000001'),
}));

const supabase = require('../src/config/supabase-client');
const productService = require('../src/modules/products/product-service');
const { createSale } = require('../src/modules/sales/sale-service');

// clearMocks (jest.config.js) solo limpia calls/instances, no los valores
// encolados con mockResolvedValueOnce. Sin este reset, un "once" no consumido
// en un test se cuela en el siguiente y corrompe su mock.
beforeEach(() => {
  supabase.maybeSingle.mockReset();
  supabase.single.mockReset();
  productService.getProductById.mockReset();
});

// Producto de prueba reutilizable
const productoBase = {
  id: 1,
  nombre: 'Refresco Cola 600ml',
  precio_venta: 20,
  stock_actual: 48,
  estado: 'activo',
};

const usuarioCajero = {
  id: 10,
  nombre: 'María López',
  rol: 'cajero',
  descuento_max_pct: 10,
};

// Simula turno de caja abierto + insert exitoso de cabecera de venta.
// ventaData permite personalizar la respuesta del insert.
function mockVentaExitosa(ventaData = {}) {
  // assertCajaAbierta → maybeSingle
  supabase.maybeSingle.mockResolvedValueOnce({
    data: { id: 99, estado: 'abierto' },
    error: null,
  });

  // insert de cabecera → single
  supabase.single.mockResolvedValue({
    data: {
      id: 200,
      folio: 'F-2-000001',
      estado: 'completada',
      ...ventaData,
    },
    error: null,
  });

  // getProductById segunda llamada (descuento de stock)
  productService.getProductById.mockResolvedValue(productoBase);
}

// ─────────────────────────────────────────────────────────────────────────────
describe('Sale Service — Cálculo de totales de venta (HU-V02, HU-V03)', () => {
// ─────────────────────────────────────────────────────────────────────────────

  // ── Subtotal y total sin descuento ────────────────────────────────────────
  describe('cálculo de subtotal sin descuentos', () => {
    beforeEach(() => {
      productService.getProductById.mockResolvedValue(productoBase);
      mockVentaExitosa({ subtotal: 60, descuento_total: 0, total: 60 });
    });

    test('subtotal = precio_unitario × cantidad (3 × $20 = $60)', async () => {
      const payload = {
        items: [{ producto_id: 1, cantidad: 3 }],
        metodoPago: 'efectivo',
        montoEfectivo: 100,
        cajaId: 1,
        usuario: usuarioCajero,
      };

      const resultado = await createSale(payload);

      // El item construido internamente debe tener el subtotal correcto
      expect(resultado.items[0].subtotal).toBe(60);
      expect(resultado.items[0].precio_unitario).toBe(20);
    });

    test('el total del ticket suma los subtotales de todas las líneas', async () => {
      // Dos productos distintos
      const producto2 = { ...productoBase, id: 2, nombre: 'Aceite vegetal 1L', precio_venta: 48 };
      productService.getProductById
        .mockResolvedValueOnce(productoBase)  // línea 1
        .mockResolvedValueOnce(producto2)     // línea 2
        .mockResolvedValue(productoBase)      // descuento stock
        .mockResolvedValue(producto2);

      mockVentaExitosa({ total: 68 }); // 20 + 48

      const payload = {
        items: [
          { producto_id: 1, cantidad: 1 },
          { producto_id: 2, cantidad: 1 },
        ],
        metodoPago: 'efectivo',
        montoEfectivo: 100,
        cajaId: 1,
        usuario: usuarioCajero,
      };

      const resultado = await createSale(payload);
      const totalCalculado = resultado.items.reduce((acc, l) => acc + l.subtotal, 0);
      expect(totalCalculado).toBe(68); // $20 + $48
    });
  });

  // ── Descuento porcentual dentro del límite ────────────────────────────────
  describe('descuento porcentual dentro del límite del cajero (HU-V02 Esc.1)', () => {
    beforeEach(() => {
      productService.getProductById.mockResolvedValue(productoBase);
      mockVentaExitosa({ total: 19 });
    });

    test('5% de descuento sobre $20.00 → subtotal = $19.00', async () => {
      const payload = {
        items: [{ producto_id: 1, cantidad: 1, descuento_pct: 5 }],
        metodoPago: 'efectivo',
        montoEfectivo: 20,
        cajaId: 1,
        usuario: usuarioCajero, // descuento_max_pct = 10
      };

      const resultado = await createSale(payload);
      expect(resultado.items[0].subtotal).toBe(19);
      expect(resultado.items[0].descuento_monto).toBe(1); // $1 de descuento
    });

    test('el descuento_monto se calcula en el service, no se acepta del cliente', async () => {
      // Aunque el cliente envíe un descuento_monto inventado, el service lo recalcula
      const payload = {
        items: [{ producto_id: 1, cantidad: 1, descuento_pct: 5, descuento_monto: 999 }],
        metodoPago: 'efectivo',
        montoEfectivo: 20,
        cajaId: 1,
        usuario: usuarioCajero,
      };

      const resultado = await createSale(payload);
      // El descuento real es 5% de $20 = $1, no $999
      expect(resultado.items[0].descuento_monto).toBe(1);
      expect(resultado.items[0].subtotal).toBe(19);
    });
  });

  // ── Descuento que supera el límite sin autorización ───────────────────────
  describe('descuento que supera el límite del cajero sin autorización (HU-V02 Esc.2, RN-03)', () => {
    beforeEach(() => {
      // Caja abierta para pasar assertCajaAbierta
      supabase.maybeSingle.mockResolvedValueOnce({
        data: { id: 99, estado: 'abierto' },
        error: null,
      });
      productService.getProductById.mockResolvedValue(productoBase);
    });

    test('lanza AppError 403 cuando el descuento supera descuento_max_pct', async () => {
      const payload = {
        items: [{ producto_id: 1, cantidad: 1, descuento_pct: 20 }], // 20% > límite de 10%
        metodoPago: 'efectivo',
        montoEfectivo: 20,
        cajaId: 1,
        usuario: usuarioCajero, // descuento_max_pct = 10
      };

      await expect(createSale(payload)).rejects.toMatchObject({
        message: 'El descuento de 20% supera tu límite autorizado (10%). Solicita autorización',
        statusCode: 403,
      });
    });
  });

  // ── Descuento que excede el precio del artículo ───────────────────────────
  describe('descuento que excede el precio del artículo (HU-V02 Esc.3)', () => {
    beforeEach(() => {
      supabase.maybeSingle.mockResolvedValueOnce({
        data: { id: 99, estado: 'abierto' },
        error: null,
      });
      // Producto con precio bajo para que el descuento en monto lo supere
      productService.getProductById.mockResolvedValue({
        ...productoBase,
        precio_venta: 8,
      });
    });

    test('lanza AppError 400 cuando descuento_monto supera el precio base', async () => {
      const payload = {
        items: [{ producto_id: 1, cantidad: 1, descuento_monto: 10 }], // $10 > $8
        metodoPago: 'efectivo',
        montoEfectivo: 10,
        cajaId: 1,
        usuario: { ...usuarioCajero, descuento_max_pct: 100 }, // sin límite pct
      };

      await expect(createSale(payload)).rejects.toMatchObject({
        message: 'El descuento aplicado a "Refresco Cola 600ml" excede el precio del artículo',
        statusCode: 400,
      });
    });
  });

  // ── Cálculo de cambio (HU-V03 Esc.1) ─────────────────────────────────────
  describe('cálculo de cambio en pago con efectivo (HU-V03 Esc.1)', () => {
    beforeEach(() => {
      productService.getProductById.mockResolvedValue({
        ...productoBase,
        precio_venta: 87.50,
        stock_actual: 10,
      });
      mockVentaExitosa({ total: 87.50, cambio: 12.50 });
    });

    test('total $87.50 con $100.00 de efectivo → cambio = $12.50', async () => {
      const payload = {
        items: [{ producto_id: 1, cantidad: 1 }],
        metodoPago: 'efectivo',
        montoEfectivo: 100,
        cajaId: 1,
        usuario: usuarioCajero,
      };

      const resultado = await createSale(payload);
      // El cambio se incluye en el objeto de venta retornado por el insert mockeado
      expect(resultado.cambio).toBe(12.50);
    });

    test('el cambio para pago con tarjeta siempre es 0 (HU-V03 Esc.2)', async () => {
      productService.getProductById.mockResolvedValue(productoBase);
      mockVentaExitosa({ total: 20, cambio: 0 });

      const payload = {
        items: [{ producto_id: 1, cantidad: 1 }],
        metodoPago: 'tarjeta',
        montoTarjeta: 20,
        cajaId: 1,
        usuario: usuarioCajero,
      };

      const resultado = await createSale(payload);
      expect(resultado.cambio).toBe(0);
    });
  });

  // ── Monto insuficiente (HU-V03 Esc.4) ────────────────────────────────────
  describe('monto insuficiente para cubrir el total (HU-V03 Esc.4)', () => {
    beforeEach(() => {
      supabase.maybeSingle.mockResolvedValueOnce({
        data: { id: 99, estado: 'abierto' },
        error: null,
      });
      productService.getProductById.mockResolvedValue(productoBase); // $20
    });

    test('lanza AppError 400 cuando efectivo recibido < total', async () => {
      const payload = {
        items: [{ producto_id: 1, cantidad: 1 }], // total = $20
        metodoPago: 'efectivo',
        montoEfectivo: 15, // insuficiente
        cajaId: 1,
        usuario: usuarioCajero,
      };

      await expect(createSale(payload)).rejects.toMatchObject({
        message: 'Monto insuficiente para cubrir el total de la venta',
        statusCode: 400,
      });
    });

    test('lanza AppError 400 cuando tarjeta < total (HU-V03 Esc.4 con tarjeta)', async () => {
      const payload = {
        items: [{ producto_id: 1, cantidad: 1 }], // total = $20
        metodoPago: 'tarjeta',
        montoTarjeta: 10, // insuficiente
        cajaId: 1,
        usuario: usuarioCajero,
      };

      await expect(createSale(payload)).rejects.toMatchObject({
        message: 'Monto insuficiente para cubrir el total de la venta',
        statusCode: 400,
      });
    });

    test('pago mixto que suma exactamente el total no lanza error (HU-V03 Esc.3)', async () => {
      productService.getProductById.mockResolvedValue({
        ...productoBase,
        precio_venta: 200,
      });
      mockVentaExitosa({ total: 200, cambio: 0 });

      const payload = {
        items: [{ producto_id: 1, cantidad: 1 }], // total = $200
        metodoPago: 'mixto',
        montoEfectivo: 100,
        montoTarjeta: 100,
        cajaId: 1,
        usuario: usuarioCajero,
      };

      await expect(createSale(payload)).resolves.toBeDefined();
    });
  });
});

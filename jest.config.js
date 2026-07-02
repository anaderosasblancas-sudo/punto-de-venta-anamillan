// Configuración de Jest para el backend del POS Minisuper.
// Los tests viven en __tests__/ y usan jest.mock() para aislar
// Supabase y los servicios internos sin tocar la base de datos real.
module.exports = {
  // Entorno de ejecución: Node.js (no browser)
  testEnvironment: 'node',

  // Dónde buscar los archivos de prueba
  testMatch: ['**/__tests__/**/*.test.js'],

  // Transformador: babel-jest procesa los archivos antes de que Jest los ejecute.
  // Con CommonJS puro esto es opcional, pero es necesario si el proyecto
  // migra a ES modules ("type": "module" en package.json).
  transform: {
    '^.+\\.js$': 'babel-jest',
  },

  // Limpiar mocks automáticamente entre tests para evitar contaminación
  clearMocks: true,

  // Mostrar cada test individual en la salida (útil para CI)
  verbose: true,

  // Tiempo máximo por test antes de considerar timeout (ms)
  testTimeout: 10000,
};

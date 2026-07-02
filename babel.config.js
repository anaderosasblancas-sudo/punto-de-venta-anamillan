// Configuración de Babel para Jest.
// El proyecto usa CommonJS (require/module.exports), pero se incluye esta
// configuración porque fue solicitada expresamente y también cubre el caso
// en que el proyecto migre a ES modules ("type": "module" en package.json).
// Con CommonJS puro, Jest funciona sin Babel; con ES modules, es obligatorio.
module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        // "current" le dice a Babel que compile para la versión de Node
        // que está corriendo los tests, evitando transformaciones innecesarias.
        targets: { node: 'current' },
      },
    ],
  ],
};

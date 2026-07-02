// Punto de entrada del servidor. Carga la app de Express y la levanta
// en el puerto definido por la variable de entorno PORT.
require('dotenv').config();
const app = require('./app');

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Servidor backend escuchando en el puerto ${PORT}`);
});

// Redondea un valor monetario a 2 decimales, evitando errores de punto
// flotante típicos de JavaScript (ej. 0.1 + 0.2 !== 0.3).
function round2(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

module.exports = { round2 };

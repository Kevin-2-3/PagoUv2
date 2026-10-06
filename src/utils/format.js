/**
 * @file Conversión y formato de importes monetarios.
 */
/**
 * Convierte centavos a una cantidad con formato monetario mexicano.
 * @param {number} cents - Importe en centavos; un valor vacío se interpreta como cero.
 * @returns {string} Importe expresado en pesos mexicanos.
 */
function money(cents) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format((cents || 0) / 100);
}
/**
 * Convierte una cantidad en pesos a centavos, redondeando al entero más cercano.
 * @param {number|string} value - Cantidad que se desea convertir.
 * @returns {number|null} Centavos, o null si el valor no es finito o es negativo.
 */
function toCents(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return null;
  return Math.round(number * 100);
}
module.exports = { money, toCents };

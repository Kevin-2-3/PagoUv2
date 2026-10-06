/**
 * @file Operaciones y validaciones de turnos y cortes de caja.
 */
const { getDb } = require("../database/db");
const { AppError } = require("../utils/errors");
/**
 * Valida un monto no negativo con hasta dos decimales y lo convierte a centavos.
 * @param {string|number} value - Monto en pesos.
 * @returns {number} Monto en centavos.
 * @throws {AppError} Si el monto, la fecha o el estado del turno no permite la operación.
 */
function amount(value) {
  if (!/^(0|[1-9]\d{0,8})(\.\d{1,2})?$/.test(String(value ?? "")))
    throw new AppError("Ingresa un monto válido con máximo dos decimales");
  return Math.round(Number(value) * 100);
}
/**
 * Consulta el turno abierto de un usuario.
 * @param {number|string} userId - Identificador del usuario.
 * @returns {Object|undefined} Turno abierto o undefined.
 */
function current(userId) {
  return getDb()
    .prepare("SELECT * FROM cash_shifts WHERE cashier_id=? AND closed_at IS NULL")
    .get(userId);
}
/**
 * Abre un turno y registra el fondo inicial en una transacción.
 * @param {number|string} userId - Usuario que abre la caja.
 * @param {string|number} value - Fondo inicial en pesos.
 * @returns {number|bigint} Identificador del turno.
 * @throws {AppError} Si el monto, la fecha o el estado del turno no permite la operación.
 */
function open(userId, value) {
  const cents = amount(value),
    db = getDb();
  return db.transaction(() => {
    if (current(userId)) throw new AppError("Ya tienes un turno abierto");
    return db
      .prepare("INSERT INTO cash_shifts(cashier_id,opening_cents) VALUES (?,?)")
      .run(userId, cents).lastInsertRowid;
  })();
}
/**
 * Suma las ventas completadas del turno por método de pago.
 * @param {number|string} shiftId - Identificador del turno.
 * @returns {{cash: number, card: number}} Totales de efectivo y tarjeta en centavos.
 */
function totals(shiftId) {
  return getDb()
    .prepare(
      `SELECT COALESCE(SUM(CASE WHEN payment_method='EFECTIVO' THEN total_cents ELSE 0 END),0) cash, COALESCE(SUM(CASE WHEN payment_method='TARJETA' THEN total_cents ELSE 0 END),0) card FROM sales WHERE shift_id=? AND status='COMPLETADA'`,
    )
    .get(shiftId);
}
/**
 * Cierra el turno y guarda el efectivo contado, esperado y los totales de ventas.
 * @param {number|string} userId - Usuario que cierra su caja.
 * @param {string|number} value - Efectivo contado en pesos.
 * @returns {void} No devuelve un valor.
 * @throws {AppError} Si el monto, la fecha o el estado del turno no permite la operación.
 */
function close(userId, value) {
  const counted = amount(value),
    db = getDb();
  return db.transaction(() => {
    const shift = current(userId);
    if (!shift) throw new AppError("No tienes un turno abierto");
    const sums = totals(shift.id);
    db.prepare(
      "UPDATE cash_shifts SET closed_at=CURRENT_TIMESTAMP,counted_cents=?,expected_cents=?,cash_cents=?,card_cents=? WHERE id=?",
    ).run(counted, shift.opening_cents + sums.cash, sums.cash, sums.card, shift.id);
  })();
}
/**
 * Genera el corte diario usando un desplazamiento de seis horas respecto a UTC.
 * @param {string} date - Fecha válida con formato YYYY-MM-DD.
 * @returns {{date: string, shifts: Object[], payments: Object[]}} Turnos y pagos del día; los importes están en centavos.
 * @throws {AppError} Si el monto, la fecha o el estado del turno no permite la operación.
 */
function report(date) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date || "") ||
    Number.isNaN(Date.parse(date)) ||
    new Date(date).toISOString().slice(0, 10) !== date
  )
    throw new AppError("Fecha inválida");
  const db = getDb();
  const shifts = db
    .prepare(
      `SELECT s.*,u.name cashier_name FROM cash_shifts s JOIN users u ON u.id=s.cashier_id WHERE date(s.opened_at,'-6 hours')=? ORDER BY s.id`,
    )
    .all(date)
    .map((s) => ({ ...s, ...totals(s.id) }));
  const payments = db
    .prepare(
      `SELECT payment_method,COUNT(*) count,SUM(total_cents) total FROM sales WHERE date(created_at,'-6 hours')=? AND status='COMPLETADA' GROUP BY payment_method`,
    )
    .all(date);
  return { date, shifts, payments };
}
module.exports = { amount, current, open, close, totals, report };

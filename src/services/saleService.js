/**
 * @file Operaciones y validaciones de ventas y cancelaciones.
 */
const { getDb } = require("../database/db");
const { AppError } = require("../utils/errors");
const { authorizeManager } = require("./authService");

const cash = require("./cashService");
const promotions = require("./promotionService");
/**
 * Registra una venta, aplica promociones y descuenta inventario en una sola transacción. Exige un turno abierto y agrupa productos repetidos; tarjeta representa un pago simulado.
 * @param {number} cashierId - Usuario que registra la venta.
 * @param {Array<{productId: number, quantity: number}>} rawItems - Productos y cantidades solicitadas.
 * @param {number|string} received - Efectivo recibido en pesos; se ignora para tarjeta.
 * @param {string} [paymentMethod="EFECTIVO"] - EFECTIVO o TARJETA.
 * @returns {{id: number, folio: string, total: number, receivedCents: number, changeCents: number, paymentMethod: string}} Resumen de la venta; todos los importes devueltos están en centavos.
 * @throws {AppError} Si los datos, el turno, las existencias o el pago son inválidos. La transacción revierte los cambios.
 */
function createSale(cashierId, rawItems, received, paymentMethod = "EFECTIVO") {
  if (!["EFECTIVO", "TARJETA"].includes(paymentMethod))
    throw new AppError("Método de pago inválido");
  if (!Array.isArray(rawItems) || !rawItems.length) throw new AppError("El ticket está vacío");
  const quantities = new Map();
  for (const item of rawItems) {
    const id = Number(item.productId),
      qty = Number(item.quantity);
    if (!Number.isInteger(id) || !Number.isInteger(qty) || qty <= 0)
      throw new AppError("El ticket contiene cantidades inválidas");
    quantities.set(id, (quantities.get(id) || 0) + qty);
  }
  const db = getDb();
  return db.transaction(() => {
    const shift = cash.current(cashierId);
    if (!shift) throw new AppError("Declara el fondo inicial para abrir tu turno");
    const details = [];
    for (const [id, quantity] of quantities) {
      const p = db.prepare("SELECT * FROM products WHERE id=?").get(id);
      if (!p) throw new AppError("Uno de los productos no existe");
      if (!p.active || p.deleted_at) throw new AppError(`El producto ${p.name} está inactivo`);
      if (p.stock < quantity)
        throw new AppError(`Stock insuficiente para ${p.name}. Disponible: ${p.stock}`);
      const priced = promotions.price(p);
      details.push({ ...priced, quantity, subtotal: priced.price_cents * quantity });
    }
    const total = details.reduce((sum, d) => sum + d.subtotal, 0);
    if (
      paymentMethod === "EFECTIVO" &&
      !/^(0|[1-9]\d{0,8})(\.\d{1,2})?$/.test(String(received ?? ""))
    ) {
      throw new AppError("Ingresa un monto recibido válido con máximo dos decimales");
    }
    const receivedCents = paymentMethod === "TARJETA" ? total : Math.round(Number(received) * 100);
    if (receivedCents < total) {
      throw new AppError(
        `Efectivo insuficiente. Faltan $${((total - receivedCents) / 100).toFixed(2)}`,
      );
    }
    const changeCents = receivedCents - total;
    const saleId = Number(
      db
        .prepare(
          "INSERT INTO sales(cashier_id,subtotal_cents,total_cents,received_cents,change_cents,payment_method,shift_id) VALUES (?,?,?,?,?,?,?)",
        )
        .run(
          cashierId,
          details.reduce((sum, d) => sum + d.original_price_cents * d.quantity, 0),
          total,
          receivedCents,
          changeCents,
          paymentMethod,
          shift.id,
        ).lastInsertRowid,
    );
    const folio = `PUV-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${String(saleId).padStart(6, "0")}`;
    db.prepare("UPDATE sales SET folio=? WHERE id=?").run(folio, saleId);
    const addDetail = db.prepare(
      "INSERT INTO sale_details(sale_id,product_id,product_code,product_name,unit_price_cents,quantity,subtotal_cents,original_price_cents,promotion_name) VALUES (?,?,?,?,?,?,?,?,?)",
    );
    const takeStock = db.prepare(
      "UPDATE products SET stock=stock-?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND stock>=?",
    );
    for (const d of details) {
      if (takeStock.run(d.quantity, d.id, d.quantity).changes !== 1)
        throw new AppError(`No fue posible reservar stock de ${d.name}`);
      addDetail.run(
        saleId,
        d.id,
        d.code,
        d.name,
        d.price_cents,
        d.quantity,
        d.subtotal,
        d.original_price_cents,
        d.promotion_name,
      );
    }
    return { id: saleId, folio, total, receivedCents, changeCents, paymentMethod };
  })();
}
/**
 * Consulta ventas por folio y, opcionalmente, por cajero.
 * @param {Object} [filters={}] - Filtros de consulta.
 * @param {string} [filters.folio] - Parte del folio a buscar.
 * @param {number} [filters.cashierId] - Identificador del cajero.
 * @returns {Object[]} Ventas desde la más reciente, con el nombre del cajero.
 */
function list(filters = {}) {
  const params = [];
  let where = "WHERE 1=1";
  if (filters.folio) {
    where += " AND s.folio LIKE ?";
    params.push(`%${filters.folio}%`);
  }
  if (filters.cashierId) {
    where += " AND s.cashier_id=?";
    params.push(filters.cashierId);
  }
  return getDb()
    .prepare(
      `SELECT s.*,u.name cashier_name FROM sales s JOIN users u ON u.id=s.cashier_id ${where} ORDER BY s.id DESC`,
    )
    .all(...params);
}
/**
 * Obtiene una venta con sus partidas y los datos de cancelación.
 * @param {number|string} id - Identificador del registro.
 * @returns {Object} Venta con details y cancellation, que puede ser null.
 * @throws {AppError} Si no existe la venta (404).
 */
function get(id) {
  const db = getDb();
  const sale = db
    .prepare(
      "SELECT s.*,u.name cashier_name FROM sales s JOIN users u ON u.id=s.cashier_id WHERE s.id=?",
    )
    .get(id);
  if (!sale) throw new AppError("Venta no encontrada", 404);
  sale.details = db.prepare("SELECT * FROM sale_details WHERE sale_id=?").all(id);
  sale.cancellation =
    db
      .prepare(
        "SELECT c.*,r.name requested_name,a.name authorized_name FROM sale_cancellations c JOIN users r ON r.id=c.requested_by JOIN users a ON a.id=c.authorized_by WHERE c.sale_id=?",
      )
      .get(id) || null;
  return sale;
}
/**
 * Autoriza la cancelación con un gerente, restaura las existencias y registra la operación en una transacción.
 * @param {number|string} saleId - Venta que se desea cancelar.
 * @param {number} requesterId - Usuario que solicita la cancelación.
 * @param {string} managerUsername - Usuario del gerente.
 * @param {string} managerPin - PIN del gerente.
 * @param {string} [reason=""] - Motivo de la cancelación.
 * @returns {void} No devuelve un valor.
 * @throws {AppError} Si la autorización es inválida, no existe la venta, ya se canceló o su turno está cerrado.
 */
function cancelSale(saleId, requesterId, managerUsername, managerPin, reason = "") {
  const manager = authorizeManager(managerUsername, managerPin);
  const db = getDb();
  return db.transaction(() => {
    const sale = db.prepare("SELECT * FROM sales WHERE id=?").get(saleId);
    if (!sale) throw new AppError("Venta no encontrada", 404);
    if (
      sale.shift_id &&
      db.prepare("SELECT closed_at FROM cash_shifts WHERE id=?").get(sale.shift_id)?.closed_at
    )
      throw new AppError("El turno ya fue cerrado; no se puede cancelar esta venta");
    if (sale.status === "CANCELADA") throw new AppError("La venta ya fue cancelada");
    const details = db
      .prepare("SELECT product_id,quantity FROM sale_details WHERE sale_id=?")
      .all(saleId);
    for (const d of details)
      db.prepare("UPDATE products SET stock=stock+?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(
        d.quantity,
        d.product_id,
      );
    db.prepare("UPDATE sales SET status='CANCELADA' WHERE id=?").run(saleId);
    db.prepare(
      "INSERT INTO sale_cancellations(sale_id,requested_by,authorized_by,reason) VALUES (?,?,?,?)",
    ).run(saleId, requesterId, manager.id, String(reason || "").trim());
  })();
}
/**
 * Resume productos activos, existencias bajas y ventas completadas y canceladas.
 * @returns {{products: number, lowStock: number, sales: number, cancelled: number, total: number}} Conteos y total de ventas completadas en centavos; existencias bajas significa stock menor o igual a cinco.
 */
function dashboard() {
  const db = getDb();
  return {
    products: db.prepare("SELECT COUNT(*) n FROM products WHERE active=1").get().n,
    lowStock: db.prepare("SELECT COUNT(*) n FROM products WHERE active=1 AND stock<=5").get().n,
    sales: db.prepare("SELECT COUNT(*) n FROM sales WHERE status='COMPLETADA'").get().n,
    cancelled: db.prepare("SELECT COUNT(*) n FROM sales WHERE status='CANCELADA'").get().n,
    total: db
      .prepare("SELECT COALESCE(SUM(total_cents),0) n FROM sales WHERE status='COMPLETADA'")
      .get().n,
  };
}
module.exports = { createSale, list, get, cancelSale, dashboard };

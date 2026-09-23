const { getDb } = require("../database/db");
const { AppError } = require("../utils/errors");
const { authorizeManager } = require("./authService");

function createSale(cashierId, rawItems) {
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
    const details = [];
    for (const [id, quantity] of quantities) {
      const p = db.prepare("SELECT * FROM products WHERE id=?").get(id);
      if (!p) throw new AppError("Uno de los productos no existe");
      if (!p.active) throw new AppError(`El producto ${p.name} está inactivo`);
      if (p.stock < quantity)
        throw new AppError(`Stock insuficiente para ${p.name}. Disponible: ${p.stock}`);
      details.push({ ...p, quantity, subtotal: p.price_cents * quantity });
    }
    const total = details.reduce((sum, d) => sum + d.subtotal, 0);
    const saleId = Number(
      db
        .prepare("INSERT INTO sales(cashier_id,subtotal_cents,total_cents) VALUES (?,?,?)")
        .run(cashierId, total, total).lastInsertRowid,
    );
    const folio = `PUV-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${String(saleId).padStart(6, "0")}`;
    db.prepare("UPDATE sales SET folio=? WHERE id=?").run(folio, saleId);
    const addDetail = db.prepare(
      "INSERT INTO sale_details(sale_id,product_id,product_code,product_name,unit_price_cents,quantity,subtotal_cents) VALUES (?,?,?,?,?,?,?)",
    );
    const takeStock = db.prepare(
      "UPDATE products SET stock=stock-?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND stock>=?",
    );
    for (const d of details) {
      if (takeStock.run(d.quantity, d.id, d.quantity).changes !== 1)
        throw new AppError(`No fue posible reservar stock de ${d.name}`);
      addDetail.run(saleId, d.id, d.code, d.name, d.price_cents, d.quantity, d.subtotal);
    }
    return { id: saleId, folio, total };
  })();
}
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
function cancelSale(saleId, requesterId, managerUsername, managerPin, reason = "") {
  const manager = authorizeManager(managerUsername, managerPin);
  const db = getDb();
  return db.transaction(() => {
    const sale = db.prepare("SELECT * FROM sales WHERE id=?").get(saleId);
    if (!sale) throw new AppError("Venta no encontrada", 404);
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

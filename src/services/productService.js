const { getDb } = require("../database/db");
const { AppError } = require("../utils/errors");
const { toCents } = require("../utils/format");
function list(search = "", onlyActive = false) {
  const term = `%${String(search).trim()}%`;
  return getDb()
    .prepare(
      `SELECT p.*, c.name category_name FROM products p JOIN categories c ON c.id=p.category_id WHERE (p.code LIKE ? OR p.name LIKE ?) ${onlyActive ? "AND p.active=1" : ""} ORDER BY p.name`,
    )
    .all(term, term);
}
function get(id) {
  return getDb().prepare("SELECT * FROM products WHERE id=?").get(id);
}
function validate(data) {
  const code = String(data.code || "").trim();
  const name = String(data.name || "").trim();
  const price = toCents(data.price);
  const stock = Number(data.stock);
  const categoryId = Number(data.category_id);
  if (!code || !name) throw new AppError("Código y nombre son obligatorios");
  if (price === null) throw new AppError("El precio debe ser mayor o igual a cero");
  if (!Number.isInteger(stock) || stock < 0)
    throw new AppError("La existencia debe ser un entero mayor o igual a cero");
  if (!getDb().prepare("SELECT id FROM categories WHERE id=? AND active=1").get(categoryId))
    throw new AppError("Categoría inválida");
  return {
    code,
    name,
    description: String(data.description || "").trim(),
    price,
    stock,
    categoryId,
  };
}
function create(data) {
  const v = validate(data);
  try {
    return getDb()
      .prepare(
        "INSERT INTO products(code,name,description,price_cents,stock,category_id) VALUES (?,?,?,?,?,?)",
      )
      .run(v.code, v.name, v.description, v.price, v.stock, v.categoryId).lastInsertRowid;
  } catch (e) {
    if (e.code === "SQLITE_CONSTRAINT_UNIQUE")
      throw new AppError("El código de producto ya existe");
    throw e;
  }
}
function update(id, data) {
  if (!get(id)) throw new AppError("Producto no encontrado", 404);
  const v = validate(data);
  try {
    getDb()
      .prepare(
        "UPDATE products SET code=?,name=?,description=?,price_cents=?,stock=?,category_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
      )
      .run(v.code, v.name, v.description, v.price, v.stock, v.categoryId, id);
  } catch (e) {
    if (e.code === "SQLITE_CONSTRAINT_UNIQUE")
      throw new AppError("El código de producto ya existe");
    throw e;
  }
}
function toggle(id) {
  const p = get(id);
  if (!p) throw new AppError("Producto no encontrado", 404);
  getDb()
    .prepare("UPDATE products SET active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?")
    .run(p.active ? 0 : 1, id);
}
module.exports = { list, get, create, update, toggle };

/**
 * @file Operaciones y validaciones de productos e inventario.
 */
const { getDb } = require("../database/db");
const { AppError } = require("../utils/errors");
const { toCents } = require("../utils/format");
/**
 * Consulta los productos no eliminados, ordenados por nombre.
 * @param {string} [search=""] - Texto que se busca en el código o nombre.
 * @param {boolean} [onlyActive=false] - Indica si se incluyen únicamente productos activos.
 * @returns {Object[]} Registros encontrados, sin las contraseñas de los empleados.
 */
function list(search = "", onlyActive = false) {
  const term = `%${String(search).trim()}%`;
  return getDb()
    .prepare(
      `SELECT p.id,p.code,p.name,p.description,p.price_cents,p.stock,p.category_id,p.active, c.name category_name FROM products p JOIN categories c ON c.id=p.category_id WHERE p.deleted_at IS NULL AND (p.code LIKE ? OR p.name LIKE ?) ${onlyActive ? "AND p.active=1" : ""} ORDER BY p.name`,
    )
    .all(term, term);
}
/**
 * Busca un producto que no tenga una eliminación lógica.
 * @param {number|string} id - Identificador del registro.
 * @returns {Object|undefined} Registro encontrado o undefined si no existe.
 */
function get(id) {
  return getDb().prepare("SELECT * FROM products WHERE id=? AND deleted_at IS NULL").get(id);
}
/**
 * Comprueba y normaliza los datos del producto.
 * @param {Object} data - Datos recibidos del formulario.
 * @returns {Object} Datos normalizados; el precio del producto queda en centavos.
 * @throws {AppError} Si faltan datos o algún valor no es válido.
 */
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
/**
 * Valida y registra un nuevo producto. La imagen se almacena como un búfer WebP.
 * @param {Object} data - Datos recibidos del formulario.
 * @param {Buffer|null} [image=null] - Imagen procesada del producto.
 * @returns {number|bigint} Identificador generado por SQLite.
 * @throws {AppError} Si los datos son inválidos o el código o usuario ya existe.
 */
function create(data, image = null) {
  const v = validate(data);
  try {
    return getDb()
      .prepare(
        "INSERT INTO products(code,name,description,price_cents,stock,category_id,image_data) VALUES (?,?,?,?,?,?,?)",
      )
      .run(v.code, v.name, v.description, v.price, v.stock, v.categoryId, image).lastInsertRowid;
  } catch (e) {
    if (e.code === "SQLITE_CONSTRAINT_UNIQUE")
      throw new AppError("El código de producto ya existe");
    throw e;
  }
}
/**
 * Actualiza un producto existente. Conserva la imagen actual si no se recibe una nueva.
 * @param {number|string} id - Identificador del registro.
 * @param {Object} data - Datos recibidos del formulario.
 * @param {Buffer|null} [image=null] - Nueva imagen WebP, si se desea sustituirla.
 * @returns {void} No devuelve un valor.
 * @throws {AppError} Si el registro no existe, los datos son inválidos o hay un duplicado.
 */
function update(id, data, image = null) {
  if (!get(id)) throw new AppError("Producto no encontrado", 404);
  const v = validate(data);
  try {
    getDb()
      .prepare(
        "UPDATE products SET code=?,name=?,description=?,price_cents=?,stock=?,category_id=?,image_data=COALESCE(?,image_data),updated_at=CURRENT_TIMESTAMP WHERE id=?",
      )
      .run(v.code, v.name, v.description, v.price, v.stock, v.categoryId, image, id);
  } catch (e) {
    if (e.code === "SQLITE_CONSTRAINT_UNIQUE")
      throw new AppError("El código de producto ya existe");
    throw e;
  }
}
/**
 * Alterna el estado activo e inactivo del producto.
 * @param {number|string} id - Identificador del registro.
 * @returns {void} No devuelve un valor.
 * @throws {AppError} Si el registro no existe o la operación no está permitida.
 */
function toggle(id) {
  const p = get(id);
  if (!p) throw new AppError("Producto no encontrado", 404);
  getDb()
    .prepare("UPDATE products SET active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?")
    .run(p.active ? 0 : 1, id);
}
/**
 * Realiza una eliminación lógica y desactiva el acceso o la venta, conservando el historial del producto.
 * @param {number|string} id - Identificador del registro.
 * @returns {void} No devuelve un valor.
 * @throws {AppError} Si el registro no existe o la operación no está permitida.
 */
function remove(id) {
  if (!get(id)) throw new AppError("Producto no encontrado", 404);
  getDb()
    .prepare(
      "UPDATE products SET active=0,deleted_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?",
    )
    .run(id);
}
/**
 * Agrega existencias al inventario sin reemplazar la cantidad actual.
 * @param {number|string} id - Identificador del registro.
 * @param {number|string} rawQuantity - Cantidad entera entre 1 y 1000000.
 * @returns {void} No devuelve un valor.
 * @throws {AppError} Si la cantidad es inválida o el producto no existe.
 */
function addStock(id, rawQuantity) {
  const quantity = Number(rawQuantity);
  if (!Number.isSafeInteger(quantity) || quantity <= 0 || quantity > 1000000) {
    throw new AppError("La cantidad a agregar debe ser un entero entre 1 y 1000000");
  }
  if (!get(id)) throw new AppError("Producto no encontrado", 404);
  getDb()
    .prepare(
      "UPDATE products SET stock=stock+?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND deleted_at IS NULL",
    )
    .run(quantity, id);
}
module.exports = { list, get, create, update, toggle, remove, addStock };

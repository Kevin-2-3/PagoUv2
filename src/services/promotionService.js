/**
 * @file Operaciones y validaciones de promociones y descuentos.
 */
const { getDb } = require("../database/db");
const { AppError } = require("../utils/errors");
/**
 * Obtiene la fecha actual de Ciudad de México.
 * @returns {string} Fecha con formato YYYY-MM-DD.
 */
function today() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
/**
 * Aplica la promoción vigente de mayor porcentaje; en empate usa la de menor identificador. No modifica el objeto original.
 * @param {Object} product - Producto con id y price_cents.
 * @returns {Object} Copia con precio final y original en centavos y nombre de promoción o null.
 */
function price(product) {
  const date = today();
  const promo = getDb()
    .prepare(
      `SELECT p.* FROM promotions p JOIN promotion_products pp ON pp.promotion_id=p.id WHERE pp.product_id=? AND p.active=1 AND p.starts_on<=? AND p.ends_on>=? ORDER BY p.percent DESC,p.id LIMIT 1`,
    )
    .get(product.id, date, date);
  return {
    ...product,
    original_price_cents: product.price_cents,
    price_cents: promo
      ? Math.round((product.price_cents * (100 - promo.percent)) / 100)
      : product.price_cents,
    promotion_name: promo?.name || null,
  };
}
/**
 * Consulta las promociones, desde la más reciente.
 * @returns {Object[]} Promociones registradas.
 */
function list() {
  return getDb().prepare("SELECT * FROM promotions ORDER BY id DESC").all();
}
/**
 * Valida la promoción y la vincula a productos dentro de una transacción.
 * @param {Object} data - Datos recibidos del formulario.
 * @param {string} data.name - Nombre de hasta 100 caracteres.
 * @param {number|string} data.percent - Descuento entero de 1 a 100.
 * @param {string} data.starts_on - Inicio con formato YYYY-MM-DD.
 * @param {string} data.ends_on - Fin igual o posterior al inicio.
 * @param {Array<number|string>|number|string} data.products - Identificadores de productos no eliminados.
 * @returns {number|bigint} Identificador de la promoción.
 * @throws {AppError} Si los datos o productos no son válidos.
 */
function create(data) {
  const name = String(data.name || "").trim();
  const percent = Number(data.percent);
  /**
   * Comprueba el formato y la existencia de una fecha del calendario.
   * @param {string} value - Fecha a comprobar.
   * @returns {boolean} true si la fecha tiene el formato YYYY-MM-DD y existe.
   */
  const validDate = (value) =>
    /^\d{4}-\d{2}-\d{2}$/.test(value || "") &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value;
  const ids = [
    ...new Set((Array.isArray(data.products) ? data.products : [data.products]).map(Number)),
  ];
  if (
    !name ||
    name.length > 100 ||
    !Number.isInteger(percent) ||
    percent < 1 ||
    percent > 100 ||
    !validDate(data.starts_on) ||
    !validDate(data.ends_on) ||
    data.starts_on > data.ends_on ||
    !ids.length ||
    ids.some((id) => !Number.isInteger(id))
  )
    throw new AppError("Revisa el nombre, descuento, fechas y productos de la promoción");
  const db = getDb();
  return db.transaction(() => {
    for (const id of ids)
      if (!db.prepare("SELECT id FROM products WHERE id=? AND deleted_at IS NULL").get(id))
        throw new AppError("Producto inválido");
    const id = db
      .prepare("INSERT INTO promotions(name,percent,starts_on,ends_on) VALUES (?,?,?,?)")
      .run(name, percent, data.starts_on, data.ends_on).lastInsertRowid;
    for (const product of ids)
      db.prepare("INSERT INTO promotion_products VALUES (?,?)").run(id, product);
    return id;
  })();
}
/**
 * Alterna el estado activo de una promoción.
 * @param {number|string} id - Identificador del registro.
 * @returns {void} No devuelve un valor.
 * @throws {AppError} Si la promoción no existe.
 */
function toggle(id) {
  if (!getDb().prepare("UPDATE promotions SET active=1-active WHERE id=?").run(id).changes)
    throw new AppError("Promoción no encontrada", 404);
}
module.exports = { today, price, list, create, toggle };

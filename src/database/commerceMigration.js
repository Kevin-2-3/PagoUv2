/**
 * @file Gestión de la migración de caja y promociones.
 */
/**
 * Crea las tablas de caja y promociones y añade las columnas comerciales que falten.
 * @param {import("better-sqlite3").Database} db - Conexión sobre la que se aplica la migración.
 * @returns {void} No devuelve un valor.
 */
function migrateCommerce(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS cash_shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cashier_id INTEGER NOT NULL REFERENCES users(id),
      opening_cents INTEGER NOT NULL CHECK(opening_cents >= 0),
      opened_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      closed_at TEXT,
      counted_cents INTEGER,
      expected_cents INTEGER,
      cash_cents INTEGER,
      card_cents INTEGER
    );
    CREATE UNIQUE INDEX IF NOT EXISTS one_open_shift ON cash_shifts(cashier_id) WHERE closed_at IS NULL;
    CREATE TABLE IF NOT EXISTS promotions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      percent INTEGER NOT NULL CHECK(percent BETWEEN 1 AND 100),
      starts_on TEXT NOT NULL,
      ends_on TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1))
    );
    CREATE TABLE IF NOT EXISTS promotion_products (
      promotion_id INTEGER NOT NULL REFERENCES promotions(id),
      product_id INTEGER NOT NULL REFERENCES products(id),
      PRIMARY KEY(promotion_id,product_id)
    );
  `);
  for (const [table, column, definition] of [
    [
      "sales",
      "payment_method",
      "TEXT NOT NULL DEFAULT 'EFECTIVO' CHECK(payment_method IN ('EFECTIVO','TARJETA'))",
    ],
    ["sales", "shift_id", "INTEGER REFERENCES cash_shifts(id)"],
    ["sale_details", "original_price_cents", "INTEGER"],
    ["sale_details", "promotion_name", "TEXT"],
  ]) {
    if (
      !db
        .prepare(`PRAGMA table_info(${table})`)
        .all()
        .some((c) => c.name === column)
    )
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}
module.exports = { migrateCommerce };

/**
 * @file Gestión de las columnas para bajas lógicas y cobros.
 */
/**
 * Añade columnas de eliminación lógica, efectivo recibido y cambio si todavía no existen.
 * @param {import("better-sqlite3").Database} db - Conexión sobre la que se aplica la migración.
 * @returns {void} No devuelve un valor.
 */
function migrateOperations(db) {
  for (const [table, column, definition] of [
    ["users", "deleted_at", "TEXT"],
    ["products", "deleted_at", "TEXT"],
    ["sales", "received_cents", "INTEGER CHECK(received_cents >= 0)"],
    ["sales", "change_cents", "INTEGER CHECK(change_cents >= 0)"],
  ]) {
    if (
      !db
        .prepare(`PRAGMA table_info(${table})`)
        .all()
        .some((c) => c.name === column)
    ) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  }
}
module.exports = { migrateOperations };

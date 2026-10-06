/**
 * @file Gestión de la conexión compartida a SQLite.
 */
const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const env = require("../config/env");

let instance;
/**
 * Abre una conexión SQLite compartida y activa las claves foráneas y el modo WAL.
 * @returns {import("better-sqlite3").Database} Conexión reutilizada por los servicios.
 */
function getDb() {
  if (!instance) {
    fs.mkdirSync(path.dirname(env.databasePath), { recursive: true });
    instance = new Database(env.databasePath);
    instance.pragma("foreign_keys = ON");
    instance.pragma("journal_mode = WAL");
    instance.pragma("busy_timeout = 5000");
  }
  return instance;
}
/**
 * Cierra la conexión compartida, si existe, y permite abrirla de nuevo.
 * @returns {void} No devuelve un valor.
 */
function closeDb() {
  if (instance) {
    instance.close();
    instance = null;
  }
}
module.exports = { getDb, closeDb };

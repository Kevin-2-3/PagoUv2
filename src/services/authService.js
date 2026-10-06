/**
 * @file Operaciones y validaciones de autenticación.
 */
const bcrypt = require("bcryptjs");
const { getDb } = require("../database/db");
const { AppError } = require("../utils/errors");
/**
 * Comprueba las credenciales y que la cuenta esté activa.
 * @param {string} username - Nombre de usuario.
 * @param {string} password - Contraseña ingresada.
 * @returns {{id: number, name: string, username: string, role: string}} Datos del usuario para la sesión, sin hashes.
 * @throws {AppError} Con estado 401 para credenciales incorrectas o 403 para cuenta inactiva.
 */
function login(username, password) {
  const user = getDb()
    .prepare("SELECT * FROM users WHERE username = ? AND deleted_at IS NULL")
    .get(String(username || "").trim());
  if (!user || !bcrypt.compareSync(String(password || ""), user.password_hash))
    throw new AppError("Usuario o contraseña incorrectos", 401);
  if (!user.active) throw new AppError("La cuenta está desactivada", 403);
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
  };
}
/**
 * Verifica el usuario y PIN de un gerente activo y no eliminado.
 * @param {string} username - Usuario del gerente.
 * @param {string} pin - PIN de autorización.
 * @returns {Object} Registro del gerente que autoriza la operación.
 * @throws {AppError} Si la autorización es inválida (403).
 */
function authorizeManager(username, pin) {
  const user = getDb()
    .prepare(
      "SELECT * FROM users WHERE username=? AND role='GERENTE' AND active=1 AND deleted_at IS NULL",
    )
    .get(String(username || "").trim());
  if (
    !user ||
    !user.manager_pin_hash ||
    !bcrypt.compareSync(String(pin || ""), user.manager_pin_hash)
  )
    throw new AppError("Autorización de gerente inválida", 403);
  return user;
}
module.exports = { login, authorizeManager };

/**
 * @file Operaciones y validaciones de empleados y roles.
 */
const bcrypt = require("bcryptjs");
const { getDb } = require("../database/db");
const { AppError } = require("../utils/errors");
const ROLES = ["GERENTE", "ADMINISTRADOR", "CAJERO"];
/**
 * Consulta los empleados no eliminados, ordenados por nombre.
 * @returns {Object[]} Registros encontrados, sin las contraseñas de los empleados.
 */
function list() {
  return getDb()
    .prepare(
      "SELECT id,name,username,role,active,created_at FROM users WHERE deleted_at IS NULL ORDER BY name",
    )
    .all();
}
/**
 * Busca un empleado que no tenga una eliminación lógica.
 * @param {number|string} id - Identificador del registro.
 * @returns {Object|undefined} Registro encontrado o undefined si no existe.
 */
function get(id) {
  return getDb()
    .prepare("SELECT id,name,username,role,active FROM users WHERE id=? AND deleted_at IS NULL")
    .get(id);
}
/**
 * Comprueba y normaliza los datos del empleado.
 * @param {Object} data - Datos recibidos del formulario.
 * @param {boolean} creating - Exige contraseña cuando se crea un empleado.
 * @returns {Object} Datos normalizados; el precio del producto queda en centavos.
 * @throws {AppError} Si faltan datos o algún valor no es válido.
 */
function validate(data, creating) {
  const name = String(data.name || "").trim(),
    username = String(data.username || "").trim(),
    password = String(data.password || ""),
    role = String(data.role || "");
  if (!name || !username || (creating && !password))
    throw new AppError("Nombre, usuario y contraseña son obligatorios");
  if (!ROLES.includes(role)) throw new AppError("Rol inválido");
  if (password && password.length < 8)
    throw new AppError("La contraseña debe tener al menos 8 caracteres");
  return { name, username, password, role };
}
/**
 * Valida y registra un nuevo empleado. Guarda la contraseña y el PIN del gerente como hashes.
 * @param {Object} data - Datos recibidos del formulario.
 * @returns {number|bigint} Identificador generado por SQLite.
 * @throws {AppError} Si los datos son inválidos o el código o usuario ya existe.
 */
function create(data) {
  const v = validate(data, true);
  try {
    return getDb()
      .prepare(
        "INSERT INTO users(name,username,password_hash,role,manager_pin_hash) VALUES (?,?,?,?,?)",
      )
      .run(
        v.name,
        v.username,
        bcrypt.hashSync(v.password, 10),
        v.role,
        v.role === "GERENTE" ? bcrypt.hashSync(String(data.pin || "2468"), 10) : null,
      ).lastInsertRowid;
  } catch (e) {
    if (e.code === "SQLITE_CONSTRAINT_UNIQUE") throw new AppError("El nombre de usuario ya existe");
    throw e;
  }
}
/**
 * Actualiza un empleado existente. Conserva la contraseña cuando el campo se deja vacío.
 * @param {number|string} id - Identificador del registro.
 * @param {Object} data - Datos recibidos del formulario.
 * @returns {void} No devuelve un valor.
 * @throws {AppError} Si el registro no existe, los datos son inválidos o hay un duplicado.
 */
function update(id, data) {
  const current = get(id);
  if (!current) throw new AppError("Usuario no encontrado", 404);
  const v = validate(data, false);
  try {
    if (v.password)
      getDb()
        .prepare(
          "UPDATE users SET name=?,username=?,role=?,password_hash=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
        )
        .run(v.name, v.username, v.role, bcrypt.hashSync(v.password, 10), id);
    else
      getDb()
        .prepare(
          "UPDATE users SET name=?,username=?,role=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",
        )
        .run(v.name, v.username, v.role, id);
  } catch (e) {
    if (e.code === "SQLITE_CONSTRAINT_UNIQUE") throw new AppError("El nombre de usuario ya existe");
    throw e;
  }
}
/**
 * Alterna el estado activo e inactivo del empleado.
 * @param {number|string} id - Identificador del registro.
 * @param {number|string} currentId - Usuario conectado, para impedir modificar su propia cuenta.
 * @returns {void} No devuelve un valor.
 * @throws {AppError} Si el registro no existe o la operación no está permitida.
 */
function toggle(id, currentId) {
  if (Number(id) === Number(currentId)) throw new AppError("No puedes desactivar tu propia cuenta");
  const u = get(id);
  if (!u) throw new AppError("Usuario no encontrado", 404);
  getDb()
    .prepare("UPDATE users SET active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?")
    .run(u.active ? 0 : 1, id);
}
/**
 * Realiza una eliminación lógica y desactiva el acceso o la venta, conservando el historial del empleado.
 * @param {number|string} id - Identificador del registro.
 * @param {number|string} currentId - Usuario conectado, para impedir modificar su propia cuenta.
 * @returns {void} No devuelve un valor.
 * @throws {AppError} Si el registro no existe o la operación no está permitida.
 */
function remove(id, currentId) {
  if (Number(id) === Number(currentId)) throw new AppError("No puedes eliminar tu propia cuenta");
  if (!get(id)) throw new AppError("Empleado no encontrado", 404);
  getDb()
    .prepare(
      "UPDATE users SET active=0,deleted_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?",
    )
    .run(id);
}
module.exports = { list, get, create, update, toggle, remove, ROLES };

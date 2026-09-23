const bcrypt = require("bcryptjs");
const { getDb } = require("../database/db");
const { AppError } = require("../utils/errors");
const ROLES = ["GERENTE", "ADMINISTRADOR", "CAJERO"];
function list() {
  return getDb()
    .prepare("SELECT id,name,username,role,active,created_at FROM users ORDER BY name")
    .all();
}
function get(id) {
  return getDb().prepare("SELECT id,name,username,role,active FROM users WHERE id=?").get(id);
}
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
function toggle(id, currentId) {
  if (Number(id) === Number(currentId)) throw new AppError("No puedes desactivar tu propia cuenta");
  const u = get(id);
  if (!u) throw new AppError("Usuario no encontrado", 404);
  getDb()
    .prepare("UPDATE users SET active=?,updated_at=CURRENT_TIMESTAMP WHERE id=?")
    .run(u.active ? 0 : 1, id);
}
module.exports = { list, get, create, update, toggle, ROLES };

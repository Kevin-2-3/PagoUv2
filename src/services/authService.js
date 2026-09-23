const bcrypt = require("bcryptjs");
const { getDb } = require("../database/db");
const { AppError } = require("../utils/errors");
function login(username, password) {
  const user = getDb()
    .prepare("SELECT * FROM users WHERE username = ?")
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
function authorizeManager(username, pin) {
  const user = getDb()
    .prepare("SELECT * FROM users WHERE username=? AND role='GERENTE' AND active=1")
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

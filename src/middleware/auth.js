/**
 * @file Control de autenticación y permisos por rol.
 */
const { AppError } = require("../utils/errors");
const { getDb } = require("../database/db");
/**
 * Valida la sesión contra la base de datos y actualiza el usuario y su rol. Redirige al login o informa un error 401 si no hay acceso.
 * @param {import("express").Request} req - Solicitud HTTP, con sesión, parámetros y datos enviados.
 * @param {import("express").Response} res - Respuesta HTTP utilizada para mostrar una vista, redirigir o enviar JSON.
 * @param {import("express").NextFunction} next - Continúa la solicitud o envía el error al manejador central.
 * @returns {void} No devuelve un valor.
 */
function requireAuth(req, res, next) {
  if (req.session.user) {
    const user = getDb()
      .prepare(
        "SELECT id,name,username,role FROM users WHERE id=? AND active=1 AND deleted_at IS NULL",
      )
      .get(req.session.user.id);
    if (!user) {
      delete req.session.user;
    } else {
      req.session.user = user;
      res.locals.user = user;
    }
  }
  if (!req.session.user)
    return !req.path.startsWith("/api/") && req.accepts("html")
      ? res.redirect("/login?error=Sesión requerida")
      : next(new AppError("Sesión requerida", 401));
  next();
}
/**
 * Crea un middleware que permite continuar únicamente a los roles indicados.
 * @param {string} ...roles - Roles autorizados: GERENTE, ADMINISTRADOR o CAJERO.
 * @returns {import("express").RequestHandler} Middleware que envía un error 403 si no hay permiso.
 */
function allowRoles(...roles) {
  return (req, res, next) => {
    if (!req.session.user || !roles.includes(req.session.user.role))
      return next(new AppError("No tienes permiso para acceder a esta función", 403));
    next();
  };
}
module.exports = { requireAuth, allowRoles };

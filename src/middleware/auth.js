const { AppError } = require("../utils/errors");
const { getDb } = require("../database/db");
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
function allowRoles(...roles) {
  return (req, res, next) => {
    if (!req.session.user || !roles.includes(req.session.user.role))
      return next(new AppError("No tienes permiso para acceder a esta función", 403));
    next();
  };
}
module.exports = { requireAuth, allowRoles };

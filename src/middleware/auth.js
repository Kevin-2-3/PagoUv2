const { AppError } = require("../utils/errors");
function requireAuth(req, res, next) {
  if (!req.session.user)
    return req.accepts("html")
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

const users = require("../services/userService");
const { AppError } = require("../utils/errors");
exports.remove = (req, res, next) => {
  try {
    if (req.body.confirm !== "yes") throw new AppError("Confirma la eliminación del empleado");
    users.remove(req.params.id, req.session.user.id);
    req.flash("success", "Empleado eliminado. Sus ventas se conservan y su acceso fue revocado.");
    res.redirect("/usuarios");
  } catch (error) {
    next(error);
  }
};
exports.index = (req, res) =>
  res.render("users/index", { title: "Empleados", users: users.list() });
exports.form = (req, res) =>
  res.render("users/form", {
    title: req.params.id ? "Editar empleado" : "Nuevo empleado",
    employee: req.params.id ? users.get(req.params.id) : null,
    roles: users.ROLES,
  });
exports.save = (req, res, next) => {
  try {
    if (req.params.id) users.update(req.params.id, req.body);
    else users.create(req.body);
    req.flash("success", "Empleado guardado correctamente");
    res.redirect("/usuarios");
  } catch (e) {
    next(e);
  }
};
exports.toggle = (req, res, next) => {
  try {
    users.toggle(req.params.id, req.session.user.id);
    req.flash("success", "Estado del empleado actualizado");
    res.redirect("/usuarios");
  } catch (e) {
    next(e);
  }
};

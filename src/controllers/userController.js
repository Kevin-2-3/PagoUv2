/**
 * @file Controladores HTTP para la administración de empleados.
 */
const users = require("../services/userService");
const { AppError } = require("../utils/errors");
/**
 * Exige confirmación y elimina lógicamente al empleado, conservando sus ventas. Envía los errores al manejador central.
 * @param {import("express").Request} req - Solicitud HTTP, con sesión, parámetros y datos enviados.
 * @param {import("express").Response} res - Respuesta HTTP utilizada para mostrar una vista, redirigir o enviar JSON.
 * @param {import("express").NextFunction} next - Continúa la solicitud o envía el error al manejador central.
 */
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
/**
 * Muestra la lista de empleados no eliminados.
 * @param {import("express").Request} req - Solicitud HTTP, con sesión, parámetros y datos enviados.
 * @param {import("express").Response} res - Respuesta HTTP utilizada para mostrar una vista, redirigir o enviar JSON.
 */
exports.index = (req, res) =>
  res.render("users/index", { title: "Empleados", users: users.list() });
/**
 * Muestra el formulario de empleado y los roles disponibles.
 * @param {import("express").Request} req - Solicitud HTTP, con sesión, parámetros y datos enviados.
 * @param {import("express").Response} res - Respuesta HTTP utilizada para mostrar una vista, redirigir o enviar JSON.
 */
exports.form = (req, res) =>
  res.render("users/form", {
    title: req.params.id ? "Editar empleado" : "Nuevo empleado",
    employee: req.params.id ? users.get(req.params.id) : null,
    roles: users.ROLES,
  });
/**
 * Crea o actualiza un empleado y confirma el resultado. Envía los errores al manejador central.
 * @param {import("express").Request} req - Solicitud HTTP, con sesión, parámetros y datos enviados.
 * @param {import("express").Response} res - Respuesta HTTP utilizada para mostrar una vista, redirigir o enviar JSON.
 * @param {import("express").NextFunction} next - Continúa la solicitud o envía el error al manejador central.
 */
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
/**
 * Alterna el estado del empleado sin permitir desactivar la cuenta propia. Envía los errores al manejador central.
 * @param {import("express").Request} req - Solicitud HTTP, con sesión, parámetros y datos enviados.
 * @param {import("express").Response} res - Respuesta HTTP utilizada para mostrar una vista, redirigir o enviar JSON.
 * @param {import("express").NextFunction} next - Continúa la solicitud o envía el error al manejador central.
 */
exports.toggle = (req, res, next) => {
  try {
    users.toggle(req.params.id, req.session.user.id);
    req.flash("success", "Estado del empleado actualizado");
    res.redirect("/usuarios");
  } catch (e) {
    next(e);
  }
};

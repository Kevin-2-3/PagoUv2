/**
 * @file Controladores HTTP para el acceso y cierre de sesión.
 */
const auth = require("../services/authService");
/**
 * Muestra el formulario de inicio de sesión y el error recibido en la consulta.
 * @param {import("express").Request} req - Solicitud HTTP, con sesión, parámetros y datos enviados.
 * @param {import("express").Response} res - Respuesta HTTP utilizada para mostrar una vista, redirigir o enviar JSON.
 */
exports.loginPage = (req, res) => res.render("login", { layout: false, error: req.query.error });
/**
 * Inicia la sesión y dirige al usuario a su caja o al inicio según su rol y turno. Envía los errores al manejador central.
 * @param {import("express").Request} req - Solicitud HTTP, con sesión, parámetros y datos enviados.
 * @param {import("express").Response} res - Respuesta HTTP utilizada para mostrar una vista, redirigir o enviar JSON.
 * @param {import("express").NextFunction} next - Continúa la solicitud o envía el error al manejador central.
 */
exports.login = (req, res, next) => {
  try {
    req.session.user = auth.login(req.body.username, req.body.password);
    res.redirect(
      ["CAJERO", "ADMINISTRADOR"].includes(req.session.user.role) &&
        !require("../services/cashService").current(req.session.user.id)
        ? "/caja"
        : "/",
    );
  } catch (e) {
    if (e.status === 401 || e.status === 403)
      return res.status(e.status).render("login", { layout: false, error: e.message });
    next(e);
  }
};
/**
 * Destruye la sesión y redirige al formulario de acceso. Envía los errores al manejador central.
 * @param {import("express").Request} req - Solicitud HTTP, con sesión, parámetros y datos enviados.
 * @param {import("express").Response} res - Respuesta HTTP utilizada para mostrar una vista, redirigir o enviar JSON.
 * @param {import("express").NextFunction} next - Continúa la solicitud o envía el error al manejador central.
 */
exports.logout = (req, res, next) =>
  req.session.destroy((e) => (e ? next(e) : res.redirect("/login")));

/**
 * @file Mensajes temporales entre solicitudes.
 */
/**
 * Entrega los mensajes pendientes a las vistas, los consume y añade req.flash para guardar un mensaje para la siguiente solicitud.
 * @param {import("express").Request} req - Solicitud HTTP, con sesión, parámetros y datos enviados.
 * @param {import("express").Response} res - Respuesta HTTP utilizada para mostrar una vista, redirigir o enviar JSON.
 * @param {import("express").NextFunction} next - Continúa la solicitud o envía el error al manejador central.
 * @returns {void} No devuelve un valor.
 */
function flash(req, res, next) {
  res.locals.message = req.session.message || null;
  delete req.session.message;
  req.flash = (type, text) => {
    req.session.message = { type, text };
  };
  next();
}
module.exports = { flash };

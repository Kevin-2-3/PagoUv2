/**
 * @file Controladores HTTP para ventas y comprobantes.
 */
const sales = require("../services/saleService");
const { AppError } = require("../utils/errors");

/**
 * Muestra un comprobante sin caché únicamente para una venta completada. Envía los errores al manejador central.
 * @param {import("express").Request} req - Solicitud HTTP, con sesión, parámetros y datos enviados.
 * @param {import("express").Response} res - Respuesta HTTP utilizada para mostrar una vista, redirigir o enviar JSON.
 * @param {import("express").NextFunction} next - Continúa la solicitud o envía el error al manejador central.
 */
exports.ticket = (req, res, next) => {
  try {
    const sale = sales.get(req.params.id);
    if (sale.status !== "COMPLETADA") {
      throw new AppError("Solo puedes imprimir tickets de ventas completadas", 400);
    }
    res.set("Cache-Control", "no-store");
    res.render("sales/ticket", { sale });
  } catch (error) {
    next(error);
  }
};
/**
 * Muestra el punto de venta o dirige a caja si falta abrir un turno.
 * @param {import("express").Request} req - Solicitud HTTP, con sesión, parámetros y datos enviados.
 * @param {import("express").Response} res - Respuesta HTTP utilizada para mostrar una vista, redirigir o enviar JSON.
 */
exports.pos = (req, res) => {
  const shift = require("../services/cashService").current(req.session.user.id);
  if (!shift) return res.redirect("/caja");
  res.render("sales/pos", { title: "Punto de venta", shift });
};
/**
 * Registra la venta de la sesión y devuelve su resumen como JSON con estado 201. Envía los errores al manejador central.
 * @param {import("express").Request} req - Solicitud HTTP, con sesión, parámetros y datos enviados.
 * @param {import("express").Response} res - Respuesta HTTP utilizada para mostrar una vista, redirigir o enviar JSON.
 * @param {import("express").NextFunction} next - Continúa la solicitud o envía el error al manejador central.
 */
exports.create = (req, res, next) => {
  try {
    const result = sales.createSale(
      req.session.user.id,
      req.body.items,
      req.body.received,
      req.body.paymentMethod,
    );
    res.status(201).json({ ok: true, ...result });
  } catch (e) {
    next(e);
  }
};
/**
 * Muestra las ventas filtradas por folio.
 * @param {import("express").Request} req - Solicitud HTTP, con sesión, parámetros y datos enviados.
 * @param {import("express").Response} res - Respuesta HTTP utilizada para mostrar una vista, redirigir o enviar JSON.
 */
exports.index = (req, res) =>
  res.render("sales/index", {
    title: "Ventas",
    sales: sales.list({
      folio: req.query.folio,
    }),
    folio: req.query.folio || "",
  });
/**
 * Muestra las partidas y datos de una venta. Envía los errores al manejador central.
 * @param {import("express").Request} req - Solicitud HTTP, con sesión, parámetros y datos enviados.
 * @param {import("express").Response} res - Respuesta HTTP utilizada para mostrar una vista, redirigir o enviar JSON.
 * @param {import("express").NextFunction} next - Continúa la solicitud o envía el error al manejador central.
 */
exports.show = (req, res, next) => {
  try {
    res.render("sales/show", {
      title: "Detalle de venta",
      sale: sales.get(req.params.id),
    });
  } catch (e) {
    next(e);
  }
};
/**
 * Cancela la venta con autorización de gerente y confirma la restauración del inventario. Envía los errores al manejador central.
 * @param {import("express").Request} req - Solicitud HTTP, con sesión, parámetros y datos enviados.
 * @param {import("express").Response} res - Respuesta HTTP utilizada para mostrar una vista, redirigir o enviar JSON.
 * @param {import("express").NextFunction} next - Continúa la solicitud o envía el error al manejador central.
 */
exports.cancel = (req, res, next) => {
  try {
    sales.cancelSale(
      req.params.id,
      req.session.user.id,
      req.body.manager_username,
      req.body.manager_pin,
      req.body.reason,
    );
    req.flash("success", "Venta cancelada e inventario restaurado");
    res.redirect(`/ventas/${req.params.id}`);
  } catch (e) {
    next(e);
  }
};

/**
 * @file Controladores HTTP para caja y promociones.
 */
const cash = require("../services/cashService");
const promotions = require("../services/promotionService");
const products = require("../services/productService");
/**
 * Muestra el turno abierto del usuario.
 * @param {import("express").Request} req - Solicitud HTTP, con sesión, parámetros y datos enviados.
 * @param {import("express").Response} res - Respuesta HTTP utilizada para mostrar una vista, redirigir o enviar JSON.
 */
exports.cash = (req, res) =>
  res.render("cash", { title: "Mi caja", shift: cash.current(req.session.user.id) });
/**
 * Abre la caja con el fondo inicial enviado y muestra el punto de venta. Envía los errores al manejador central.
 * @param {import("express").Request} req - Solicitud HTTP, con sesión, parámetros y datos enviados.
 * @param {import("express").Response} res - Respuesta HTTP utilizada para mostrar una vista, redirigir o enviar JSON.
 * @param {import("express").NextFunction} next - Continúa la solicitud o envía el error al manejador central.
 */
exports.open = (req, res, next) => {
  try {
    cash.open(req.session.user.id, req.body.opening);
    res.redirect("/pdv");
  } catch (e) {
    next(e);
  }
};
/**
 * Cierra la caja con el efectivo contado y muestra un mensaje de confirmación. Envía los errores al manejador central.
 * @param {import("express").Request} req - Solicitud HTTP, con sesión, parámetros y datos enviados.
 * @param {import("express").Response} res - Respuesta HTTP utilizada para mostrar una vista, redirigir o enviar JSON.
 * @param {import("express").NextFunction} next - Continúa la solicitud o envía el error al manejador central.
 */
exports.close = (req, res, next) => {
  try {
    cash.close(req.session.user.id, req.body.counted);
    req.flash("success", "Turno cerrado. El gerente puede consultar el corte de caja.");
    res.redirect("/caja");
  } catch (e) {
    next(e);
  }
};
/**
 * Muestra el corte de la fecha solicitada o del día actual. Envía los errores al manejador central.
 * @param {import("express").Request} req - Solicitud HTTP, con sesión, parámetros y datos enviados.
 * @param {import("express").Response} res - Respuesta HTTP utilizada para mostrar una vista, redirigir o enviar JSON.
 * @param {import("express").NextFunction} next - Continúa la solicitud o envía el error al manejador central.
 */
exports.report = (req, res, next) => {
  try {
    res.render("cash-report", {
      title: "Corte diario",
      report: cash.report(req.query.date || promotions.today()),
    });
  } catch (e) {
    next(e);
  }
};
/**
 * Muestra promociones y productos disponibles para asociar.
 * @param {import("express").Request} req - Solicitud HTTP, con sesión, parámetros y datos enviados.
 * @param {import("express").Response} res - Respuesta HTTP utilizada para mostrar una vista, redirigir o enviar JSON.
 */
exports.promotions = (req, res) =>
  res.render("promotions", {
    title: "Promociones",
    promotions: promotions.list(),
    products: products.list(),
    today: promotions.today(),
  });
/**
 * Crea una promoción con los datos del formulario. Envía los errores al manejador central.
 * @param {import("express").Request} req - Solicitud HTTP, con sesión, parámetros y datos enviados.
 * @param {import("express").Response} res - Respuesta HTTP utilizada para mostrar una vista, redirigir o enviar JSON.
 * @param {import("express").NextFunction} next - Continúa la solicitud o envía el error al manejador central.
 */
exports.createPromotion = (req, res, next) => {
  try {
    promotions.create(req.body);
    res.redirect("/promociones");
  } catch (e) {
    next(e);
  }
};
/**
 * Activa o desactiva la promoción solicitada. Envía los errores al manejador central.
 * @param {import("express").Request} req - Solicitud HTTP, con sesión, parámetros y datos enviados.
 * @param {import("express").Response} res - Respuesta HTTP utilizada para mostrar una vista, redirigir o enviar JSON.
 * @param {import("express").NextFunction} next - Continúa la solicitud o envía el error al manejador central.
 */
exports.togglePromotion = (req, res, next) => {
  try {
    promotions.toggle(req.params.id);
    res.redirect("/promociones");
  } catch (e) {
    next(e);
  }
};

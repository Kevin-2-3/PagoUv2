/**
 * @file Controladores HTTP para el inventario de productos.
 */
const products = require("../services/productService");
const { getDb } = require("../database/db");
const path = require("path");
const { AppError } = require("../utils/errors");
/**
 * Envía la imagen WebP del producto o la imagen predeterminada, sin caché. Envía los errores al manejador central.
 * @param {import("express").Request} req - Solicitud HTTP, con sesión, parámetros y datos enviados.
 * @param {import("express").Response} res - Respuesta HTTP utilizada para mostrar una vista, redirigir o enviar JSON.
 * @param {import("express").NextFunction} next - Continúa la solicitud o envía el error al manejador central.
 */
exports.image = (req, res, next) => {
  const product = products.get(req.params.id);
  if (!product) return next(new AppError("Producto no encontrado", 404));
  res.set("Cache-Control", "no-store");
  if (product.image_data) return res.type("image/webp").send(product.image_data);
  res.sendFile(path.resolve(__dirname, "../../public/images/default.webp"));
};
/**
 * Muestra el inventario filtrado por la búsqueda recibida.
 * @param {import("express").Request} req - Solicitud HTTP, con sesión, parámetros y datos enviados.
 * @param {import("express").Response} res - Respuesta HTTP utilizada para mostrar una vista, redirigir o enviar JSON.
 */
exports.index = (req, res) =>
  res.render("products/index", {
    title: "Productos",
    products: products.list(req.query.q),
    q: req.query.q || "",
  });
/**
 * Muestra el formulario para crear o editar un producto y las categorías activas.
 * @param {import("express").Request} req - Solicitud HTTP, con sesión, parámetros y datos enviados.
 * @param {import("express").Response} res - Respuesta HTTP utilizada para mostrar una vista, redirigir o enviar JSON.
 */
exports.form = (req, res) =>
  res.render("products/form", {
    title: req.params.id ? "Editar producto" : "Nuevo producto",
    product: req.params.id ? products.get(req.params.id) : null,
    categories: getDb().prepare("SELECT * FROM categories WHERE active=1 ORDER BY name").all(),
  });
/**
 * Crea o actualiza un producto, incluida la imagen procesada si fue enviada. Envía los errores al manejador central.
 * @param {import("express").Request} req - Solicitud HTTP, con sesión, parámetros y datos enviados.
 * @param {import("express").Response} res - Respuesta HTTP utilizada para mostrar una vista, redirigir o enviar JSON.
 * @param {import("express").NextFunction} next - Continúa la solicitud o envía el error al manejador central.
 */
exports.save = (req, res, next) => {
  try {
    if (req.params.id) products.update(req.params.id, req.body, req.productImage);
    else products.create(req.body, req.productImage);
    req.flash("success", "Producto guardado correctamente");
    res.redirect("/productos");
  } catch (e) {
    next(e);
  }
};
/**
 * Alterna el estado del producto y confirma el cambio. Envía los errores al manejador central.
 * @param {import("express").Request} req - Solicitud HTTP, con sesión, parámetros y datos enviados.
 * @param {import("express").Response} res - Respuesta HTTP utilizada para mostrar una vista, redirigir o enviar JSON.
 * @param {import("express").NextFunction} next - Continúa la solicitud o envía el error al manejador central.
 */
exports.toggle = (req, res, next) => {
  try {
    products.toggle(req.params.id);
    req.flash("success", "Estado del producto actualizado");
    res.redirect("/productos");
  } catch (e) {
    next(e);
  }
};
/**
 * Devuelve hasta veinte productos activos con sus promociones aplicadas.
 * @param {import("express").Request} req - Solicitud HTTP, con sesión, parámetros y datos enviados.
 * @param {import("express").Response} res - Respuesta HTTP utilizada para mostrar una vista, redirigir o enviar JSON.
 */
exports.apiSearch = (req, res) =>
  res.json(
    products
      .list(req.query.q, true)
      .slice(0, 20)
      .map(require("../services/promotionService").price),
  );
/**
 * Exige confirmación y elimina lógicamente el producto, conservando su historial. Envía los errores al manejador central.
 * @param {import("express").Request} req - Solicitud HTTP, con sesión, parámetros y datos enviados.
 * @param {import("express").Response} res - Respuesta HTTP utilizada para mostrar una vista, redirigir o enviar JSON.
 * @param {import("express").NextFunction} next - Continúa la solicitud o envía el error al manejador central.
 */
exports.remove = (req, res, next) => {
  try {
    if (req.body.confirm !== "yes") throw new AppError("Confirma la eliminación del producto");
    products.remove(req.params.id);
    req.flash("success", "Producto eliminado del inventario. Su historial se conserva.");
    res.redirect("/productos");
  } catch (error) {
    next(error);
  }
};
/**
 * Agrega la cantidad solicitada a las existencias del producto. Envía los errores al manejador central.
 * @param {import("express").Request} req - Solicitud HTTP, con sesión, parámetros y datos enviados.
 * @param {import("express").Response} res - Respuesta HTTP utilizada para mostrar una vista, redirigir o enviar JSON.
 * @param {import("express").NextFunction} next - Continúa la solicitud o envía el error al manejador central.
 */
exports.addStock = (req, res, next) => {
  try {
    products.addStock(req.params.id, req.body.quantity);
    req.flash("success", "Existencias agregadas correctamente");
    res.redirect("/productos");
  } catch (error) {
    next(error);
  }
};

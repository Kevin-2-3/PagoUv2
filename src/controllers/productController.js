const products = require("../services/productService");
const { getDb } = require("../database/db");
const path = require("path");
const { AppError } = require("../utils/errors");
exports.image = (req, res, next) => {
  const product = products.get(req.params.id);
  if (!product) return next(new AppError("Producto no encontrado", 404));
  res.set("Cache-Control", "no-store");
  if (product.image_data) return res.type("image/webp").send(product.image_data);
  res.sendFile(path.resolve(__dirname, "../../public/images/default.webp"));
};
exports.index = (req, res) =>
  res.render("products/index", {
    title: "Productos",
    products: products.list(req.query.q),
    q: req.query.q || "",
  });
exports.form = (req, res) =>
  res.render("products/form", {
    title: req.params.id ? "Editar producto" : "Nuevo producto",
    product: req.params.id ? products.get(req.params.id) : null,
    categories: getDb().prepare("SELECT * FROM categories WHERE active=1 ORDER BY name").all(),
  });
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
exports.toggle = (req, res, next) => {
  try {
    products.toggle(req.params.id);
    req.flash("success", "Estado del producto actualizado");
    res.redirect("/productos");
  } catch (e) {
    next(e);
  }
};
exports.apiSearch = (req, res) => res.json(products.list(req.query.q, true).slice(0, 20));
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
exports.addStock = (req, res, next) => {
  try {
    products.addStock(req.params.id, req.body.quantity);
    req.flash("success", "Existencias agregadas correctamente");
    res.redirect("/productos");
  } catch (error) {
    next(error);
  }
};

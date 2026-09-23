const products = require("../services/productService");
const { getDb } = require("../database/db");
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
    if (req.params.id) products.update(req.params.id, req.body);
    else products.create(req.body);
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

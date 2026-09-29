const sales = require("../services/saleService");
const { AppError } = require("../utils/errors");

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
exports.pos = (req, res) => res.render("sales/pos", { title: "Punto de venta" });
exports.create = (req, res, next) => {
  try {
    const result = sales.createSale(req.session.user.id, req.body.items, req.body.received);
    res.status(201).json({ ok: true, ...result });
  } catch (e) {
    next(e);
  }
};
exports.index = (req, res) =>
  res.render("sales/index", {
    title: "Ventas",
    sales: sales.list({
      folio: req.query.folio,
    }),
    folio: req.query.folio || "",
  });
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

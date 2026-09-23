const sales = require("../services/saleService");
exports.dashboard = (req, res) =>
  res.render("dashboard", { title: "Inicio", stats: sales.dashboard() });

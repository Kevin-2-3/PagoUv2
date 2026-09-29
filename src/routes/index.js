const express = require("express");
const auth = require("../middleware/auth");
const authC = require("../controllers/authController"),
  main = require("../controllers/mainController"),
  products = require("../controllers/productController"),
  users = require("../controllers/userController"),
  sales = require("../controllers/saleController");
const r = express.Router();
const productImage = require("../middleware/productImage");
r.get("/login", authC.loginPage);
r.post("/login", authC.login);
r.post("/logout", auth.requireAuth, authC.logout);
r.use(auth.requireAuth);
r.get("/", main.dashboard);
r.get("/productos/:id/imagen", products.image);
r.get("/productos", auth.allowRoles("GERENTE", "ADMINISTRADOR"), products.index);
r.post("/productos/:id/eliminar", auth.allowRoles("ADMINISTRADOR"), products.remove);
r.post("/productos/:id/existencias", auth.allowRoles("ADMINISTRADOR"), products.addStock);
r.post("/usuarios/:id/eliminar", auth.allowRoles("GERENTE"), users.remove);
r.get("/productos/nuevo", auth.allowRoles("ADMINISTRADOR"), products.form);
r.get("/productos/:id/editar", auth.allowRoles("ADMINISTRADOR"), products.form);
r.post("/productos/nuevo", auth.allowRoles("ADMINISTRADOR"), productImage, products.save);
r.post("/productos/:id/editar", auth.allowRoles("ADMINISTRADOR"), productImage, products.save);
r.post("/productos/:id/estado", auth.allowRoles("ADMINISTRADOR"), products.toggle);
r.get("/api/productos", auth.allowRoles("CAJERO", "ADMINISTRADOR"), products.apiSearch);
r.get("/usuarios", auth.allowRoles("GERENTE"), users.index);
r.get("/usuarios/nuevo", auth.allowRoles("GERENTE"), users.form);
r.get("/usuarios/:id/editar", auth.allowRoles("GERENTE"), users.form);
r.post("/usuarios/nuevo", auth.allowRoles("GERENTE"), users.save);
r.post("/usuarios/:id/editar", auth.allowRoles("GERENTE"), users.save);
r.post("/usuarios/:id/estado", auth.allowRoles("GERENTE"), users.toggle);
r.get("/pdv", auth.allowRoles("CAJERO", "ADMINISTRADOR"), sales.pos);
r.post("/api/ventas", auth.allowRoles("CAJERO", "ADMINISTRADOR"), sales.create);
r.get("/ventas", sales.index);
r.get("/ventas/:id/ticket", sales.ticket);
r.get("/ventas/:id", sales.show);
r.post("/ventas/:id/cancelar", auth.allowRoles("CAJERO", "GERENTE"), sales.cancel);
module.exports = r;

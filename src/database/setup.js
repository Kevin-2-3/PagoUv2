const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const { getDb, closeDb } = require("./db");
const { migrateImages } = require("./productImages");
const { migrateOperations } = require("./operationsMigration");

function setupDatabase({ reset = false } = {}) {
  const db = getDb();
  if (reset)
    db.exec(
      "DROP TABLE IF EXISTS cash_cuts; DROP TABLE IF EXISTS sale_cancellations; DROP TABLE IF EXISTS sale_details; DROP TABLE IF EXISTS sales; DROP TABLE IF EXISTS cash_shifts; DROP TABLE IF EXISTS products; DROP TABLE IF EXISTS users; DROP TABLE IF EXISTS categories;",
    );
  db.exec(fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8"));
  migrateImages(db);
  migrateOperations(db);
  const existing = db.prepare("SELECT COUNT(*) count FROM users").get().count;
  if (existing) return;

  const seed = db.transaction(() => {
    const addUser = db.prepare(
      "INSERT INTO users(name,username,password_hash,role,manager_pin_hash) VALUES (?,?,?,?,?)",
    );
    addUser.run(
      "Gerencia Nexo",
      "gerente",
      bcrypt.hashSync("Gerente123!", 10),
      "GERENTE",
      bcrypt.hashSync("2468", 10),
    );
    addUser.run(
      "Administración Nexo",
      "admin",
      bcrypt.hashSync("Admin123!", 10),
      "ADMINISTRADOR",
      null,
    );
    addUser.run("Caja Principal", "cajero", bcrypt.hashSync("Cajero123!", 10), "CAJERO", null);
    const categories = [
      "Bebidas",
      "Botanas",
      "Dulces",
      "Alimentos",
      "Higiene",
      "Limpieza",
      "Otros",
    ];
    const catStmt = db.prepare("INSERT INTO categories(name) VALUES (?)");
    categories.forEach((name) => catStmt.run(name));
    const ids = Object.fromEntries(
      db
        .prepare("SELECT id,name FROM categories")
        .all()
        .map((c) => [c.name, c.id]),
    );
    const products = [
      ["BEB001", "Agua purificada 600 ml", "Botella individual", 1200, 40, "Bebidas"],
      ["BEB002", "Refresco cola 600 ml", "Bebida carbonatada", 2200, 30, "Bebidas"],
      ["BEB003", "Té limón 500 ml", "Té frío", 2000, 22, "Bebidas"],
      ["BEB004", "Bebida energética 473 ml", "Bebida energética", 3600, 18, "Bebidas"],
      ["BOT001", "Papas saladas 45 g", "Botana crujiente", 1800, 35, "Botanas"],
      ["BOT002", "Totopos picantes 55 g", "Botana de maíz", 1700, 28, "Botanas"],
      ["BOT003", "Cacahuates japoneses 100 g", "Cacahuates sazonados", 1600, 25, "Botanas"],
      ["DUL001", "Gomitas frutales 80 g", "Dulce suave", 1500, 30, "Dulces"],
      ["DUL002", "Chocolate con leche 40 g", "Barra de chocolate", 1900, 24, "Dulces"],
      ["DUL003", "Caramelos surtidos", "Bolsa individual", 1200, 40, "Dulces"],
      ["ALI001", "Sándwich mixto", "Alimento refrigerado", 4500, 12, "Alimentos"],
      ["ALI002", "Galletas de avena", "Paquete individual", 1800, 20, "Alimentos"],
      ["ALI003", "Sopa instantánea", "Vaso individual", 2300, 26, "Alimentos"],
      ["ALI004", "Barra de cereal", "Sabor frutos rojos", 1400, 32, "Alimentos"],
      ["HIG001", "Pasta dental 75 ml", "Cuidado bucal", 3800, 15, "Higiene"],
      ["HIG002", "Jabón corporal", "Barra neutra", 2100, 18, "Higiene"],
      ["HIG003", "Papel higiénico 4 rollos", "Paquete", 4800, 14, "Higiene"],
      ["LIM001", "Detergente líquido 500 ml", "Limpieza general", 4200, 10, "Limpieza"],
      ["LIM002", "Esponja multiusos", "Pieza", 1300, 22, "Limpieza"],
      ["OTR001", "Pilas alcalinas AA", "Paquete con 2", 3900, 16, "Otros"],
    ];
    const addProduct = db.prepare(
      "INSERT INTO products(code,name,description,price_cents,stock,category_id) VALUES (?,?,?,?,?,?)",
    );
    products.forEach((p) => addProduct.run(p[0], p[1], p[2], p[3], p[4], ids[p[5]]));
  });
  seed();
  migrateImages(db);
}

if (require.main === module) {
  setupDatabase();
  closeDb();
  console.log("Base de datos lista con datos de demostración.");
}
module.exports = { setupDatabase };

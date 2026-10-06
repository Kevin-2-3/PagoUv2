/**
 * @file Gestión de las imágenes de productos y sus datos de ejemplo.
 */
const fs = require("fs");
const path = require("path");

const demoImages = {
  BEB001: "1F6B0",
  BEB002: "1F964",
  BEB003: "1F9CB",
  BEB004: "1F964",
  BOT001: "1F954",
  BOT002: "1F33D",
  BOT003: "1F95C",
  DUL001: "1F36C",
  DUL002: "1F36B",
  DUL003: "1F36C",
  ALI001: "1F96A",
  ALI002: "1F36A",
  ALI003: "1F35C",
  ALI004: "1F33E",
  HIG001: "1FAA5",
  HIG002: "1F9FC",
  HIG003: "1F9FB",
  LIM001: "1F9F4",
  LIM002: "1F9FD",
  OTR001: "1F50B",
};

/**
 * Añade la columna de imágenes y asigna imágenes locales a los productos de ejemplo que no tengan una.
 * @param {import("better-sqlite3").Database} db - Conexión sobre la que se aplica la migración.
 * @returns {void} No devuelve un valor.
 */
function migrateImages(db) {
  const columns = db.prepare("PRAGMA table_info(products)").all();
  if (!columns.some((column) => column.name === "image_data")) {
    db.exec("ALTER TABLE products ADD COLUMN image_data BLOB");
  }
  const assign = db.prepare("UPDATE products SET image_data=? WHERE code=? AND image_data IS NULL");
  db.transaction(() => {
    for (const [code, icon] of Object.entries(demoImages)) {
      const file = path.join(__dirname, "../../public/images/demo", `${icon}.webp`);
      if (fs.existsSync(file)) assign.run(fs.readFileSync(file), code);
    }
  })();
}

module.exports = { demoImages, migrateImages };

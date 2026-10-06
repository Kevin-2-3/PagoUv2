/**
 * @file Configuración de la aplicación Express.
 */
const path = require("path");
const express = require("express");
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);
const helmet = require("helmet");
const morgan = require("morgan");
const env = require("./config/env");
const { setupDatabase } = require("./database/setup");
const { money } = require("./utils/format");
const { flash } = require("./middleware/flash");
/**
 * Inicializa la base de datos y configura vistas, sesiones, rutas y manejo de errores.
 * @returns {import("express").Express} Aplicación lista para recibir solicitudes.
 */
function createApp() {
  setupDatabase();
  const app = express();
  app.disable("x-powered-by");
  app.set("view engine", "ejs");
  app.set("views", path.join(__dirname, "views"));
  app.use(helmet({ contentSecurityPolicy: false }));
  if (!env.isProduction) app.use(morgan("dev"));
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json({ limit: "100kb" }));
  app.use(express.static(path.join(process.cwd(), "public")));
  app.use(
    session({
      store: new SQLiteStore({
        db: "sessions.sqlite",
        dir: path.dirname(env.databasePath),
      }),
      secret: env.sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: env.isProduction,
        maxAge: 8 * 60 * 60 * 1000,
      },
    }),
  );
  app.use(flash);
  app.use((req, res, next) => {
    res.locals.user = req.session.user;
    res.locals.money = money;
    next();
  });
  app.use(require("./routes"));
  app.use((req, res) =>
    res.status(404).render("error", {
      title: "No encontrado",
      status: 404,
      message: "La página solicitada no existe",
    }),
  );
  app.use((err, req, res, next) => {
    if (!err.status) console.error(err);
    const status = err.status || 500,
      message = status === 500 ? "Ocurrió un error inesperado" : err.message;
    if (req.path.startsWith("/api/")) return res.status(status).json({ ok: false, error: message });
    res.status(status).render("error", { title: "Error", status, message });
  });
  return app;
}
module.exports = { createApp };

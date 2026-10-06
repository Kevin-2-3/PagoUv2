/**
 * @file Controladores HTTP para el panel de inicio.
 */
const sales = require("../services/saleService");
/**
 * Muestra el panel de inicio con los indicadores del sistema.
 * @param {import("express").Request} req - Solicitud HTTP, con sesión, parámetros y datos enviados.
 * @param {import("express").Response} res - Respuesta HTTP utilizada para mostrar una vista, redirigir o enviar JSON.
 */
exports.dashboard = (req, res) =>
  res.render("dashboard", { title: "Inicio", stats: sales.dashboard() });

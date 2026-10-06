/**
 * @file Inicia el servidor HTTP y lo cierra al recibir SIGINT.
 */
const { createApp } = require("./app");
const env = require("./config/env");
const server = createApp().listen(env.port, () =>
  console.log(`PagoUv2 listo en http://localhost:${env.port}`),
);
process.on("SIGINT", () => server.close(() => process.exit(0)));

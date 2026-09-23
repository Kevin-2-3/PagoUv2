const path = require("path");
require("dotenv").config({ path: path.join(process.cwd(), ".env") });

module.exports = {
  port: Number(process.env.PORT) || 3000,
  sessionSecret: process.env.SESSION_SECRET || "solo-desarrollo-cambiar",
  databasePath: path.resolve(
    process.cwd(),
    process.env.DATABASE_PATH || "database/nexocaja.sqlite",
  ),
  isProduction: process.env.NODE_ENV === "production",
};

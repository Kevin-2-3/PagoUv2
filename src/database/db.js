const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const env = require("../config/env");

let instance;
function getDb() {
  if (!instance) {
    fs.mkdirSync(path.dirname(env.databasePath), { recursive: true });
    instance = new Database(env.databasePath);
    instance.pragma("foreign_keys = ON");
    instance.pragma("journal_mode = WAL");
    instance.pragma("busy_timeout = 5000");
  }
  return instance;
}
function closeDb() {
  if (instance) {
    instance.close();
    instance = null;
  }
}
module.exports = { getDb, closeDb };

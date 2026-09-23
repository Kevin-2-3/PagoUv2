const path = require("path");
const fs = require("fs");
const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
process.env.NODE_ENV = "test";
process.env.DATABASE_PATH = "database/test-pagouv2.sqlite";
process.env.SESSION_SECRET = "test-secret";
const dbPath = path.resolve(process.cwd(), process.env.DATABASE_PATH);
for (const suffix of ["", "-wal", "-shm"]) {
  try {
    fs.unlinkSync(dbPath + suffix);
  } catch {}
}
const { createApp } = require("../src/app");
const { getDb, closeDb } = require("../src/database/db");
const app = createApp();
async function login(username, password) {
  const agent = request.agent(app);
  await agent.post("/login").type("form").send({ username, password }).expect(302);
  return agent;
}
test("login correcto e incorrecto", async () => {
  await request(app)
    .post("/login")
    .type("form")
    .send({ username: "cajero", password: "mal" })
    .expect(401);
  const a = await login("cajero", "Cajero123!");
  await a.get("/").expect(200).expect(/Hola/);
});
test("protección de rutas y roles", async () => {
  await request(app).get("/productos").expect(302);
  const cajero = await login("cajero", "Cajero123!");
  await cajero.get("/usuarios").expect(403);
  await cajero.get("/productos/nuevo").expect(403);
});
test("administrador crea, edita y desactiva producto", async () => {
  const a = await login("admin", "Admin123!");
  await a
    .post("/productos/nuevo")
    .type("form")
    .send({
      code: "TEST01",
      name: "Producto prueba",
      description: "Inicial",
      price: "12.50",
      stock: "4",
      category_id: "1",
    })
    .expect(302);
  let p = getDb().prepare("SELECT * FROM products WHERE code='TEST01'").get();
  assert.equal(p.price_cents, 1250);
  await a
    .post(`/productos/${p.id}/editar`)
    .type("form")
    .send({
      code: "TEST01",
      name: "Producto editado",
      description: "Editado",
      price: "14",
      stock: "5",
      category_id: "1",
    })
    .expect(302);
  await a.post(`/productos/${p.id}/estado`).expect(302);
  p = getDb().prepare("SELECT * FROM products WHERE id=?").get(p.id);
  assert.equal(p.name, "Producto editado");
  assert.equal(p.active, 0);
});
test("venta válida descuenta stock y rechaza exceso", async () => {
  const a = await login("cajero", "Cajero123!");
  const p = getDb().prepare("SELECT * FROM products WHERE code='BEB001'").get();
  await a
    .post("/api/ventas")
    .send({ items: [{ productId: p.id, quantity: p.stock + 1 }] })
    .expect(400)
    .expect(/Stock insuficiente/);
  const r = await a
    .post("/api/ventas")
    .send({ items: [{ productId: p.id, quantity: 2 }] })
    .expect(201);
  assert.match(r.body.folio, /^PUV-/);
  assert.equal(
    getDb().prepare("SELECT stock FROM products WHERE id=?").get(p.id).stock,
    p.stock - 2,
  );
});
test("venta rechaza ticket vacío, producto inactivo y cantidad inválida", async () => {
  const a = await login("cajero", "Cajero123!");
  await a.post("/api/ventas").send({ items: [] }).expect(400);
  const p = getDb().prepare("SELECT * FROM products WHERE code='TEST01'").get();
  await a
    .post("/api/ventas")
    .send({ items: [{ productId: p.id, quantity: 1 }] })
    .expect(400)
    .expect(/inactivo/);
  await a
    .post("/api/ventas")
    .send({ items: [{ productId: 1, quantity: 0 }] })
    .expect(400);
});
test("cancelación exige gerente y restaura inventario sin borrar venta", async () => {
  const a = await login("cajero", "Cajero123!");
  const p = getDb().prepare("SELECT * FROM products WHERE code='BOT001'").get();
  const sale = (
    await a
      .post("/api/ventas")
      .send({ items: [{ productId: p.id, quantity: 3 }] })
      .expect(201)
  ).body;
  await a
    .post(`/ventas/${sale.id}/cancelar`)
    .type("form")
    .send({ manager_username: "gerente", manager_pin: "0000" })
    .expect(403);
  assert.equal(
    getDb().prepare("SELECT stock FROM products WHERE id=?").get(p.id).stock,
    p.stock - 3,
  );
  await a
    .post(`/ventas/${sale.id}/cancelar`)
    .type("form")
    .send({
      manager_username: "gerente",
      manager_pin: "2468",
      reason: "Prueba",
    })
    .expect(302);
  assert.equal(getDb().prepare("SELECT stock FROM products WHERE id=?").get(p.id).stock, p.stock);
  assert.equal(
    getDb().prepare("SELECT status FROM sales WHERE id=?").get(sale.id).status,
    "CANCELADA",
  );
  assert.ok(getDb().prepare("SELECT id FROM sale_cancellations WHERE sale_id=?").get(sale.id));
});

test("las vistas principales se renderizan después del formateo", async () => {
  const cashier = await login("cajero", "Cajero123!");
  await cashier
    .get("/pdv")
    .expect(200)
    .expect(/Punto de venta/);
  await cashier
    .get("/ventas")
    .expect(200)
    .expect(/Historial/);

  const administrator = await login("admin", "Admin123!");
  await administrator
    .get("/productos")
    .expect(200)
    .expect(/Catálogo/);

  const manager = await login("gerente", "Gerente123!");
  await manager
    .get("/usuarios")
    .expect(200)
    .expect(/Empleados/);

  const sale = getDb().prepare("SELECT id FROM sales ORDER BY id LIMIT 1").get();
  await manager
    .get(`/ventas/${sale.id}`)
    .expect(200)
    .expect(/Detalle de venta/);
});

test.after(() => closeDb());

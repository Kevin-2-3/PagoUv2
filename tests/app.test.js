/**
 * @file Pruebas de integración de acceso, permisos, inventario, ventas, caja, promociones e imágenes.
 */
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
/**
 * Crea un cliente de prueba con sesión y abre su caja si el usuario no es gerente y no tiene turno.
 * @param {string} username - Usuario de prueba.
 * @param {string} password - Contraseña de prueba.
 * @returns {Promise<Object>} Cliente Supertest autenticado que conserva las cookies.
 */
async function login(username, password) {
  const agent = request.agent(app);
  await agent.post("/login").type("form").send({ username, password }).expect(302);
  if (username !== "gerente") {
    const user = getDb().prepare("SELECT id FROM users WHERE username=?").get(username);
    if (!require("../src/services/cashService").current(user.id))
      await agent.post("/caja/abrir").type("form").send({ opening: "500" }).expect(302);
  }
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
    .send({ received: "100", items: [{ productId: p.id, quantity: 2 }] })
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
      .send({ received: "100", items: [{ productId: p.id, quantity: 3 }] })
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

test("ticket contiene los datos y no modifica la venta ni el inventario", async () => {
  const cashier = await login("cajero", "Cajero123!");
  const sale = getDb().prepare("SELECT * FROM sales WHERE status='COMPLETADA' LIMIT 1").get();
  const stock = getDb().prepare("SELECT id, stock FROM products ORDER BY id").all();
  const response = await cashier.get(`/ventas/${sale.id}/ticket`).expect(200);
  for (const label of [
    sale.folio,
    "Fecha",
    "Producto",
    "Cantidad",
    "Precio",
    "Subtotal",
    "Total",
  ]) {
    assert.ok(response.text.includes(label));
  }
  assert.doesNotMatch(response.text, /impuestos|método de pago/i);
  await cashier.get(`/ventas/${sale.id}/ticket`).expect(200);
  assert.deepEqual(getDb().prepare("SELECT id, stock FROM products ORDER BY id").all(), stock);
  const cancelled = getDb().prepare("SELECT id FROM sales WHERE status='CANCELADA' LIMIT 1").get();
  await cashier.get(`/ventas/${cancelled.id}/ticket`).expect(400);
  await request(app).get(`/ventas/${sale.id}/ticket`).expect(302);
});

test("impresión permite reintentar tras error del navegador", () => {
  const vm = require("node:vm");
  let click;
  const button = {
    addEventListener: (name, handler) => {
      click = handler;
    },
  };
  const status = {};
  let attempts = 0;
  vm.runInNewContext(fs.readFileSync("public/js/ticket.js", "utf8"), {
    document: { querySelector: (selector) => (selector === "#print-ticket" ? button : status) },
    window: {
      print: () => {
        attempts++;
        throw new Error("Print unavailable");
      },
      addEventListener() {},
    },
  });
  click();
  assert.match(status.textContent, /No se pudo/);
  assert.equal(button.textContent, "Reintentar impresión");
  click();
  assert.equal(attempts, 2);
});

test("carga PNG, JPG y WebP; edición conserva o sustituye la imagen", async () => {
  const sharp = require("sharp");
  const admin = await login("admin", "Admin123!");
  const base = sharp({ create: { width: 10, height: 10, channels: 3, background: "red" } });
  for (const format of ["png", "jpeg", "webp"]) {
    const buffer = await base.clone().toFormat(format).toBuffer();
    await admin
      .post("/productos/nuevo")
      .field("code", `IMG-${format}`)
      .field("name", "Imagen prueba")
      .field("price", "10")
      .field("stock", "2")
      .field("category_id", "1")
      .attach("image", buffer, { filename: `product.${format}`, contentType: `image/${format}` })
      .expect(302);
    const product = getDb().prepare("SELECT * FROM products WHERE code=?").get(`IMG-${format}`);
    const result = await admin
      .get(`/productos/${product.id}/imagen`)
      .expect(200)
      .expect("Content-Type", /image\/webp/);
    assert.equal((await sharp(result.body).metadata()).format, "webp");
    await admin
      .post(`/productos/${product.id}/editar`)
      .type("form")
      .send({ code: product.code, name: "Editado", price: "11", stock: "3", category_id: "1" })
      .expect(302);
    assert.deepEqual(
      getDb().prepare("SELECT image_data FROM products WHERE id=?").get(product.id).image_data,
      product.image_data,
    );
    const blue = await sharp({ create: { width: 8, height: 8, channels: 3, background: "blue" } })
      .png()
      .toBuffer();
    await admin
      .post(`/productos/${product.id}/editar`)
      .field("code", product.code)
      .field("name", "Nueva imagen")
      .field("price", "10")
      .field("stock", "2")
      .field("category_id", "1")
      .attach("image", blue, { filename: "new.png", contentType: "image/png" })
      .expect(302);
    assert.notDeepEqual(
      getDb().prepare("SELECT image_data FROM products WHERE id=?").get(product.id).image_data,
      product.image_data,
    );
  }
});

test("imágenes inválidas, falsas y grandes se rechazan sin cambiar el producto", async () => {
  const admin = await login("admin", "Admin123!");
  const product = getDb().prepare("SELECT * FROM products WHERE code='IMG-png'").get();
  const cases = [
    [Buffer.from("<svg></svg>"), "bad.svg", "image/svg+xml"],
    [Buffer.from("not a picture"), "fake.png", "image/png"],
    [Buffer.alloc(2 * 1024 * 1024 + 1), "big.jpg", "image/jpeg"],
  ];
  for (const [buffer, filename, contentType] of cases) {
    await admin
      .post(`/productos/${product.id}/editar`)
      .field("code", product.code)
      .field("name", "No guardar")
      .field("price", "0")
      .field("stock", "0")
      .field("category_id", "1")
      .attach("image", buffer, { filename, contentType })
      .expect(400);
    assert.deepEqual(getDb().prepare("SELECT * FROM products WHERE id=?").get(product.id), product);
  }
});

test("imagen predeterminada, permisos y 20 imágenes demo persistentes", async () => {
  const admin = await login("admin", "Admin123!");
  const noImage = getDb().prepare("SELECT id FROM products WHERE code='TEST01'").get();
  const fallback = await admin.get(`/productos/${noImage.id}/imagen`).expect(200);
  assert.deepEqual(fallback.body, fs.readFileSync("public/images/default.webp"));
  const cashier = await login("cajero", "Cajero123!");
  await cashier.post(`/productos/${noImage.id}/editar`).expect(403);
  const { demoImages, migrateImages } = require("../src/database/productImages");
  const before = getDb().prepare("SELECT id,stock FROM products ORDER BY id").all();
  migrateImages(getDb());
  for (const code of Object.keys(demoImages)) {
    assert.ok(
      getDb().prepare("SELECT image_data FROM products WHERE code=?").get(code).image_data.length >
        0,
    );
  }
  assert.deepEqual(getDb().prepare("SELECT id,stock FROM products ORDER BY id").all(), before);
  const Database = require("better-sqlite3");
  const legacy = new Database(":memory:");
  legacy.exec(
    "CREATE TABLE products(id INTEGER PRIMARY KEY,code TEXT,stock INTEGER); INSERT INTO products VALUES(1,'BEB001',7)",
  );
  migrateImages(legacy);
  assert.equal(legacy.prepare("SELECT stock FROM products").get().stock, 7);
  assert.ok(legacy.prepare("SELECT image_data FROM products").get().image_data);
  legacy.close();
});

test("efectivo insuficiente o inválido no registra ni descuenta; pago exacto y cambio persistentes", async () => {
  const cashier = await login("cajero", "Cajero123!");
  const p = getDb().prepare("SELECT * FROM products WHERE code='BEB001'").get();
  const count = getDb().prepare("SELECT count(*) n FROM sales").get().n;
  for (const received of [undefined, "", "-1", "1", "1.001", "NaN", "1e9"]) {
    await cashier
      .post("/api/ventas")
      .send({ received, items: [{ productId: p.id, quantity: 1 }] })
      .expect(400);
  }
  assert.equal(getDb().prepare("SELECT stock FROM products WHERE id=?").get(p.id).stock, p.stock);
  assert.equal(getDb().prepare("SELECT count(*) n FROM sales").get().n, count);
  const exact = await cashier
    .post("/api/ventas")
    .send({ received: (p.price_cents / 100).toFixed(2), items: [{ productId: p.id, quantity: 1 }] })
    .expect(201);
  assert.equal(exact.body.changeCents, 0);
  const paid = await cashier
    .post("/api/ventas")
    .send({ received: "270", items: [{ productId: p.id, quantity: 1 }] })
    .expect(201);
  assert.equal(paid.body.changeCents, 27000 - p.price_cents);
  const saved = getDb().prepare("SELECT * FROM sales WHERE id=?").get(paid.body.id);
  assert.equal(saved.received_cents, 27000);
  assert.equal(saved.change_cents, paid.body.changeCents);
  await cashier
    .get(`/ventas/${saved.id}/ticket`)
    .expect(200)
    .expect(/Cambio/);
});

test("eliminar empleado exige gerente y confirmación, revoca sesión y conserva ventas", async () => {
  const manager = await login("gerente", "Gerente123!");
  const admin = await login("admin", "Admin123!");
  const users = require("../src/services/userService");
  const id = Number(
    users.create({
      name: "Empleado temporal",
      username: "temporal",
      password: "Temporal123!",
      role: "CAJERO",
    }),
  );
  const employee = await login("temporal", "Temporal123!");
  const sale = await employee
    .post("/api/ventas")
    .send({ received: "100", items: [{ productId: 1, quantity: 1 }] })
    .expect(201);
  await admin.post(`/usuarios/${id}/eliminar`).send({ confirm: "yes" }).expect(403);
  await manager.post(`/usuarios/${id}/eliminar`).send({}).expect(400);
  await manager.post(`/usuarios/${id}/eliminar`).send({ confirm: "yes" }).expect(302);
  assert.ok(!users.list().some((u) => u.id === id));
  await request(app)
    .post("/login")
    .type("form")
    .send({ username: "temporal", password: "Temporal123!" })
    .expect(401);
  await employee.get("/pdv").expect(302);
  await employee
    .post("/api/ventas")
    .send({ received: "100", items: [{ productId: 1, quantity: 1 }] })
    .expect(401);
  await manager.post(`/usuarios/${id}/estado`).expect(404);
  await manager
    .get(`/ventas/${sale.body.id}`)
    .expect(200)
    .expect(/Empleado temporal/);
  const own = getDb().prepare("SELECT id FROM users WHERE username='gerente'").get();
  await manager.post(`/usuarios/${own.id}/eliminar`).send({ confirm: "yes" }).expect(400);
});

test("agregar stock y eliminar producto mantienen historial y rechazan operaciones no válidas", async () => {
  const admin = await login("admin", "Admin123!");
  const cashier = await login("cajero", "Cajero123!");
  const products = require("../src/services/productService");
  const id = Number(
    products.create({
      code: "DELETE-TEST",
      name: "Producto histórico",
      price: "20",
      stock: "3",
      category_id: "1",
    }),
  );
  await cashier.post(`/productos/${id}/existencias`).send({ quantity: 5 }).expect(403);
  for (const quantity of [0, -1, 1.5, "", "abc"]) {
    await admin.post(`/productos/${id}/existencias`).send({ quantity }).expect(400);
  }
  await admin.post(`/productos/${id}/existencias`).send({ quantity: 5 }).expect(302);
  assert.equal(products.get(id).stock, 8);
  const sale = await cashier
    .post("/api/ventas")
    .send({ received: "20", items: [{ productId: id, quantity: 1 }] })
    .expect(201);
  await admin.post(`/productos/${id}/eliminar`).send({}).expect(400);
  await cashier.post(`/productos/${id}/eliminar`).send({ confirm: "yes" }).expect(403);
  await admin.post(`/productos/${id}/eliminar`).send({ confirm: "yes" }).expect(302);
  assert.ok(!products.list().some((p) => p.id === id));
  await cashier
    .post("/api/ventas")
    .send({ received: "20", items: [{ productId: id, quantity: 1 }] })
    .expect(400);
  await admin.post(`/productos/${id}/estado`).expect(404);
  await admin.post(`/productos/${id}/existencias`).send({ quantity: 5 }).expect(404);
  await cashier
    .get(`/ventas/${sale.body.id}`)
    .expect(200)
    .expect(/Producto histórico/);
  await cashier
    .post(`/ventas/${sale.body.id}/cancelar`)
    .type("form")
    .send({ manager_username: "gerente", manager_pin: "2468" })
    .expect(302);
  const historical = getDb().prepare("SELECT * FROM products WHERE id=?").get(id);
  assert.equal(historical.stock, 8);
  assert.equal(historical.active, 0);
});

test("migración conserva ventas antiguas sin inventar pagos", () => {
  const Database = require("better-sqlite3");
  const db = new Database(":memory:");
  db.exec(
    "CREATE TABLE users(id INTEGER); CREATE TABLE products(id INTEGER); CREATE TABLE sales(id INTEGER,total_cents INTEGER); INSERT INTO sales VALUES(1,2300)",
  );
  const { migrateOperations } = require("../src/database/operationsMigration");
  migrateOperations(db);
  migrateOperations(db);
  const sale = db.prepare("SELECT * FROM sales").get();
  assert.equal(sale.total_cents, 2300);
  assert.equal(sale.received_cents, null);
  assert.equal(sale.change_cents, null);
  db.close();
});

test("todos los roles pueden consultar ventas ajenas y sus tickets", async () => {
  const sale = getDb()
    .prepare(
      "SELECT s.* FROM sales s JOIN users u ON u.id=s.cashier_id WHERE u.deleted_at IS NOT NULL AND s.status='COMPLETADA' LIMIT 1",
    )
    .get();
  for (const [username, password] of [
    ["cajero", "Cajero123!"],
    ["admin", "Admin123!"],
    ["gerente", "Gerente123!"],
  ]) {
    const agent = await login(username, password);
    const list = await agent.get("/ventas").expect(200);
    assert.ok(list.text.includes(sale.folio));
    await agent.get(`/ventas/${sale.id}`).expect(200);
    await agent.get(`/ventas/${sale.id}/ticket`).expect(200);
  }
});

test("fondo, tarjeta simulada, promociones y cuadre diario", async () => {
  const cash = require("../src/services/cashService");
  const promo = require("../src/services/promotionService");
  const db = getDb();
  const user = db.prepare("SELECT * FROM users WHERE username='admin'").get();
  if (cash.current(user.id)) cash.close(user.id, "500");
  const agent = request.agent(app);
  await agent
    .post("/login")
    .type("form")
    .send({ username: "admin", password: "Admin123!" })
    .expect(302)
    .expect("Location", "/caja");
  await agent.get("/pdv").expect(302).expect("Location", "/caja");
  await agent
    .post("/api/ventas")
    .send({ items: [{ productId: 2, quantity: 1 }], paymentMethod: "TARJETA" })
    .expect(400);
  await agent.post("/caja/abrir").type("form").send({ opening: "-1" }).expect(400);
  await agent.post("/caja/abrir").type("form").send({ opening: "500" }).expect(302);
  await agent.post("/caja/abrir").type("form").send({ opening: "500" }).expect(400);
  const shift = cash.current(user.id);
  const product = db
    .prepare(
      "SELECT * FROM products WHERE active=1 AND deleted_at IS NULL AND stock>=4 ORDER BY id LIMIT 1",
    )
    .get();
  const original = product.price_cents;
  await agent
    .post("/promociones")
    .type("form")
    .send({
      name: "Descuento prueba",
      percent: "25",
      starts_on: promo.today(),
      ends_on: promo.today(),
      products: [String(product.id)],
    })
    .expect(302);
  const price = Math.round(original * 0.75);
  const search = await agent.get("/api/productos").query({ q: product.code }).expect(200);
  assert.equal(search.body[0].price_cents, price);
  const card = await agent
    .post("/api/ventas")
    .send({ items: [{ productId: product.id, quantity: 2 }], paymentMethod: "TARJETA" })
    .expect(201);
  assert.equal(card.body.total, price * 2);
  assert.equal(card.body.changeCents, 0);
  const sale = db.prepare("SELECT * FROM sales WHERE id=?").get(card.body.id);
  assert.equal(sale.payment_method, "TARJETA");
  assert.equal(sale.subtotal_cents, original * 2);
  assert.equal(sale.shift_id, shift.id);
  await agent
    .get(`/ventas/${sale.id}/ticket`)
    .expect(200)
    .expect(/Tarjeta \(simulada\), pagada/)
    .expect(/Descuento prueba/);
  const paid = await agent
    .post("/api/ventas")
    .send({
      items: [{ productId: product.id, quantity: 1 }],
      received: "100",
      paymentMethod: "EFECTIVO",
    })
    .expect(201);
  assert.equal(paid.body.total, price);
  await agent
    .post("/api/ventas")
    .send({
      items: [{ productId: product.id, quantity: 1 }],
      received: "100",
      paymentMethod: "OTRO",
    })
    .expect(400);
  const cashier = await login("cajero", "Cajero123!");
  await cashier.get("/cortes").expect(403);
  await cashier.post("/promociones").send({}).expect(403);
  const manager = await login("gerente", "Gerente123!");
  await manager
    .get("/cortes")
    .expect(200)
    .expect(/Tarjeta \(simulada\)/);
  await manager.get("/cortes?date=2026-02-30").expect(400);
  await agent
    .post("/caja/cerrar")
    .type("form")
    .send({ counted: String((50000 + price) / 100) })
    .expect(302);
  const closed = db.prepare("SELECT * FROM cash_shifts WHERE id=?").get(shift.id);
  assert.equal(closed.expected_cents, 50000 + price);
  assert.equal(closed.card_cents, price * 2);
  assert.equal(closed.counted_cents - closed.expected_cents, 0);
  await agent
    .post("/api/ventas")
    .send({ items: [{ productId: product.id, quantity: 1 }], paymentMethod: "TARJETA" })
    .expect(400);
  await manager
    .post(`/ventas/${sale.id}/cancelar`)
    .type("form")
    .send({ manager_username: "gerente", manager_pin: "2468" })
    .expect(400);
  await agent.get("/promociones").expect(200);
  await agent.get("/caja").expect(200);
});
test.after(() => closeDb());

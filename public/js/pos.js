/**
 * @file Carrito, búsqueda de productos y registro de ventas desde el navegador.
 */
(() => {
  const search = document.querySelector("#product-search"),
    results = document.querySelector("#results"),
    itemsEl = document.querySelector("#ticket-items"),
    totalEl = document.querySelector("#total"),
    finish = document.querySelector("#finish-btn"),
    msg = document.querySelector("#pos-message");
  const cart = new Map();
  const received = document.querySelector("#received");
  const paymentMethod = document.querySelector("#payment-method");
  paymentMethod.addEventListener("change", updateCash);
  const cashFeedback = document.querySelector("#cash-feedback");
  let submitting = false;
  /**
   * Calcula el cambio, muestra la validación del efectivo y habilita el cobro cuando el carrito y el pago son válidos.
   * @returns {void} No devuelve un valor.
   */
  function updateCash() {
    const total = [...cart.values()].reduce(
      (sum, item) => sum + item.price_cents * item.quantity,
      0,
    );
    document.querySelector("#received-label").hidden = paymentMethod.value === "TARJETA";
    if (paymentMethod.value === "TARJETA") {
      cashFeedback.textContent = "Pago simulado con tarjeta. No se realiza ningún cargo real.";
      finish.disabled = submitting || !cart.size;
      return;
    }
    const valid = /^(0|[1-9]\d{0,8})(\.\d{1,2})?$/.test(received.value);
    const cents = valid ? Math.round(Number(received.value) * 100) : 0;
    cashFeedback.textContent = !valid
      ? "Ingresa un monto válido con máximo dos decimales."
      : cents < total
        ? `Efectivo insuficiente. Faltan ${money(total - cents)}`
        : `Cambio a devolver: ${money(cents - total)}`;
    finish.disabled = submitting || !cart.size || !valid || cents < total;
  }
  received.addEventListener("input", updateCash);
  /**
   * Da formato de pesos mexicanos a un importe en centavos.
   * @param {number} c - Importe en centavos.
   * @returns {string} Texto monetario.
   */
  const money = (c) =>
    new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
    }).format(c / 100);
  /**
   * Actualiza las partidas, cantidades y total del carrito en pantalla.
   * @returns {void} No devuelve un valor.
   */
  function render() {
    const values = [...cart.values()];
    finish.disabled = !values.length;
    updateCash();
    totalEl.textContent = money(values.reduce((s, x) => s + x.price_cents * x.quantity, 0));
    itemsEl.innerHTML = values.length
      ? values
          .map(
            (x) =>
              `<div class="ticket-row"><div><strong>${escapeHtml(x.name)}</strong><small class="muted">${escapeHtml(x.code)} · ${money(x.price_cents)}${x.promotion_name ? ` · ${escapeHtml(x.promotion_name)} (antes ${money(x.original_price_cents)})` : ""}</small></div><div class="qty"><button data-act="minus" data-id="${x.id}">−</button><b>${x.quantity}</b><button data-act="plus" data-id="${x.id}" ${x.quantity >= x.stock ? "disabled" : ""}>+</button></div><button class="remove" data-act="remove" data-id="${x.id}">×</button></div>`,
          )
          .join("")
      : '<div class="empty">Todavía no agregas productos</div>';
  }
  /**
   * Escapa caracteres especiales antes de insertar texto en HTML.
   * @param {*} s - Valor que se convierte a texto.
   * @returns {string} Texto con caracteres HTML escapados.
   */
  const escapeHtml = (s) =>
    String(s).replace(
      /[&<>'"]/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          "'": "&#39;",
          '"': "&quot;",
        })[c],
    );
  /**
   * Busca productos activos por el texto ingresado y muestra sus precios e imágenes.
   * @returns {Promise<void>} Se resuelve después de actualizar los resultados.
   * @throws {Error} Si falla la consulta o la lectura de la respuesta.
   */
  async function find() {
    const q = search.value.trim();
    if (!q) {
      results.innerHTML = '<div class="empty">Escribe para buscar productos activos</div>';
      return;
    }
    const data = await fetch(`/api/productos?q=${encodeURIComponent(q)}`).then((r) => r.json());
    results.innerHTML = data.length
      ? data
          .map(
            (p) =>
              `<button class="product-card" data-product='${escapeHtml(JSON.stringify(p))}'>
                <img src="/productos/${p.id}/imagen" alt="${escapeHtml(p.name)}" loading="lazy">
                <strong>${escapeHtml(p.name)}</strong>
                <small>${escapeHtml(p.code)} · ${p.stock} disponibles</small>
                <span>${money(p.price_cents)}${p.promotion_name ? ` · ${escapeHtml(p.promotion_name)}` : ""}</span>
              </button>`,
          )
          .join("")
      : '<div class="empty">No se encontraron productos</div>';
  }
  results.addEventListener("click", (e) => {
    const b = e.target.closest("[data-product]");
    if (!b) return;
    const p = JSON.parse(b.dataset.product),
      current = cart.get(p.id);
    if ((current?.quantity || 0) >= p.stock) {
      msg.textContent = "No hay más existencias disponibles";
      return;
    }
    cart.set(p.id, { ...p, quantity: (current?.quantity || 0) + 1 });
    msg.textContent = "";
    render();
  });
  itemsEl.addEventListener("click", (e) => {
    const b = e.target.closest("[data-act]");
    if (!b) return;
    const id = Number(b.dataset.id),
      x = cart.get(id);
    if (b.dataset.act === "plus" && x.quantity < x.stock) x.quantity++;
    if (b.dataset.act === "minus") {
      x.quantity--;
      if (!x.quantity) cart.delete(id);
    }
    if (b.dataset.act === "remove") cart.delete(id);
    render();
  });
  document.querySelector("#search-btn").onclick = find;
  search.addEventListener("keydown", (e) => {
    if (e.key === "Enter") find();
  });
  document.querySelector("#clear-btn").onclick = () => {
    cart.clear();
    received.value = "";
    render();
  };
  finish.onclick = async () => {
    updateCash();
    if (finish.disabled) return;
    submitting = true;
    finish.disabled = true;
    msg.textContent = "Registrando…";
    try {
      const r = await fetch("/api/ventas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentMethod: paymentMethod.value,
          received: received.value,
          items: [...cart.values()].map((x) => ({
            productId: x.id,
            quantity: x.quantity,
          })),
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      cart.clear();
      received.value = "";
      render();
      msg.style.color = "var(--green)";
      msg.innerHTML = `Venta <b>${escapeHtml(data.folio)}</b> registrada. <strong>${data.paymentMethod === "TARJETA" ? "Pagada con tarjeta (simulada)" : `Cambio a devolver: ${money(data.changeCents)}`}</strong>. <a href="/ventas/${data.id}">Ver detalle</a> · <a href="/ventas/${data.id}/ticket">Comprobante</a>`;
    } catch (e) {
      msg.style.color = "var(--red)";
      msg.textContent = e.message;
      render();
    } finally {
      submitting = false;
      updateCash();
    }
  };
})();

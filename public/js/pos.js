(() => {
  const search = document.querySelector("#product-search"),
    results = document.querySelector("#results"),
    itemsEl = document.querySelector("#ticket-items"),
    totalEl = document.querySelector("#total"),
    finish = document.querySelector("#finish-btn"),
    msg = document.querySelector("#pos-message");
  const cart = new Map();
  const money = (c) =>
    new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
    }).format(c / 100);
  function render() {
    const values = [...cart.values()];
    finish.disabled = !values.length;
    totalEl.textContent = money(values.reduce((s, x) => s + x.price_cents * x.quantity, 0));
    itemsEl.innerHTML = values.length
      ? values
          .map(
            (x) =>
              `<div class="ticket-row"><div><strong>${escapeHtml(x.name)}</strong><small class="muted">${escapeHtml(x.code)} · ${money(x.price_cents)}</small></div><div class="qty"><button data-act="minus" data-id="${x.id}">−</button><b>${x.quantity}</b><button data-act="plus" data-id="${x.id}" ${x.quantity >= x.stock ? "disabled" : ""}>+</button></div><button class="remove" data-act="remove" data-id="${x.id}">×</button></div>`,
          )
          .join("")
      : '<div class="empty">Todavía no agregas productos</div>';
  }
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
              `<button class="product-card" data-product='${JSON.stringify(p).replaceAll("'", "&#39;")}'><strong>${escapeHtml(p.name)}</strong><small>${escapeHtml(p.code)} · ${p.stock} disponibles</small><span>${money(p.price_cents)}</span></button>`,
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
    render();
  };
  finish.onclick = async () => {
    finish.disabled = true;
    msg.textContent = "Registrando…";
    try {
      const r = await fetch("/api/ventas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [...cart.values()].map((x) => ({
            productId: x.id,
            quantity: x.quantity,
          })),
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      cart.clear();
      render();
      msg.style.color = "var(--green)";
      msg.innerHTML = `Venta <b>${escapeHtml(data.folio)}</b> registrada. <a href="/ventas/${data.id}">Ver detalle</a>`;
    } catch (e) {
      msg.style.color = "var(--red)";
      msg.textContent = e.message;
      render();
    }
  };
})();

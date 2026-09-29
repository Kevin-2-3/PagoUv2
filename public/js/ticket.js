(() => {
  const button = document.querySelector("#print-ticket");
  const status = document.querySelector("#print-status");

  button.addEventListener("click", () => {
    try {
      status.textContent = "Abriendo impresión. Si no se imprime, puedes reintentar.";
      window.print();
    } catch (error) {
      status.textContent = "No se pudo abrir la impresión. Revisa tu navegador y reintenta.";
    } finally {
      button.textContent = "Reintentar impresión";
    }
  });

  window.addEventListener("afterprint", () => {
    status.textContent =
      "Diálogo cerrado. Si cancelaste o hubo un fallo en la impresora, revisa la conexión y reintenta. El navegador no confirma la impresión física.";
    button.textContent = "Reintentar impresión";
  });
})();

/**
 * @file Búsqueda y selección de productos para promociones.
 */
(() => {
  const search = document.querySelector('#promotion-search');
  const products = [...document.querySelectorAll('.promotion-product')];
  /**
   * Quita acentos, convierte a minúsculas y elimina espacios en los extremos.
   * @param {string} value - Texto de búsqueda.
   * @returns {string} Texto normalizado.
   */
  const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  /**
   * Filtra los productos por texto y actualiza los contadores de resultados y selecciones.
   * @returns {void} No devuelve un valor.
   */
  function filter() {
    const term = normalize(search.value);
    let visible = 0;
    for (const product of products) {
      product.hidden = !normalize(product.dataset.search).includes(term);
      if (!product.hidden) visible++;
    }
    const selected = products.filter(product => product.querySelector('input').checked).length;
    document.querySelector('#promotion-selection').textContent = `${visible} productos encontrados · ${selected} seleccionados`;
    document.querySelector('#promotion-empty').hidden = visible > 0;
  }
  search.addEventListener('input', filter);
  search.addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); filter(); }
  });
  document.querySelector('#promotion-search-button').addEventListener('click', filter);
  document.querySelector('#promotion-products').addEventListener('change', filter);
  filter();
})();

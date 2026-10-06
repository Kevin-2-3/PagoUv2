/**
 * @file Descarga y convierte las imágenes de ejemplo del inventario.
 */
const fs = require("fs/promises");
const path = require("path");
const sharp = require("sharp");
const { demoImages } = require("../src/database/productImages");

/**
 * Descarga los iconos de ejemplo de OpenMoji, los convierte a WebP de 256 por 256 píxeles y guarda la imagen predeterminada.
 * @returns {Promise<void>} Se resuelve al guardar todas las imágenes.
 * @throws {Error} Si una descarga o conversión falla.
 */
async function main() {
  const destination = path.join(__dirname, "../public/images/demo");
  await fs.mkdir(destination, { recursive: true });
  for (const code of new Set([...Object.values(demoImages), "1F4E6"])) {
    const url = `https://raw.githubusercontent.com/hfg-gmuend/openmoji/master/color/svg/${code}.svg`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Image download failed: ${code} (${response.status})`);
    const file =
      code === "1F4E6"
        ? path.join(destination, "../default.webp")
        : path.join(destination, `${code}.webp`);
    await sharp(Buffer.from(await response.arrayBuffer()))
      .resize(256, 256)
      .webp()
      .toFile(file);
    console.log(`Saved ${code}`);
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

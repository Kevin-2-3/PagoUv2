const fs = require("fs/promises");
const path = require("path");
const sharp = require("sharp");
const { demoImages } = require("../src/database/productImages");

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

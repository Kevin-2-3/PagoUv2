/**
 * @file Recibe una imagen JPG, PNG o WebP de hasta 2 MB, valida su contenido y la convierte a WebP para guardarla en req.productImage. Rechaza imágenes animadas o de más de 16 megapíxeles.
 */
const multer = require("multer");
const sharp = require("sharp");
const { AppError } = require("../utils/errors");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1, fields: 12 },
  fileFilter(req, file, callback) {
    const valid =
      /\.(jpe?g|png|webp)$/i.test(file.originalname) &&
      ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype);
    callback(valid ? null : new AppError("Formato no permitido. Usa JPG, PNG o WebP."), valid);
  },
}).single("image");

/**
 * Procesa el archivo del campo image y entrega el búfer convertido en req.productImage.
 * @param {import("express").Request} req - Solicitud con el archivo enviado.
 * @param {import("express").Response} res - Respuesta HTTP.
 * @param {import("express").NextFunction} next - Continúa o recibe un error de validación.
 * @returns {void} No devuelve un valor; la continuación ocurre mediante next.
 */
module.exports = (req, res, next) => {
  upload(req, res, async (error) => {
    if (error) {
      return next(
        error.code === "LIMIT_FILE_SIZE"
          ? new AppError("La imagen supera el tamaño permitido de 2 MB.")
          : error instanceof AppError
            ? error
            : new AppError("No se pudo recibir la imagen."),
      );
    }
    if (!req.file) return next();
    try {
      const source = sharp(req.file.buffer, { limitInputPixels: 16000000, failOn: "warning" });
      const meta = await source.metadata();
      if (!["jpeg", "png", "webp"].includes(meta.format) || (meta.pages || 1) !== 1) {
        throw new Error("Unsupported image");
      }
      req.productImage = await source
        .rotate()
        .resize(1000, 1000, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer();
      next();
    } catch {
      next(
        new AppError(
          "Imagen inválida o dañada. Usa JPG, PNG o WebP estático de hasta 16 megapíxeles.",
        ),
      );
    }
  });
};

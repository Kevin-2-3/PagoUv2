/**
 * @file Errores de la aplicación con estado HTTP.
 */
/**
 * Error de validación o de acceso que el manejador HTTP puede presentar al usuario.
 * @extends Error
 */
class AppError extends Error {
  /**
   * Crea un error con un mensaje y un código de estado HTTP.
   * @param {string} message - Descripción del error.
   * @param {number} [status=400] - Código HTTP que se enviará al cliente.
   */
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
module.exports = { AppError };

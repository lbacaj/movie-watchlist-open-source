class AppError extends Error {
  constructor(message, statusCode = 400, metadata = {}) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.metadata = metadata;
  }
}

module.exports = { AppError };

/**
 * Error Handler Utilities
 * Application specific error types
 */

class AppError extends Error {
  constructor(message, code = 'APP_ERROR', details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
  }
}

class APIError extends AppError {
  constructor(message, status = 500, details = {}) {
    super(message, 'API_ERROR', details);
    this.status = status;
  }
}

class StorageError extends AppError {
  constructor(message, operation = 'UNKNOWN', details = {}) {
    super(message, 'STORAGE_ERROR', details);
    this.operation = operation;
  }
}

export { AppError, APIError, StorageError };

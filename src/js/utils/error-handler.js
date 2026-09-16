/**
 * Error Handler Utility
 * Centralized error handling and recovery
 */

import { appLogger } from './logger.js';

class AppError extends Error {
  constructor(message, code = 'APP_ERROR', statusCode = 500, details = {}) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.timestamp = new Date();
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      details: this.details,
      timestamp: this.timestamp
    };
  }
}

class ValidationError extends AppError {
  constructor(message, details = {}) {
    super(message, 'VALIDATION_ERROR', 400, details);
    this.name = 'ValidationError';
  }
}

class NetworkError extends AppError {
  constructor(message, details = {}) {
    super(message, 'NETWORK_ERROR', 503, details);
    this.name = 'NetworkError';
  }
}

class AuthError extends AppError {
  constructor(message, details = {}) {
    super(message, 'AUTH_ERROR', 401, details);
    this.name = 'AuthError';
  }
}

class NotFoundError extends AppError {
  constructor(message, details = {}) {
    super(message, 'NOT_FOUND', 404, details);
    this.name = 'NotFoundError';
  }
}

class ErrorHandler {
  constructor() {
    this.errorHandlers = new Map();
    this.errorListeners = [];
    this.setupGlobalHandlers();
  }

  /**
   * Setup global error handlers
   */
  setupGlobalHandlers() {
    // Handle uncaught errors
    window.addEventListener('error', (event) => {
      this.handleError(event.error || new Error(event.message));
    });

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError(event.reason);
    });
  }

  /**
   * Register error handler for specific error type
   */
  register(errorType, handler) {
    if (!this.errorHandlers.has(errorType)) {
      this.errorHandlers.set(errorType, []);
    }
    this.errorHandlers.get(errorType).push(handler);
  }

  /**
   * Add error listener
   */
  on(listener) {
    this.errorListeners.push(listener);
  }

  /**
   * Remove error listener
   */
  off(listener) {
    this.errorListeners = this.errorListeners.filter(l => l !== listener);
  }

  /**
   * Handle error
   */
  handleError(error, context = {}) {
    // Normalize error
    const normalizedError = this.normalizeError(error);

    // Log error
    appLogger.error('Error handled', {
      ...normalizedError.toJSON(),
      context
    });

    // Call registered handlers
    const handlers = this.errorHandlers.get(normalizedError.constructor.name) || [];
    handlers.forEach(handler => {
      try {
        handler(normalizedError, context);
      } catch (e) {
        appLogger.error('Error in error handler', { error: e.message });
      }
    });

    // Notify listeners
    this.errorListeners.forEach(listener => {
      try {
        listener(normalizedError, context);
      } catch (e) {
        appLogger.error('Error in error listener', { error: e.message });
      }
    });

    return normalizedError;
  }

  /**
   * Normalize error to AppError
   */
  normalizeError(error) {
    if (error instanceof AppError) {
      return error;
    }

    if (error instanceof TypeError) {
      return new ValidationError(error.message, { originalError: error });
    }

    if (error instanceof SyntaxError) {
      return new AppError(error.message, 'SYNTAX_ERROR', 400, { originalError: error });
    }

    if (error instanceof Error) {
      return new AppError(error.message, 'UNKNOWN_ERROR', 500, { 
        stack: error.stack,
        originalError: error 
      });
    }

    if (typeof error === 'string') {
      return new AppError(error, 'STRING_ERROR', 500);
    }

    return new AppError('Unknown error occurred', 'UNKNOWN_ERROR', 500, { error });
  }

  /**
   * Create custom error
   */
  createError(message, code, statusCode = 500, details = {}) {
    return new AppError(message, code, statusCode, details);
  }

  /**
   * Handle API error
   */
  handleApiError(response) {
    let error;

    if (response.status === 401) {
      error = new AuthError(response.statusText);
    } else if (response.status === 404) {
      error = new NotFoundError(response.statusText);
    } else if (response.status >= 500) {
      error = new NetworkError('Server error');
    } else if (response.status >= 400) {
      error = new ValidationError('Request validation failed');
    } else {
      error = new AppError('API error', 'API_ERROR', response.status);
    }

    error.details.response = response;
    return this.handleError(error);
  }

  /**
   * Async error wrapper
   */
  async wrap(fn, context = {}) {
    try {
      return await fn();
    } catch (error) {
      return this.handleError(error, context);
    }
  }

  /**
   * Show user-friendly error message
   */
  showUserMessage(error) {
    const messages = {
      VALIDATION_ERROR: 'Lütfen girişlerinizi kontrol edin',
      NETWORK_ERROR: 'Ağ bağlantısında sorun var',
      AUTH_ERROR: 'Kimlik doğrulama başarısız',
      NOT_FOUND: 'İstenen kaynak bulunamadı',
      APP_ERROR: 'Bir hata oluştu'
    };

    const normalizedError = this.normalizeError(error);
    return messages[normalizedError.code] || normalizedError.message;
  }
}

// Global error handler instance
const errorHandler = new ErrorHandler();

export {
  ErrorHandler,
  AppError,
  ValidationError,
  NetworkError,
  AuthError,
  NotFoundError,
  errorHandler
};

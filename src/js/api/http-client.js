/**
 * HTTP Client Service
 * Wrapper for fetch with retry, timeout, caching and error handling
 */

import { apiLogger } from '../utils/logger.js';
import { APIError } from '../utils/error-handler.js';

class HTTPClient {
  constructor(options = {}) {
    this.baseURL = options.baseURL || '';
    this.timeout = options.timeout || 30000;
    this.retries = options.retries || 3;
    this.cache = new Map();
    this.cacheTimeout = options.cacheTimeout || 60000;
    this.headers = options.headers || {};
  }

  /**
   * Make HTTP request with retry logic
   */
  async request(method, url, options = {}) {
    const fullURL = url.startsWith('http') ? url : `${this.baseURL}${url}`;
    const cacheKey = `${method}:${fullURL}`;

    // Check cache for GET requests
    if (method === 'GET' && this.cache.has(cacheKey)) {
      const { data, timestamp } = this.cache.get(cacheKey);
      if (Date.now() - timestamp < this.cacheTimeout) {
        apiLogger.debug('Cache hit', { url: fullURL });
        return data;
      }
      this.cache.delete(cacheKey);
    }

    let lastError;
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      try {
        const response = await this.fetchWithTimeout(fullURL, {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...this.headers,
            ...options.headers
          },
          body: options.body ? JSON.stringify(options.body) : undefined,
          signal: options.signal
        });

        if (!response.ok) {
          throw new APIError(
            `HTTP ${response.status}: ${response.statusText}`,
            response.status,
            { url: fullURL, method }
          );
        }

        const data = await response.json();

        // Cache successful GET responses
        if (method === 'GET') {
          this.cache.set(cacheKey, { data, timestamp: Date.now() });
        }

        apiLogger.debug('Request successful', { method, url: fullURL });
        return data;
      } catch (error) {
        lastError = error;
        const isLastAttempt = attempt === this.retries;

        if (!isLastAttempt && this.isRetryable(error)) {
          const delay = Math.pow(2, attempt) * 1000;
          apiLogger.warn(`Retry attempt ${attempt + 1}/${this.retries}`, {
            url: fullURL,
            delay
          });
          await this.sleep(delay);
        } else if (isLastAttempt) {
          apiLogger.error('Request failed after retries', {
            url: fullURL,
            error: error.message
          });
        }
      }
    }

    throw lastError;
  }

  /**
   * Fetch with timeout
   */
  fetchWithTimeout(url, options) {
    return Promise.race([
      fetch(url, options),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error('Request timeout')),
          this.timeout
        )
      )
    ]);
  }

  /**
   * Determine if error is retryable
   */
  isRetryable(error) {
    if (error instanceof APIError) {
      // Retry on 5xx and 429 (rate limit)
      return error.status >= 500 || error.status === 429;
    }
    // Retry on network errors
    return error.message.includes('timeout') || error.message.includes('network');
  }

  /**
   * Helper to sleep
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * GET request
   */
  get(url, options) {
    return this.request('GET', url, options);
  }

  /**
   * POST request
   */
  post(url, body, options) {
    return this.request('POST', url, { ...options, body });
  }

  /**
   * PUT request
   */
  put(url, body, options) {
    return this.request('PUT', url, { ...options, body });
  }

  /**
   * DELETE request
   */
  delete(url, options) {
    return this.request('DELETE', url, options);
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
    apiLogger.debug('HTTP cache cleared');
  }

  /**
   * Set default headers
   */
  setHeaders(headers) {
    this.headers = { ...this.headers, ...headers };
  }
}

export { HTTPClient };

/**
 * API Service
 * Centralized API communication
 */

import { apiLogger } from '../utils/logger.js';
import { errorHandler, NetworkError } from '../utils/error-handler.js';

class APIService {
  constructor(baseURL = '/api', timeout = 30000) {
    this.baseURL = baseURL;
    this.timeout = timeout;
    this.headers = {
      'Content-Type': 'application/json'
    };
    this.interceptors = {
      request: [],
      response: [],
      error: []
    };
  }

  /**
   * Set authorization header
   */
  setAuthorization(token) {
    if (token) {
      this.headers['Authorization'] = `Bearer ${token}`;
    } else {
      delete this.headers['Authorization'];
    }
  }

  /**
   * Add request interceptor
   */
  addRequestInterceptor(interceptor) {
    this.interceptors.request.push(interceptor);
  }

  /**
   * Add response interceptor
   */
  addResponseInterceptor(interceptor) {
    this.interceptors.response.push(interceptor);
  }

  /**
   * Add error interceptor
   */
  addErrorInterceptor(interceptor) {
    this.interceptors.error.push(interceptor);
  }

  /**
   * Fetch with timeout
   */
  async fetchWithTimeout(url, options = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new NetworkError('Request timeout');
      }
      throw error;
    }
  }

  /**
   * Make request
   */
  async request(method, endpoint, options = {}) {
    const url = this.baseURL + endpoint;
    const requestOptions = {
      method,
      headers: { ...this.headers },
      ...options
    };

    // Apply request interceptors
    for (const interceptor of this.interceptors.request) {
      await interceptor(requestOptions);
    }

    apiLogger.debug(`${method} ${endpoint}`, { options: requestOptions });

    try {
      const response = await this.fetchWithTimeout(url, requestOptions);

      // Apply response interceptors
      for (const interceptor of this.interceptors.response) {
        await interceptor(response);
      }

      if (!response.ok) {
        const error = await errorHandler.handleApiError(response);
        throw error;
      }

      let data;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      apiLogger.debug(`${method} ${endpoint} - Success`, { status: response.status });
      return data;
    } catch (error) {
      // Apply error interceptors
      for (const interceptor of this.interceptors.error) {
        await interceptor(error);
      }

      apiLogger.error(`${method} ${endpoint} - Failed`, { error: error.message });
      throw error;
    }
  }

  /**
   * GET request
   */
  get(endpoint, options = {}) {
    return this.request('GET', endpoint, options);
  }

  /**
   * POST request
   */
  post(endpoint, data, options = {}) {
    return this.request('POST', endpoint, {
      body: JSON.stringify(data),
      ...options
    });
  }

  /**
   * PUT request
   */
  put(endpoint, data, options = {}) {
    return this.request('PUT', endpoint, {
      body: JSON.stringify(data),
      ...options
    });
  }

  /**
   * PATCH request
   */
  patch(endpoint, data, options = {}) {
    return this.request('PATCH', endpoint, {
      body: JSON.stringify(data),
      ...options
    });
  }

  /**
   * DELETE request
   */
  delete(endpoint, options = {}) {
    return this.request('DELETE', endpoint, options);
  }
}

// Global API service instance
const apiService = new APIService(process.env.REACT_APP_API_URL || '/api');

export { APIService, apiService };

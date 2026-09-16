/**
 * Data Service
 * Business logic and data management
 */

import { apiService } from './api-service.js';
import { serviceLogger } from '../utils/logger.js';
import { ValidationError } from '../utils/error-handler.js';

class DataService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Set cache
   */
  setCache(key, value, timeout = this.cacheTimeout) {
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      timeout
    });
  }

  /**
   * Get cache
   */
  getCache(key) {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > cached.timeout) {
      this.cache.delete(key);
      return null;
    }

    return cached.value;
  }

  /**
   * Clear cache
   */
  clearCache(key = null) {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Fetch Turkey stocks
   */
  async fetchTurkeyStocks() {
    const cacheKey = 'turkey_stocks';
    const cached = this.getCache(cacheKey);
    if (cached) return cached;

    try {
      const data = await apiService.get('/stocks/turkey');
      this.setCache(cacheKey, data);
      serviceLogger.info('Turkey stocks fetched', { count: data.length });
      return data;
    } catch (error) {
      serviceLogger.error('Failed to fetch Turkey stocks', { error: error.message });
      throw error;
    }
  }

  /**
   * Fetch cryptos
   */
  async fetchCryptos() {
    const cacheKey = 'cryptos';
    const cached = this.getCache(cacheKey);
    if (cached) return cached;

    try {
      const data = await apiService.get('/crypto');
      this.setCache(cacheKey, data);
      serviceLogger.info('Cryptos fetched', { count: data.length });
      return data;
    } catch (error) {
      serviceLogger.error('Failed to fetch cryptos', { error: error.message });
      throw error;
    }
  }

  /**
   * Fetch global symbols
   */
  async fetchGlobalSymbols() {
    const cacheKey = 'global_symbols';
    const cached = this.getCache(cacheKey);
    if (cached) return cached;

    try {
      const data = await apiService.get('/symbols/global');
      this.setCache(cacheKey, data);
      serviceLogger.info('Global symbols fetched', { count: data.length });
      return data;
    } catch (error) {
      serviceLogger.error('Failed to fetch global symbols', { error: error.message });
      throw error;
    }
  }

  /**
   * Fetch candlestick data
   */
  async fetchCandlestickData(symbol, interval = '1d', limit = 500) {
    if (!symbol) {
      throw new ValidationError('Symbol is required');
    }

    const cacheKey = `candlestick_${symbol}_${interval}`;
    const cached = this.getCache(cacheKey);
    if (cached) return cached;

    try {
      const data = await apiService.get(
        `/candlestick/${symbol}?interval=${interval}&limit=${limit}`
      );
      this.setCache(cacheKey, data);
      serviceLogger.debug('Candlestick data fetched', { symbol, interval, count: data.length });
      return data;
    } catch (error) {
      serviceLogger.error('Failed to fetch candlestick data', { symbol, error: error.message });
      throw error;
    }
  }

  /**
   * Fetch symbol details
   */
  async fetchSymbolDetails(symbol) {
    if (!symbol) {
      throw new ValidationError('Symbol is required');
    }

    const cacheKey = `symbol_${symbol}`;
    const cached = this.getCache(cacheKey);
    if (cached) return cached;

    try {
      const data = await apiService.get(`/symbol/${symbol}`);
      this.setCache(cacheKey, data);
      return data;
    } catch (error) {
      serviceLogger.error('Failed to fetch symbol details', { symbol, error: error.message });
      throw error;
    }
  }

  /**
   * Search symbols
   */
  async searchSymbols(query) {
    if (!query || query.length < 2) {
      throw new ValidationError('Query must be at least 2 characters');
    }

    try {
      const data = await apiService.get(`/search?q=${encodeURIComponent(query)}`);
      return data;
    } catch (error) {
      serviceLogger.error('Failed to search symbols', { query, error: error.message });
      throw error;
    }
  }

  /**
   * Fetch watchlist
   */
  async fetchWatchlist() {
    try {
      const data = await apiService.get('/watchlist');
      return data;
    } catch (error) {
      serviceLogger.error('Failed to fetch watchlist', { error: error.message });
      throw error;
    }
  }

  /**
   * Add to watchlist
   */
  async addToWatchlist(symbol) {
    if (!symbol) {
      throw new ValidationError('Symbol is required');
    }

    try {
      const data = await apiService.post('/watchlist', { symbol });
      this.clearCache('watchlist');
      serviceLogger.info('Symbol added to watchlist', { symbol });
      return data;
    } catch (error) {
      serviceLogger.error('Failed to add to watchlist', { symbol, error: error.message });
      throw error;
    }
  }

  /**
   * Remove from watchlist
   */
  async removeFromWatchlist(symbol) {
    if (!symbol) {
      throw new ValidationError('Symbol is required');
    }

    try {
      const data = await apiService.delete(`/watchlist/${symbol}`);
      this.clearCache('watchlist');
      serviceLogger.info('Symbol removed from watchlist', { symbol });
      return data;
    } catch (error) {
      serviceLogger.error('Failed to remove from watchlist', { symbol, error: error.message });
      throw error;
    }
  }

  /**
   * Fetch alerts
   */
  async fetchAlerts() {
    try {
      const data = await apiService.get('/alerts');
      return data;
    } catch (error) {
      serviceLogger.error('Failed to fetch alerts', { error: error.message });
      throw error;
    }
  }

  /**
   * Create alert
   */
  async createAlert(alertData) {
    if (!alertData.symbol || !alertData.price) {
      throw new ValidationError('Symbol and price are required');
    }

    try {
      const data = await apiService.post('/alerts', alertData);
      this.clearCache('alerts');
      serviceLogger.info('Alert created', { symbol: alertData.symbol });
      return data;
    } catch (error) {
      serviceLogger.error('Failed to create alert', { error: error.message });
      throw error;
    }
  }

  /**
   * Delete alert
   */
  async deleteAlert(alertId) {
    if (!alertId) {
      throw new ValidationError('Alert ID is required');
    }

    try {
      const data = await apiService.delete(`/alerts/${alertId}`);
      this.clearCache('alerts');
      serviceLogger.info('Alert deleted', { alertId });
      return data;
    } catch (error) {
      serviceLogger.error('Failed to delete alert', { alertId, error: error.message });
      throw error;
    }
  }
}

// Global data service instance
const dataService = new DataService();

export { DataService, dataService };

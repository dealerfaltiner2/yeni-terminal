/**
 * Data Service
 * API communication and data handling
 */

class DataService {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || '/api';
    this.timeout = options.timeout || 10000;
    this.cache = new Map();
    this.cacheExpiry = options.cacheExpiry || 60000; // 1 minute
  }

  /**
   * Make API request
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const config = {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      timeout: this.timeout
    };

    if (options.body) {
      config.body = JSON.stringify(options.body);
    }

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API Request Error:', error);
      throw error;
    }
  }

  /**
   * Get from cache or fetch
   */
  async getCachedOrFetch(key, fetcher) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.data;
    }

    const data = await fetcher();
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });

    return data;
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Fetch symbol data
   */
  async fetchSymbolData(symbol) {
    const cacheKey = `symbol_${symbol}`;
    return this.getCachedOrFetch(cacheKey, async () => {
      return this.request(`/symbols/${symbol}`);
    });
  }

  /**
   * Fetch chart data
   */
  async fetchChartData(symbol, timeframe = '1d') {
    const cacheKey = `chart_${symbol}_${timeframe}`;
    return this.getCachedOrFetch(cacheKey, async () => {
      return this.request(`/charts/${symbol}?timeframe=${timeframe}`);
    });
  }

  /**
   * Search symbols
   */
  async searchSymbols(query) {
    if (!query || query.length < 2) {
      return [];
    }

    const cacheKey = `search_${query}`;
    return this.getCachedOrFetch(cacheKey, async () => {
      return this.request(`/search?q=${encodeURIComponent(query)}`);
    });
  }

  /**
   * Fetch watchlist
   */
  async fetchWatchlist() {
    return this.request('/watchlist');
  }

  /**
   * Add to watchlist
   */
  async addToWatchlist(symbol) {
    this.clearCache();
    return this.request('/watchlist', {
      method: 'POST',
      body: { symbol }
    });
  }

  /**
   * Remove from watchlist
   */
  async removeFromWatchlist(symbol) {
    this.clearCache();
    return this.request(`/watchlist/${symbol}`, {
      method: 'DELETE'
    });
  }

  /**
   * Fetch market data
   */
  async fetchMarketData() {
    const cacheKey = 'market_data';
    return this.getCachedOrFetch(cacheKey, async () => {
      return this.request('/market');
    });
  }

  /**
   * Fetch trending symbols
   */
  async fetchTrendingSymbols() {
    const cacheKey = 'trending_symbols';
    return this.getCachedOrFetch(cacheKey, async () => {
      return this.request('/trending');
    });
  }

  /**
   * Fetch news
   */
  async fetchNews(symbol = null) {
    const endpoint = symbol ? `/news?symbol=${symbol}` : '/news';
    return this.request(endpoint);
  }

  /**
   * Place order
   */
  async placeOrder(orderData) {
    return this.request('/orders', {
      method: 'POST',
      body: orderData
    });
  }

  /**
   * Fetch orders
   */
  async fetchOrders() {
    return this.request('/orders');
  }

  /**
   * Cancel order
   */
  async cancelOrder(orderId) {
    return this.request(`/orders/${orderId}`, {
      method: 'DELETE'
    });
  }

  /**
   * Fetch account info
   */
  async fetchAccountInfo() {
    return this.request('/account');
  }

  /**
   * Fetch portfolio
   */
  async fetchPortfolio() {
    return this.request('/portfolio');
  }
}

// Create global instance
const dataService = new DataService({
  baseUrl: process.env.API_BASE_URL || '/api',
  cacheExpiry: 60000
});

export { DataService, dataService };

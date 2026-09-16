/**
 * TradingView API Adapter
 * Scanner and data fetch from TradingView
 */

import { HTTPClient } from './http-client.js';
import { apiLogger } from '../utils/logger.js';
import { APIError } from '../utils/error-handler.js';

class TradingViewAPI {
  constructor() {
    this.client = new HTTPClient({
      baseURL: 'https://scanner.tradingview.com',
      timeout: 15000,
      retries: 2
    });

    this.columns = [
      'name',
      'description',
      'close',
      'change',
      'change_abs',
      'open',
      'high',
      'low',
      'volume',
      'market_cap_basic',
      'price_earnings_ttm',
      'sector',
      'relative_volume_10d_calc',
      'average_volume_10d_calc'
    ];

    this.filter = [
      { left: 'type', operation: 'equal', right: 'stock' },
      { left: 'subtype', operation: 'in_range', right: ['common', 'foreign-issuer'] }
    ];
  }

  /**
   * Scan Turkish stocks
   */
  async scanTurkeyStocks(options = {}) {
    try {
      apiLogger.info('Scanning Turkish stocks from TradingView');

      const body = {
        filter: this.filter,
        options: { lang: 'tr' },
        markets: ['turkey'],
        symbols: { query: { types: [] }, tickers: [] },
        columns: this.columns,
        sort: {
          sortBy: 'market_cap_basic',
          sortOrder: 'desc'
        },
        range: [0, options.limit || 500]
      };

      const response = await this.client.post('/turkey/scan', body);

      if (!response?.data) {
        throw new Error('Invalid response from TradingView');
      }

      const stocks = response.data.map(row => this.mapRowToStock(row));
      apiLogger.info('TradingView scan completed', { count: stocks.length });

      return stocks;
    } catch (error) {
      apiLogger.error('TradingView scan failed', { error: error.message });
      throw new APIError(
        'TradingView taraması başarısız',
        500,
        { source: 'TradingView', originalError: error.message }
      );
    }
  }

  /**
   * Get global symbols (indices, forex, crypto)
   */
  async getGlobalSymbols() {
    try {
      apiLogger.info('Fetching global symbols');

      const tickers = [
        'BIST:XU100',
        'BIST:XU030',
        'BIST:XBANK',
        'BIST:XUSIN',
        'FX_IDC:USDTRY',
        'FX_IDC:EURTRY',
        'TVC:GOLD',
        'TVC:SILVER',
        'BINANCE:BTCUSDT',
        'BINANCE:ETHUSDT'
      ];

      const body = {
        symbols: { tickers },
        columns: ['name', 'close', 'change', 'change_abs']
      };

      const response = await this.client.post('/global/scan', body);
      return response?.data || [];
    } catch (error) {
      apiLogger.error('Failed to fetch global symbols', { error: error.message });
      return [];
    }
  }

  /**
   * Map TradingView row to stock object
   */
  mapRowToStock(row) {
    const data = row.d;
    return {
      ticker: row.s,
      name: data[0] || row.s,
      description: data[1] || '',
      close: data[2],
      change: data[3],
      changeAbs: data[4],
      open: data[5],
      high: data[6],
      low: data[7],
      volume: data[8],
      marketCap: data[9],
      pe: data[10],
      sector: data[11],
      relativeVolume: data[12],
      avgVolume: data[13]
    };
  }
}

export { TradingViewAPI };

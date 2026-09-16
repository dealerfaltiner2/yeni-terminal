/**
 * Watchlist Component
 * Display and manage watchlist
 */

import { dataService } from '../services/data-service.js';
import { appLogger } from '../utils/logger.js';
import { notificationComponent } from './notification-component.js';

class WatchlistComponent {
  constructor(containerId, options = {}) {
    this.containerId = containerId;
    this.container = document.getElementById(containerId);
    this.options = {
      refreshInterval: 5000,
      ...options
    };
    this.watchlist = [];
    this.refreshTimer = null;
    this.listeners = [];
    this.init();
  }

  /**
   * Initialize component
   */
  async init() {
    if (!this.container) {
      appLogger.error('Watchlist container not found', { containerId: this.containerId });
      return;
    }

    await this.loadWatchlist();
    this.render();
    this.attachEventListeners();
    this.startRefresh();
    appLogger.debug('Watchlist component initialized');
  }

  /**
   * Load watchlist
   */
  async loadWatchlist() {
    try {
      this.watchlist = await dataService.fetchWatchlist();
      appLogger.info('Watchlist loaded', { count: this.watchlist.length });
    } catch (error) {
      appLogger.error('Failed to load watchlist', { error: error.message });
      notificationComponent.error('Failed to load watchlist');
    }
  }

  /**
   * Render component
   */
  render() {
    if (this.watchlist.length === 0) {
      this.container.innerHTML = `
        <div style="
          padding: 32px;
          text-align: center;
          color: #999;
        ">
          <p>No items in watchlist</p>
        </div>
      `;
      return;
    }

    this.container.innerHTML = `
      <table style="
        width: 100%;
        border-collapse: collapse;
        font-size: 14px;
      ">
        <thead>
          <tr style="border-bottom: 2px solid #ddd;">
            <th style="padding: 12px; text-align: left; font-weight: bold;">Symbol</th>
            <th style="padding: 12px; text-align: right; font-weight: bold;">Price</th>
            <th style="padding: 12px; text-align: right; font-weight: bold;">Change %</th>
            <th style="padding: 12px; text-align: center; font-weight: bold;">Action</th>
          </tr>
        </thead>
        <tbody>
          ${this.watchlist
            .map(item => `
              <tr 
                class="watchlist-item"
                data-symbol="${item.symbol}"
                style="
                  border-bottom: 1px solid #eee;
                  transition: background 0.2s;
                "
              >
                <td style="padding: 12px;">${item.symbol}</td>
                <td style="padding: 12px; text-align: right;">${item.price?.toFixed(2) || 'N/A'}</td>
                <td style="
                  padding: 12px;
                  text-align: right;
                  color: ${(item.changePercent || 0) >= 0 ? '#10b981' : '#ef4444'};
                  font-weight: bold;
                ">
                  ${(item.changePercent || 0) >= 0 ? '+' : ''}${(item.changePercent || 0).toFixed(2)}%
                </td>
                <td style="padding: 12px; text-align: center;">
                  <button 
                    class="remove-btn"
                    data-symbol="${item.symbol}"
                    style="
                      background: #ef4444;
                      color: white;
                      border: none;
                      padding: 6px 12px;
                      border-radius: 4px;
                      cursor: pointer;
                      font-size: 12px;
                    "
                  >
                    Remove
                  </button>
                </td>
              </tr>
            `)
            .join('')}
        </tbody>
      </table>
    `;
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    this.container.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const symbol = e.target.getAttribute('data-symbol');
        this.removeFromWatchlist(symbol);
      });
    });

    this.container.querySelectorAll('.watchlist-item').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('.remove-btn')) return;
        const symbol = row.getAttribute('data-symbol');
        this.notifyListeners('select', symbol);
      });
    });
  }

  /**
   * Add to watchlist
   */
  async addToWatchlist(symbol) {
    try {
      await dataService.addToWatchlist(symbol);
      await this.loadWatchlist();
      this.render();
      this.attachEventListeners();
      notificationComponent.success(`${symbol} added to watchlist`);
      appLogger.info('Added to watchlist', { symbol });
    } catch (error) {
      appLogger.error('Failed to add to watchlist', { symbol, error: error.message });
      notificationComponent.error('Failed to add to watchlist');
    }
  }

  /**
   * Remove from watchlist
   */
  async removeFromWatchlist(symbol) {
    try {
      await dataService.removeFromWatchlist(symbol);
      await this.loadWatchlist();
      this.render();
      this.attachEventListeners();
      notificationComponent.success(`${symbol} removed from watchlist`);
      appLogger.info('Removed from watchlist', { symbol });
    } catch (error) {
      appLogger.error('Failed to remove from watchlist', { symbol, error: error.message });
      notificationComponent.error('Failed to remove from watchlist');
    }
  }

  /**
   * Refresh watchlist data
   */
  async refresh() {
    try {
      await this.loadWatchlist();
      this.render();
      this.attachEventListeners();
    } catch (error) {
      appLogger.error('Failed to refresh watchlist', { error: error.message });
    }
  }

  /**
   * Start auto-refresh
   */
  startRefresh() {
    this.stopRefresh();
    this.refreshTimer = setInterval(() => {
      this.refresh();
    }, this.options.refreshInterval);
  }

  /**
   * Stop auto-refresh
   */
  stopRefresh() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  /**
   * Add listener
   */
  addListener(listener) {
    this.listeners.push(listener);
  }

  /**
   * Notify listeners
   */
  notifyListeners(action, symbol) {
    this.listeners.forEach(listener => {
      try {
        listener({ action, symbol });
      } catch (error) {
        appLogger.error('Error in watchlist listener', { error: error.message });
      }
    });
  }

  /**
   * Destroy component
   */
  destroy() {
    this.stopRefresh();
  }
}

export { WatchlistComponent };

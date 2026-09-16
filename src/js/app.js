/**
 * Main Application
 * Trading Terminal Application Entry Point
 */

import { ChartComponent } from './components/chart-component.js';
import { NotificationComponent, notificationComponent } from './components/notification-component.js';
import { SearchComponent } from './components/search-component.js';
import { WatchlistComponent } from './components/watchlist-component.js';
import { AlertComponent, AlertType, alertComponent } from './components/alert-component.js';
import { dataService } from './services/data-service.js';
import { appLogger } from './utils/logger.js';

class TradingTerminalApp {
  constructor() {
    this.components = {};
    this.currentSymbol = null;
    this.init();
  }

  /**
   * Initialize application
   */
  async init() {
    try {
      appLogger.info('Initializing Trading Terminal Application');
      
      // Wait for DOM to be ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.setupComponents());
      } else {
        this.setupComponents();
      }
    } catch (error) {
      appLogger.error('Failed to initialize application', { error: error.message });
      notificationComponent.error('Failed to initialize application');
    }
  }

  /**
   * Setup components
   */
  setupComponents() {
    try {
      appLogger.debug('Setting up components');

      // Initialize Search Component
      this.components.search = new SearchComponent('search-container', {
        placeholder: 'Search symbols...'
      });
      this.components.search.addListener((symbol) => {
        this.loadSymbolData(symbol);
      });

      // Initialize Watchlist Component
      this.components.watchlist = new WatchlistComponent('watchlist-container');
      this.components.watchlist.addListener(({ action, symbol }) => {
        if (action === 'select') {
          this.loadSymbolData(symbol);
        }
      });

      // Initialize Chart Component
      const chartCanvas = document.getElementById('chart-container');
      if (chartCanvas) {
        this.components.chart = new ChartComponent('chart-container', {
          type: 'line',
          responsive: true
        });
      }

      // Initialize Alerts
      alertComponent.addListener(({ action, alert, data }) => {
        if (action === 'triggered') {
          this.handleAlertTriggered(alert, data);
        }
      });

      // Setup event listeners
      this.attachGlobalListeners();

      appLogger.info('Components setup complete');
      notificationComponent.success('Application ready');
    } catch (error) {
      appLogger.error('Failed to setup components', { error: error.message });
      notificationComponent.error('Failed to setup components');
    }
  }

  /**
   * Attach global event listeners
   */
  attachGlobalListeners() {
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === '/') {
          e.preventDefault();
          this.components.search?.searchInput?.focus();
        }
      }
    });
  }

  /**
   * Load symbol data
   */
  async loadSymbolData(symbol) {
    try {
      appLogger.debug('Loading symbol data', { symbol });
      notificationComponent.info(`Loading ${symbol}...`);

      this.currentSymbol = symbol;

      // Fetch data
      const symbolData = await dataService.fetchSymbolData(symbol);
      const chartData = await dataService.fetchChartData(symbol);

      // Update chart
      if (this.components.chart) {
        const chartLineData = this.components.chart.createLineData(
          symbol,
          chartData.prices,
          '#3b82f6'
        );
        this.components.chart.init(chartLineData);
      }

      // Display symbol info
      this.displaySymbolInfo(symbolData);

      appLogger.info('Symbol data loaded', { symbol });
      notificationComponent.success(`${symbol} loaded`);
    } catch (error) {
      appLogger.error('Failed to load symbol data', { symbol, error: error.message });
      notificationComponent.error(`Failed to load ${symbol}`);
    }
  }

  /**
   * Display symbol info
   */
  displaySymbolInfo(data) {
    const infoContainer = document.getElementById('symbol-info');
    if (!infoContainer) return;

    const priceColor = (data.changePercent || 0) >= 0 ? '#10b981' : '#ef4444';

    infoContainer.innerHTML = `
      <div style="padding: 20px; background: #f9fafb; border-radius: 8px;">
        <h2 style="margin: 0 0 16px 0;">${data.symbol}</h2>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
          <div>
            <div style="color: #999; font-size: 12px;">Price</div>
            <div style="font-size: 24px; font-weight: bold;">${data.price?.toFixed(2) || 'N/A'}</div>
          </div>
          <div>
            <div style="color: #999; font-size: 12px;">Change</div>
            <div style="font-size: 24px; font-weight: bold; color: ${priceColor};">
              ${(data.changePercent || 0) >= 0 ? '+' : ''}${(data.changePercent || 0).toFixed(2)}%
            </div>
          </div>
          <div>
            <div style="color: #999; font-size: 12px;">High</div>
            <div style="font-size: 16px;">${data.high?.toFixed(2) || 'N/A'}</div>
          </div>
          <div>
            <div style="color: #999; font-size: 12px;">Low</div>
            <div style="font-size: 16px;">${data.low?.toFixed(2) || 'N/A'}</div>
          </div>
        </div>
        <div style="margin-top: 16px;">
          <button 
            id="add-to-watchlist-btn"
            style="
              padding: 10px 16px;
              background: #3b82f6;
              color: white;
              border: none;
              border-radius: 4px;
              cursor: pointer;
              margin-right: 8px;
            "
          >
            Add to Watchlist
          </button>
          <button 
            id="set-alert-btn"
            style="
              padding: 10px 16px;
              background: #f59e0b;
              color: white;
              border: none;
              border-radius: 4px;
              cursor: pointer;
            "
          >
            Set Alert
          </button>
        </div>
      </div>
    `;

    // Attach button listeners
    document.getElementById('add-to-watchlist-btn')?.addEventListener('click', () => {
      this.components.watchlist.addToWatchlist(data.symbol);
    });

    document.getElementById('set-alert-btn')?.addEventListener('click', () => {
      this.showAlertDialog(data.symbol);
    });
  }

  /**
   * Show alert dialog
   */
  showAlertDialog(symbol) {
    const alertType = prompt('Alert type: (1) Price above, (2) Price below, (3) Change %');
    if (!alertType) return;

    const value = parseFloat(prompt('Alert value:'));
    if (isNaN(value)) return;

    const typeMap = {
      '1': AlertType.PRICE_ABOVE,
      '2': AlertType.PRICE_BELOW,
      '3': AlertType.CHANGE_PERCENT
    };

    const type = typeMap[alertType];
    if (!type) {
      notificationComponent.error('Invalid alert type');
      return;
    }

    const alert = alertComponent.createAlert(symbol, type, value, { autoRemove: false });
    if (alert) {
      notificationComponent.success(`Alert created for ${symbol}`);
    }
  }

  /**
   * Handle alert triggered
   */
  handleAlertTriggered(alert, data) {
    appLogger.info('Alert triggered', { symbol: alert.symbol });
    // Additional handling can be added here
  }

  /**
   * Destroy application
   */
  destroy() {
    Object.values(this.components).forEach(component => {
      if (component?.destroy) {
        component.destroy();
      }
    });
    alertComponent.destroy();
  }
}

// Initialize application when DOM is ready
const app = new TradingTerminalApp();

export { TradingTerminalApp, app };

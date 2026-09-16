/**
 * Alert Component
 * Price alert system
 */

import { dataService } from '../services/data-service.js';
import { appLogger } from '../utils/logger.js';
import { notificationComponent } from './notification-component.js';

const AlertType = {
  PRICE_ABOVE: 'price_above',
  PRICE_BELOW: 'price_below',
  CHANGE_PERCENT: 'change_percent'
};

class Alert {
  constructor(symbol, type, value, options = {}) {
    this.id = `alert_${Date.now()}_${Math.random()}`;
    this.symbol = symbol;
    this.type = type;
    this.value = value;
    this.createdAt = new Date();
    this.isActive = true;
    this.options = options;
  }

  /**
   * Check if alert is triggered
   */
  isTriggered(currentPrice, changePercent = 0) {
    if (!this.isActive) return false;

    switch (this.type) {
      case AlertType.PRICE_ABOVE:
        return currentPrice >= this.value;
      case AlertType.PRICE_BELOW:
        return currentPrice <= this.value;
      case AlertType.CHANGE_PERCENT:
        return Math.abs(changePercent) >= this.value;
      default:
        return false;
    }
  }

  /**
   * Deactivate alert
   */
  deactivate() {
    this.isActive = false;
  }

  /**
   * Get description
   */
  getDescription() {
    const descriptions = {
      [AlertType.PRICE_ABOVE]: `${this.symbol} price above $${this.value.toFixed(2)}`,
      [AlertType.PRICE_BELOW]: `${this.symbol} price below $${this.value.toFixed(2)}`,
      [AlertType.CHANGE_PERCENT]: `${this.symbol} change ${this.value.toFixed(2)}%`
    };
    return descriptions[this.type] || 'Unknown alert';
  }
}

class AlertComponent {
  constructor(options = {}) {
    this.alerts = [];
    this.checkInterval = 5000;
    this.checkTimer = null;
    this.listeners = [];
    this.maxAlerts = 20;
    this.options = options;
    this.init();
  }

  /**
   * Initialize component
   */
  init() {
    this.loadAlerts();
    this.startChecking();
    appLogger.debug('Alert component initialized');
  }

  /**
   * Load alerts from storage
   */
  loadAlerts() {
    try {
      const stored = localStorage.getItem('trading_alerts');
      if (stored) {
        this.alerts = JSON.parse(stored);
      }
    } catch (error) {
      appLogger.error('Failed to load alerts', { error: error.message });
    }
  }

  /**
   * Save alerts to storage
   */
  saveAlerts() {
    try {
      localStorage.setItem('trading_alerts', JSON.stringify(this.alerts));
    } catch (error) {
      appLogger.error('Failed to save alerts', { error: error.message });
    }
  }

  /**
   * Create alert
   */
  createAlert(symbol, type, value, options = {}) {
    if (this.alerts.length >= this.maxAlerts) {
      notificationComponent.warning('Maximum alerts reached');
      return null;
    }

    const alert = new Alert(symbol, type, value, options);
    this.alerts.push(alert);
    this.saveAlerts();

    appLogger.info('Alert created', {
      id: alert.id,
      symbol,
      type,
      value
    });

    return alert;
  }

  /**
   * Remove alert
   */
  removeAlert(alertId) {
    this.alerts = this.alerts.filter(a => a.id !== alertId);
    this.saveAlerts();
    appLogger.debug('Alert removed', { alertId });
  }

  /**
   * Get all alerts
   */
  getAlerts() {
    return this.alerts;
  }

  /**
   * Get active alerts
   */
  getActiveAlerts() {
    return this.alerts.filter(a => a.isActive);
  }

  /**
   * Get alerts for symbol
   */
  getAlertsForSymbol(symbol) {
    return this.alerts.filter(a => a.symbol === symbol);
  }

  /**
   * Check alerts
   */
  async checkAlerts() {
    const activeAlerts = this.getActiveAlerts();
    if (activeAlerts.length === 0) return;

    const symbols = [...new Set(activeAlerts.map(a => a.symbol))];

    try {
      for (const symbol of symbols) {
        const data = await dataService.fetchSymbolData(symbol);
        const symbolAlerts = this.getAlertsForSymbol(symbol);

        symbolAlerts.forEach(alert => {
          if (alert.isTriggered(data.price, data.changePercent)) {
            this.triggerAlert(alert, data);
          }
        });
      }
    } catch (error) {
      appLogger.error('Failed to check alerts', { error: error.message });
    }
  }

  /**
   * Trigger alert
   */
  triggerAlert(alert, data) {
    const description = alert.getDescription();
    notificationComponent.warning(description, 0);

    appLogger.info('Alert triggered', {
      alertId: alert.id,
      symbol: alert.symbol,
      price: data.price
    });

    this.notifyListeners('triggered', alert, data);

    if (alert.options.autoRemove) {
      this.removeAlert(alert.id);
    } else {
      alert.deactivate();
      this.saveAlerts();
    }
  }

  /**
   * Start checking
   */
  startChecking() {
    this.stopChecking();
    this.checkTimer = setInterval(() => {
      this.checkAlerts();
    }, this.checkInterval);
  }

  /**
   * Stop checking
   */
  stopChecking() {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
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
  notifyListeners(action, alert, data) {
    this.listeners.forEach(listener => {
      try {
        listener({ action, alert, data });
      } catch (error) {
        appLogger.error('Error in alert listener', { error: error.message });
      }
    });
  }

  /**
   * Clear all inactive alerts
   */
  clearInactive() {
    this.alerts = this.alerts.filter(a => a.isActive);
    this.saveAlerts();
  }

  /**
   * Destroy component
   */
  destroy() {
    this.stopChecking();
  }
}

// Global alert instance
const alertComponent = new AlertComponent();

export { AlertComponent, AlertType, Alert, alertComponent };

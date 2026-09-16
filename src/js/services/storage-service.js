/**
 * Storage Service
 * Unified storage abstraction for localStorage and sessionStorage
 */

import { serviceLogger } from '../utils/logger.js';

class StorageService {
  constructor(type = 'local') {
    this.type = type;
    this.storage = type === 'local' ? localStorage : sessionStorage;
    this.prefix = 'app_';
    this.listeners = new Map();
  }

  /**
   * Get storage key
   */
  getKey(key) {
    return `${this.prefix}${key}`;
  }

  /**
   * Set value
   */
  set(key, value) {
    try {
      const storageKey = this.getKey(key);
      const serialized = JSON.stringify({
        value,
        timestamp: Date.now()
      });
      this.storage.setItem(storageKey, serialized);
      this.notifyListeners(key, value);
      serviceLogger.debug('Value stored', { key, type: this.type });
    } catch (error) {
      serviceLogger.error('Failed to store value', { key, error: error.message });
      throw error;
    }
  }

  /**
   * Get value
   */
  get(key, defaultValue = null) {
    try {
      const storageKey = this.getKey(key);
      const item = this.storage.getItem(storageKey);

      if (!item) {
        return defaultValue;
      }

      const parsed = JSON.parse(item);
      return parsed.value;
    } catch (error) {
      serviceLogger.warn('Failed to retrieve value', { key, error: error.message });
      return defaultValue;
    }
  }

  /**
   * Remove value
   */
  remove(key) {
    try {
      const storageKey = this.getKey(key);
      this.storage.removeItem(storageKey);
      this.notifyListeners(key, null);
      serviceLogger.debug('Value removed', { key });
    } catch (error) {
      serviceLogger.error('Failed to remove value', { key, error: error.message });
      throw error;
    }
  }

  /**
   * Clear all storage
   */
  clear() {
    try {
      const keys = Object.keys(this.storage)
        .filter(k => k.startsWith(this.prefix))
        .map(k => k.replace(this.prefix, ''));

      keys.forEach(key => this.remove(key));
      serviceLogger.info('Storage cleared');
    } catch (error) {
      serviceLogger.error('Failed to clear storage', { error: error.message });
      throw error;
    }
  }

  /**
   * Get all keys
   */
  keys() {
    const keys = [];
    for (let i = 0; i < this.storage.length; i++) {
      const key = this.storage.key(i);
      if (key && key.startsWith(this.prefix)) {
        keys.push(key.replace(this.prefix, ''));
      }
    }
    return keys;
  }

  /**
   * Get all values
   */
  entries() {
    const entries = {};
    this.keys().forEach(key => {
      entries[key] = this.get(key);
    });
    return entries;
  }

  /**
   * Has key
   */
  has(key) {
    return this.get(key) !== null;
  }

  /**
   * Watch value changes
   */
  watch(key, listener) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, []);
    }
    this.listeners.get(key).push(listener);

    return () => {
      const listeners = this.listeners.get(key);
      if (listeners) {
        const index = listeners.indexOf(listener);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
    };
  }

  /**
   * Notify listeners
   */
  notifyListeners(key, value) {
    const listeners = this.listeners.get(key);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(value);
        } catch (error) {
          serviceLogger.error('Error in storage listener', { key, error: error.message });
        }
      });
    }
  }

  /**
   * Set with expiry
   */
  setWithExpiry(key, value, expiryMs) {
    const item = {
      value,
      expiry: Date.now() + expiryMs
    };
    this.set(key, item);
  }

  /**
   * Get with expiry check
   */
  getWithExpiry(key, defaultValue = null) {
    const item = this.get(key);
    if (!item) return defaultValue;

    if (item.expiry && Date.now() > item.expiry) {
      this.remove(key);
      return defaultValue;
    }

    return item.value;
  }
}

// Global storage instances
const storageService = new StorageService('local');
const sessionStorageService = new StorageService('session');

export { StorageService, storageService, sessionStorageService };

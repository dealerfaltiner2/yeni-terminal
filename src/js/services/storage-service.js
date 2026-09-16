/**
 * Storage Service
 * Abstraction for LocalStorage and IndexedDB
 */

import { serviceLogger } from '../utils/logger.js';
import { StorageError } from '../utils/error-handler.js';

class StorageService {
  constructor() {
    this.localStorage = window.localStorage;
    this.storeName = 'bist-terminal';
    this.dbVersion = 1;
    this.db = null;
    this.initPromise = this.initIndexedDB();
  }

  /**
   * Initialize IndexedDB
   */
  initIndexedDB() {
    return new Promise((resolve, reject) => {
      try {
        const request = indexedDB.open(this.storeName, this.dbVersion);

        request.onerror = () => {
          serviceLogger.warn('IndexedDB init failed, using localStorage only');
          resolve(null);
        };

        request.onsuccess = () => {
          this.db = request.result;
          serviceLogger.info('IndexedDB initialized');
          resolve(this.db);
        };

        request.onupgradeneeded = (event) => {
          const db = event.target.result;

          // Create object stores
          if (!db.objectStoreNames.contains('trades')) {
            db.createObjectStore('trades', { keyPath: 'id', autoIncrement: true });
          }

          if (!db.objectStoreNames.contains('journal')) {
            db.createObjectStore('journal', { keyPath: 'id', autoIncrement: true });
          }

          if (!db.objectStoreNames.contains('cache')) {
            db.createObjectStore('cache', { keyPath: 'key' });
          }

          serviceLogger.info('IndexedDB schema updated');
        };
      } catch (error) {
        serviceLogger.warn('IndexedDB not available');
        resolve(null);
      }
    });
  }

  /**
   * Set item in localStorage
   */
  setItem(key, value) {
    try {
      this.localStorage.setItem(key, JSON.stringify(value));
      serviceLogger.debug('LocalStorage item set', { key });
    } catch (error) {
      throw new StorageError('LocalStorage yazma hatası', 'WRITE', { key, error: error.message });
    }
  }

  /**
   * Get item from localStorage
   */
  getItem(key, defaultValue = null) {
    try {
      const item = this.localStorage.getItem(key);
      if (item === null) {
        return defaultValue;
      }
      return JSON.parse(item);
    } catch (error) {
      serviceLogger.warn('Failed to parse localStorage item', { key });
      return defaultValue;
    }
  }

  /**
   * Remove item from localStorage
   */
  removeItem(key) {
    try {
      this.localStorage.removeItem(key);
      serviceLogger.debug('LocalStorage item removed', { key });
    } catch (error) {
      throw new StorageError('LocalStorage silme hatası', 'DELETE', { key });
    }
  }

  /**
   * Clear all localStorage
   */
  clear() {
    try {
      this.localStorage.clear();
      serviceLogger.info('LocalStorage cleared');
    } catch (error) {
      throw new StorageError('LocalStorage temizleme hatası', 'CLEAR', {});
    }
  }

  /**
   * Add item to IndexedDB
   */
  async addToIDB(storeName, value) {
    await this.initPromise;

    if (!this.db) {
      throw new StorageError('IndexedDB kullanılamıyor', 'ADD', { storeName });
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.add(value);

        request.onsuccess = () => {
          serviceLogger.debug('IndexedDB item added', { storeName, id: request.result });
          resolve(request.result);
        };

        request.onerror = () => {
          reject(new StorageError('IndexedDB yazma hatası', 'ADD', { storeName }));
        };
      } catch (error) {
        reject(new StorageError('IndexedDB işlem hatası', 'ADD', { storeName, error: error.message }));
      }
    });
  }

  /**
   * Get all items from IndexedDB
   */
  async getAllFromIDB(storeName) {
    await this.initPromise;

    if (!this.db) {
      return [];
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();

        request.onsuccess = () => {
          serviceLogger.debug('IndexedDB items retrieved', { storeName, count: request.result.length });
          resolve(request.result);
        };

        request.onerror = () => {
          reject(new StorageError('IndexedDB okuma hatası', 'GET_ALL', { storeName }));
        };
      } catch (error) {
        reject(new StorageError('IndexedDB işlem hatası', 'GET_ALL', { storeName }));
      }
    });
  }

  /**
   * Clear IndexedDB store
   */
  async clearIDBStore(storeName) {
    await this.initPromise;

    if (!this.db) {
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.clear();

        request.onsuccess = () => {
          serviceLogger.info('IndexedDB store cleared', { storeName });
          resolve();
        };

        request.onerror = () => {
          reject(new StorageError('IndexedDB temizleme hatası', 'CLEAR', { storeName }));
        };
      } catch (error) {
        reject(new StorageError('IndexedDB işlem hatası', 'CLEAR', { storeName }));
      }
    });
  }

  /**
   * Export all data
   */
  async exportData() {
    const data = {
      localStorage: {},
      indexedDB: {}
    };

    // Export localStorage
    for (let i = 0; i < this.localStorage.length; i++) {
      const key = this.localStorage.key(i);
      data.localStorage[key] = this.getItem(key);
    }

    // Export IndexedDB if available
    if (this.db) {
      data.indexedDB.trades = await this.getAllFromIDB('trades');
      data.indexedDB.journal = await this.getAllFromIDB('journal');
    }

    return data;
  }

  /**
   * Import data
   */
  async importData(data) {
    // Import localStorage
    if (data.localStorage) {
      Object.entries(data.localStorage).forEach(([key, value]) => {
        this.setItem(key, value);
      });
    }

    // Import IndexedDB if available
    if (data.indexedDB && this.db) {
      if (data.indexedDB.trades) {
        await this.clearIDBStore('trades');
        for (const trade of data.indexedDB.trades) {
          await this.addToIDB('trades', trade);
        }
      }
    }

    serviceLogger.info('Data imported successfully');
  }
}

// Singleton instance
const storageService = new StorageService();

export { StorageService, storageService };

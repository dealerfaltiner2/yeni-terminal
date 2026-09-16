/**
 * Event Bus Service
 * Publish-Subscribe pattern for decoupled communication
 */

import { appLogger } from './logger.js';

class EventBus {
  constructor() {
    this.events = new Map();
    this.history = [];
    this.maxHistory = 100;
  }

  /**
   * Subscribe to an event
   * @param {string} eventName - Event name
   * @param {function} callback - Callback function
   * @returns {function} Unsubscribe function
   */
  on(eventName, callback) {
    if (!this.events.has(eventName)) {
      this.events.set(eventName, []);
    }

    this.events.get(eventName).push(callback);
    appLogger.debug(`Subscribed to event: ${eventName}`);

    // Return unsubscribe function
    return () => this.off(eventName, callback);
  }

  /**
   * Subscribe to event once
   */
  once(eventName, callback) {
    const wrappedCallback = (data) => {
      callback(data);
      this.off(eventName, wrappedCallback);
    };

    return this.on(eventName, wrappedCallback);
  }

  /**
   * Unsubscribe from event
   */
  off(eventName, callback) {
    if (!this.events.has(eventName)) {
      return;
    }

    const callbacks = this.events.get(eventName);
    const index = callbacks.indexOf(callback);
    if (index > -1) {
      callbacks.splice(index, 1);
      appLogger.debug(`Unsubscribed from event: ${eventName}`);
    }
  }

  /**
   * Emit event
   */
  emit(eventName, data) {
    const timestamp = new Date().toISOString();
    this.history.push({ eventName, data, timestamp });

    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    if (!this.events.has(eventName)) {
      appLogger.debug(`No subscribers for event: ${eventName}`);
      return;
    }

    const callbacks = this.events.get(eventName);
    callbacks.forEach((callback) => {
      try {
        callback(data);
      } catch (error) {
        appLogger.error(`Error in event callback for ${eventName}`, {
          error: error.message
        });
      }
    });
  }

  /**
   * Get event history
   */
  getHistory() {
    return [...this.history];
  }

  /**
   * Clear all listeners
   */
  clear() {
    this.events.clear();
    appLogger.debug('Cleared all event listeners');
  }

  /**
   * Get listener count
   */
  listenerCount(eventName) {
    return this.events.has(eventName) ? this.events.get(eventName).length : 0;
  }
}

export { EventBus };

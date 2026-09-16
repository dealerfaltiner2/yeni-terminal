/**
 * Notification Component
 * Toast and notification system
 */

import { appLogger } from '../utils/logger.js';

const NotificationType = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info'
};

class Notification {
  constructor(message, type = NotificationType.INFO, duration = 5000) {
    this.message = message;
    this.type = type;
    this.duration = duration;
    this.id = `notification_${Date.now()}_${Math.random()}`;
    this.element = null;
    this.timeoutId = null;
  }

  /**
   * Create notification element
   */
  createElement() {
    const colors = {
      [NotificationType.SUCCESS]: '#10b981',
      [NotificationType.ERROR]: '#ef4444',
      [NotificationType.WARNING]: '#f59e0b',
      [NotificationType.INFO]: '#3b82f6'
    };

    const icons = {
      [NotificationType.SUCCESS]: '✓',
      [NotificationType.ERROR]: '✕',
      [NotificationType.WARNING]: '⚠',
      [NotificationType.INFO]: 'ℹ'
    };

    const element = document.createElement('div');
    element.id = this.id;
    element.className = `notification notification-${this.type}`;
    element.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: white;
      border-left: 4px solid ${colors[this.type]};
      border-radius: 4px;
      padding: 16px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 9999;
      animation: slideIn 0.3s ease-out;
      font-family: system-ui, -apple-system, sans-serif;
      min-width: 300px;
    `;

    element.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        <span style="color: ${colors[this.type]}; font-weight: bold; font-size: 18px;">
          ${icons[this.type]}
        </span>
        <span style="flex: 1; color: #333;">${this.message}</span>
        <button style="
          background: none;
          border: none;
          cursor: pointer;
          color: #999;
          font-size: 18px;
          padding: 0;
        ">×</button>
      </div>
    `;

    // Close button handler
    element.querySelector('button').addEventListener('click', () => {
      this.close();
    });

    return element;
  }

  /**
   * Show notification
   */
  show() {
    this.element = this.createElement();
    document.body.appendChild(this.element);
    appLogger.debug('Notification shown', { id: this.id, type: this.type });

    if (this.duration > 0) {
      this.timeoutId = setTimeout(() => {
        this.close();
      }, this.duration);
    }
  }

  /**
   * Close notification
   */
  close() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }

    if (this.element) {
      this.element.style.animation = 'slideOut 0.3s ease-in';
      setTimeout(() => {
        if (this.element && this.element.parentNode) {
          this.element.parentNode.removeChild(this.element);
        }
      }, 300);
    }
  }
}

class NotificationComponent {
  constructor() {
    this.notifications = [];
    this.maxNotifications = 5;
    this.injectStyles();
  }

  /**
   * Inject styles
   */
  injectStyles() {
    if (document.getElementById('notification-styles')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'notification-styles';
    style.textContent = `
      @keyframes slideIn {
        from {
          transform: translateX(400px);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }

      @keyframes slideOut {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(400px);
          opacity: 0;
        }
      }

      .notification {
        transition: all 0.3s ease;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Show notification
   */
  show(message, type = NotificationType.INFO, duration = 5000) {
    const notification = new Notification(message, type, duration);
    notification.show();
    this.notifications.push(notification);

    // Remove old notifications if too many
    if (this.notifications.length > this.maxNotifications) {
      const oldest = this.notifications.shift();
      oldest.close();
    }

    return notification;
  }

  /**
   * Show success
   */
  success(message, duration = 5000) {
    return this.show(message, NotificationType.SUCCESS, duration);
  }

  /**
   * Show error
   */
  error(message, duration = 5000) {
    return this.show(message, NotificationType.ERROR, duration);
  }

  /**
   * Show warning
   */
  warning(message, duration = 5000) {
    return this.show(message, NotificationType.WARNING, duration);
  }

  /**
   * Show info
   */
  info(message, duration = 5000) {
    return this.show(message, NotificationType.INFO, duration);
  }

  /**
   * Clear all notifications
   */
  clearAll() {
    this.notifications.forEach(notification => {
      notification.close();
    });
    this.notifications = [];
  }
}

// Global notification instance
const notificationComponent = new NotificationComponent();

export { NotificationComponent, NotificationType, Notification, notificationComponent };

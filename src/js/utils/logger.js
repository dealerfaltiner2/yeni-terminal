/**
 * Logger Utility
 * Application logging system
 */

const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

class Logger {
  constructor(options = {}) {
    this.name = options.name || 'App';
    this.level = options.level || LogLevel.INFO;
    this.enabled = options.enabled !== false;
    this.storage = options.storage || false;
    this.maxLogs = options.maxLogs || 100;
    this.logs = [];
  }

  /**
   * Check if level is enabled
   */
  isLevelEnabled(level) {
    return this.enabled && level >= this.level;
  }

  /**
   * Format log message
   */
  formatMessage(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    const levelName = Object.keys(LogLevel).find(key => LogLevel[key] === level);
    const dataStr = Object.keys(data).length > 0 ? JSON.stringify(data) : '';
    return `[${timestamp}] [${this.name}] [${levelName}] ${message} ${dataStr}`;
  }

  /**
   * Store log
   */
  storeLog(level, message, data) {
    if (!this.storage) return;

    this.logs.push({
      timestamp: new Date(),
      level,
      message,
      data
    });

    // Keep only recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
  }

  /**
   * Log message
   */
  log(level, message, data = {}) {
    if (!this.isLevelEnabled(level)) return;

    const formatted = this.formatMessage(level, message, data);

    switch (level) {
      case LogLevel.DEBUG:
        console.debug(formatted);
        break;
      case LogLevel.INFO:
        console.info(formatted);
        break;
      case LogLevel.WARN:
        console.warn(formatted);
        break;
      case LogLevel.ERROR:
        console.error(formatted);
        break;
    }

    this.storeLog(level, message, data);
  }

  /**
   * Debug
   */
  debug(message, data = {}) {
    this.log(LogLevel.DEBUG, message, data);
  }

  /**
   * Info
   */
  info(message, data = {}) {
    this.log(LogLevel.INFO, message, data);
  }

  /**
   * Warn
   */
  warn(message, data = {}) {
    this.log(LogLevel.WARN, message, data);
  }

  /**
   * Error
   */
  error(message, data = {}) {
    this.log(LogLevel.ERROR, message, data);
  }

  /**
   * Get logs
   */
  getLogs() {
    return [...this.logs];
  }

  /**
   * Clear logs
   */
  clearLogs() {
    this.logs = [];
  }

  /**
   * Export logs
   */
  exportLogs() {
    return JSON.stringify(this.logs, null, 2);
  }

  /**
   * Set level
   */
  setLevel(level) {
    this.level = level;
  }
}

// Create global logger instance
const appLogger = new Logger({
  name: 'TradingTerminal',
  level: LogLevel.INFO,
  enabled: true,
  storage: true,
  maxLogs: 100
});

export { Logger, LogLevel, appLogger };

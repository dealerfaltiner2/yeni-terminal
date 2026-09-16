/**
 * Logger Service
 * Centralized logging with levels (DEBUG, INFO, WARN, ERROR)
 * Supports both console and remote logging
 */

const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

class Logger {
  constructor(name, level = LogLevel.INFO) {
    this.name = name;
    this.level = level;
    this.logs = [];
    this.maxLogs = 1000;
  }

  /**
   * Format log message with timestamp and context
   */
  format(level, message, data) {
    const timestamp = new Date().toISOString();
    const levelName = Object.keys(LogLevel).find(key => LogLevel[key] === level);
    const prefix = `[${timestamp}] [${levelName}] [${this.name}]`;

    return {
      timestamp,
      level: levelName,
      context: this.name,
      message,
      data,
      formatted: `${prefix} ${message}${data ? ' ' + JSON.stringify(data) : ''}`
    };
  }

  /**
   * Store log in memory
   */
  store(log) {
    this.logs.push(log);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
  }

  /**
   * Output log to console
   */
  output(log) {
    if (log.level === 'ERROR') {
      console.error(log.formatted, log.data || '');
    } else if (log.level === 'WARN') {
      console.warn(log.formatted, log.data || '');
    } else if (log.level === 'DEBUG') {
      console.debug(log.formatted, log.data || '');
    } else {
      console.log(log.formatted, log.data || '');
    }
  }

  /**
   * Log with level check
   */
  log(level, message, data) {
    if (level < this.level) {
      return;
    }

    const log = this.format(level, message, data);
    this.store(log);
    this.output(log);

    return log;
  }

  debug(message, data) {
    return this.log(LogLevel.DEBUG, message, data);
  }

  info(message, data) {
    return this.log(LogLevel.INFO, message, data);
  }

  warn(message, data) {
    return this.log(LogLevel.WARN, message, data);
  }

  error(message, data) {
    return this.log(LogLevel.ERROR, message, data);
  }

  /**
   * Get all stored logs
   */
  getLogs() {
    return [...this.logs];
  }

  /**
   * Clear stored logs
   */
  clearLogs() {
    this.logs = [];
  }

  /**
   * Set log level
   */
  setLevel(level) {
    this.level = level;
  }

  /**
   * Export logs as JSON
   */
  exportLogs() {
    return JSON.stringify(this.logs, null, 2);
  }
}

// Export singleton instances
const appLogger = new Logger('BIST-APP', LogLevel.INFO);
const apiLogger = new Logger('API', LogLevel.INFO);
const serviceLogger = new Logger('SERVICE', LogLevel.INFO);

export { Logger, LogLevel, appLogger, apiLogger, serviceLogger };

/**
 * Logger Utility
 * Centralized logging for the application
 */

const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  SILENT: 4
};

class Logger {
  constructor(name, level = LogLevel.INFO) {
    this.name = name;
    this.level = level;
    this.logs = [];
    this.maxLogs = 1000;
  }

  /**
   * Get log level name
   */
  getLevelName(level) {
    const names = {
      [LogLevel.DEBUG]: 'DEBUG',
      [LogLevel.INFO]: 'INFO',
      [LogLevel.WARN]: 'WARN',
      [LogLevel.ERROR]: 'ERROR'
    };
    return names[level] || 'UNKNOWN';
  }

  /**
   * Get color for log level
   */
  getColor(level) {
    const colors = {
      [LogLevel.DEBUG]: '#6b7280',
      [LogLevel.INFO]: '#3b82f6',
      [LogLevel.WARN]: '#f59e0b',
      [LogLevel.ERROR]: '#ef4444'
    };
    return colors[level] || '#000000';
  }

  /**
   * Format log message
   */
  formatMessage(level, message, data) {
    const timestamp = new Date().toISOString();
    const levelName = this.getLevelName(level);
    const dataStr = data ? ` | ${JSON.stringify(data)}` : '';
    return `[${timestamp}] [${this.name}] ${levelName}: ${message}${dataStr}`;
  }

  /**
   * Log message
   */
  log(level, message, data = null) {
    if (level < this.level) {
      return;
    }

    const formatted = this.formatMessage(level, message, data);
    const color = this.getColor(level);

    // Console output
    const style = `color: ${color}; font-weight: bold;`;
    console.log(`%c${formatted}`, style);

    // Store log
    this.logs.push({
      timestamp: new Date(),
      level,
      message,
      data,
      formatted
    });

    // Trim logs if too many
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Send to server (optional)
    this.sendToServer(level, message, data);
  }

  /**
   * Debug log
   */
  debug(message, data = null) {
    this.log(LogLevel.DEBUG, message, data);
  }

  /**
   * Info log
   */
  info(message, data = null) {
    this.log(LogLevel.INFO, message, data);
  }

  /**
   * Warn log
   */
  warn(message, data = null) {
    this.log(LogLevel.WARN, message, data);
  }

  /**
   * Error log
   */
  error(message, data = null) {
    this.log(LogLevel.ERROR, message, data);
  }

  /**
   * Get all logs
   */
  getLogs(level = null) {
    if (level === null) {
      return this.logs;
    }
    return this.logs.filter(log => log.level === level);
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
    const csv = this.logs
      .map(log => `"${log.timestamp.toISOString()}","${this.getLevelName(log.level)}","${log.message}","${JSON.stringify(log.data)}"`)
      .join('\n');

    const headers = 'Timestamp,Level,Message,Data\n';
    return headers + csv;
  }

  /**
   * Send logs to server (optional)
   */
  async sendToServer(level, message, data) {
    // Override in subclass or configure via options
    // Example: POST to /api/logs with { level, message, data }
  }

  /**
   * Set log level
   */
  setLevel(level) {
    this.level = level;
  }
}

// Application logger instances
const appLogger = new Logger('APP', LogLevel.DEBUG);
const serviceLogger = new Logger('SERVICE', LogLevel.DEBUG);
const apiLogger = new Logger('API', LogLevel.DEBUG);

export { Logger, LogLevel, appLogger, serviceLogger, apiLogger };

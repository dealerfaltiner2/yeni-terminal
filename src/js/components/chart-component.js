/**
 * Chart Component
 * Interactive financial charts with Chart.js
 */

import { appLogger } from '../utils/logger.js';

class ChartComponent {
  constructor(containerId, options = {}) {
    this.containerId = containerId;
    this.container = document.getElementById(containerId);
    this.chart = null;
    this.options = {
      type: 'line',
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: true,
          position: 'top'
        },
        tooltip: {
          mode: 'index',
          intersect: false
        }
      },
      scales: {
        y: {
          beginAtZero: false,
          grid: {
            color: 'rgba(0,0,0,0.1)'
          }
        },
        x: {
          grid: {
            display: false
          }
        }
      },
      ...options
    };
  }

  /**
   * Initialize chart
   */
  init(data) {
    if (!this.container) {
      appLogger.error('Chart container not found', { containerId: this.containerId });
      return;
    }

    try {
      if (!window.Chart) {
        throw new Error('Chart.js library not loaded');
      }

      const ctx = this.container.getContext('2d');
      this.chart = new window.Chart(ctx, {
        ...this.options,
        data
      });

      appLogger.debug('Chart initialized', { containerId: this.containerId });
    } catch (error) {
      appLogger.error('Failed to initialize chart', { error: error.message });
    }
  }

  /**
   * Update chart data
   */
  updateData(data) {
    if (!this.chart) {
      appLogger.warn('Chart not initialized');
      return;
    }

    this.chart.data = data;
    this.chart.update();
    appLogger.debug('Chart data updated');
  }

  /**
   * Update chart options
   */
  updateOptions(options) {
    if (!this.chart) {
      appLogger.warn('Chart not initialized');
      return;
    }

    Object.assign(this.chart.options, options);
    this.chart.update();
    appLogger.debug('Chart options updated');
  }

  /**
   * Destroy chart
   */
  destroy() {
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
      appLogger.debug('Chart destroyed');
    }
  }

  /**
   * Create candlestick data
   */
  createCandlestickData(candlesticks) {
    const labels = [];
    const opens = [];
    const highs = [];
    const lows = [];
    const closes = [];

    candlesticks.forEach(candle => {
      labels.push(new Date(candle.time).toLocaleDateString());
      opens.push(candle.open);
      highs.push(candle.high);
      lows.push(candle.low);
      closes.push(candle.close);
    });

    return {
      labels,
      datasets: [
        {
          label: 'High',
          data: highs,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          borderWidth: 1,
          tension: 0.4
        },
        {
          label: 'Low',
          data: lows,
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          borderWidth: 1,
          tension: 0.4
        },
        {
          label: 'Close',
          data: closes,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderWidth: 2,
          tension: 0.4
        }
      ]
    };
  }

  /**
   * Create line chart data
   */
  createLineData(label, data, color = '#3b82f6') {
    return {
      labels: data.map((item, index) => index),
      datasets: [
        {
          label,
          data,
          borderColor: color,
          backgroundColor: `${color}20`,
          borderWidth: 2,
          tension: 0.4,
          fill: true
        }
      ]
    };
  }

  /**
   * Create bar chart data
   */
  createBarData(labels, values, color = '#3b82f6') {
    return {
      labels,
      datasets: [
        {
          label: 'Value',
          data: values,
          backgroundColor: color,
          borderColor: color,
          borderWidth: 1
        }
      ]
    };
  }

  /**
   * Set chart type
   */
  setChartType(type) {
    if (this.chart) {
      this.chart.config.type = type;
      this.chart.update();
      appLogger.debug('Chart type changed', { type });
    }
  }

  /**
   * Export as image
   */
  exportAsImage(filename = 'chart.png') {
    if (!this.chart) {
      appLogger.warn('Chart not initialized');
      return;
    }

    try {
      const link = document.createElement('a');
      link.href = this.chart.canvas.toDataURL();
      link.download = filename;
      link.click();
      appLogger.info('Chart exported', { filename });
    } catch (error) {
      appLogger.error('Failed to export chart', { error: error.message });
    }
  }
}

export { ChartComponent };

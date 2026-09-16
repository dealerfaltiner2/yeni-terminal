/**
 * Chart Component
 * TradingView Lightweight Charts wrapper
 */

import { appLogger } from '../utils/logger.js';

class ChartComponent {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      throw new Error(`Container ${containerId} not found`);
    }

    this.options = {
      layout: {
        textColor: '#d1d5db',
        background: { type: 'solid', color: '#1f2937' },
        ...options.layout
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 12,
        ...options.timeScale
      },
      ...options
    };

    this.chart = null;
    this.series = new Map();
    this.markers = [];
  }

  /**
   * Initialize chart
   */
  init() {
    try {
      // Dynamically load TradingView charts library
      if (!window.LightweightCharts) {
        appLogger.warn('TradingView Lightweight Charts not loaded');
        return;
      }

      const { createChart } = window.LightweightCharts;
      this.chart = createChart(this.container, {
        width: this.container.clientWidth,
        height: this.container.clientHeight,
        ...this.options
      });

      // Handle resize
      window.addEventListener('resize', () => this.resize());

      appLogger.info('Chart initialized', { container: this.container.id });
    } catch (error) {
      appLogger.error('Failed to initialize chart', { error: error.message });
    }
  }

  /**
   * Add candlestick series
   */
  addCandlestickSeries(data, options = {}) {
    if (!this.chart) {
      appLogger.warn('Chart not initialized');
      return null;
    }

    try {
      const series = this.chart.addCandlestickSeries({
        upColor: '#10b981',
        downColor: '#ef4444',
        borderUpColor: '#10b981',
        borderDownColor: '#ef4444',
        wickUpColor: '#10b981',
        wickDownColor: '#ef4444',
        ...options
      });

      series.setData(data);
      this.series.set('candlestick', series);

      appLogger.debug('Candlestick series added', { dataPoints: data.length });
      return series;
    } catch (error) {
      appLogger.error('Failed to add candlestick series', { error: error.message });
      return null;
    }
  }

  /**
   * Add line series
   */
  addLineSeries(data, options = {}) {
    if (!this.chart) {
      return null;
    }

    try {
      const series = this.chart.addLineSeries({
        color: '#3b82f6',
        lineWidth: 2,
        ...options
      });

      series.setData(data);
      this.series.set('line', series);

      return series;
    } catch (error) {
      appLogger.error('Failed to add line series', { error: error.message });
      return null;
    }
  }

  /**
   * Add area series
   */
  addAreaSeries(data, options = {}) {
    if (!this.chart) {
      return null;
    }

    try {
      const series = this.chart.addAreaSeries({
        lineColor: '#8b5cf6',
        topColor: 'rgba(139, 92, 246, 0.2)',
        bottomColor: 'rgba(139, 92, 246, 0)',
        lineWidth: 2,
        ...options
      });

      series.setData(data);
      this.series.set('area', series);

      return series;
    } catch (error) {
      appLogger.error('Failed to add area series', { error: error.message });
      return null;
    }
  }

  /**
   * Add marker
   */
  addMarker(time, position, options = {}) {
    try {
      const marker = {
        time,
        position,
        color: '#f59e0b',
        shape: 'circle',
        text: '',
        ...options
      };

      const series = this.series.get('candlestick') || this.series.get('line');
      if (series) {
        series.setMarkers([...this.markers, marker]);
        this.markers.push(marker);
      }
    } catch (error) {
      appLogger.error('Failed to add marker', { error: error.message });
    }
  }

  /**
   * Fit content
   */
  fitContent() {
    if (this.chart) {
      this.chart.timeScale().fitContent();
    }
  }

  /**
   * Resize chart
   */
  resize() {
    if (this.chart && this.container) {
      this.chart.applyOptions({
        width: this.container.clientWidth,
        height: this.container.clientHeight
      });
    }
  }

  /**
   * Clear all series
   */
  clear() {
    if (this.chart) {
      this.series.forEach((series) => {
        this.chart.removeSeries(series);
      });
      this.series.clear();
      this.markers = [];
    }
  }

  /**
   * Destroy chart
   */
  destroy() {
    if (this.chart) {
      this.chart.remove();
      this.chart = null;
      this.series.clear();
      appLogger.info('Chart destroyed');
    }
  }

  /**
   * Get chart instance
   */
  getChart() {
    return this.chart;
  }
}

export { ChartComponent };

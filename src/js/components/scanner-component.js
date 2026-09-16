/**
 * Scanner Component
 * Real-time market scanner UI
 */

import { appLogger } from '../utils/logger.js';
import { TableComponent } from './table-component.js';
import { dataService } from '../services/data-service.js';

class ScannerComponent {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      throw new Error(`Container ${containerId} not found`);
    }

    this.options = {
      autoRefresh: options.autoRefresh !== false,
      refreshInterval: options.refreshInterval || 30000,
      scanType: options.scanType || 'turkey', // turkey, crypto, global
      ...options
    };

    this.table = null;
    this.data = [];
    this.refreshTimer = null;
    this.isLoading = false;
  }

  /**
   * Initialize scanner
   */
  async init() {
    try {
      this.createUI();
      await this.loadData();

      if (this.options.autoRefresh) {
        this.startAutoRefresh();
      }

      appLogger.info('Scanner initialized', { type: this.options.scanType });
    } catch (error) {
      appLogger.error('Failed to initialize scanner', { error: error.message });
      this.showError('Scanner başlatma hatası');
    }
  }

  /**
   * Create scanner UI
   */
  createUI() {
    this.container.innerHTML = '';

    // Header
    const header = document.createElement('div');
    header.className = 'scanner-header';

    const title = document.createElement('h3');
    title.textContent = this.getScannerTitle();
    header.appendChild(title);

    const controls = document.createElement('div');
    controls.className = 'scanner-controls';

    const refreshBtn = document.createElement('button');
    refreshBtn.textContent = '🔄 Yenile';
    refreshBtn.className = 'btn btn-primary';
    refreshBtn.addEventListener('click', () => this.loadData());
    controls.appendChild(refreshBtn);

    const exportBtn = document.createElement('button');
    exportBtn.textContent = '📥 İndir';
    exportBtn.className = 'btn btn-secondary';
    exportBtn.addEventListener('click', () => this.exportData());
    controls.appendChild(exportBtn);

    header.appendChild(controls);
    this.container.appendChild(header);

    // Loading indicator
    this.loadingDiv = document.createElement('div');
    this.loadingDiv.className = 'loading';
    this.loadingDiv.textContent = 'Yükleniyor...';
    this.loadingDiv.style.display = 'none';
    this.container.appendChild(this.loadingDiv);

    // Error message
    this.errorDiv = document.createElement('div');
    this.errorDiv.className = 'alert alert-error';
    this.errorDiv.style.display = 'none';
    this.container.appendChild(this.errorDiv);

    // Table container
    const tableContainer = document.createElement('div');
    tableContainer.id = 'scanner-table';
    this.container.appendChild(tableContainer);

    // Initialize table
    this.table = new TableComponent('scanner-table', {
      paginate: true,
      pageSize: 50,
      sortable: true
    });

    // Set columns based on scanner type
    this.table.setColumns(this.getColumns());
  }

  /**
   * Get scanner title
   */
  getScannerTitle() {
    const titles = {
      turkey: '🇹🇷 Türkiye Hisse Senetleri',
      crypto: '₿ Kripto Para',
      global: '🌍 Global Göstergeler'
    };
    return titles[this.options.scanType] || 'Scanner';
  }

  /**
   * Get table columns
   */
  getColumns() {
    const baseColumns = [
      { key: 'name', label: 'Sembol', sortable: true, className: 'font-bold' },
      { key: 'close', label: 'Fiyat', sortable: true, className: 'text-right' },
      {
        key: 'change',
        label: 'Değişim %',
        sortable: true,
        className: 'text-right',
        format: (value) => {
          const color = value >= 0 ? 'text-green-500' : 'text-red-500';
          return `<span class="${color}">${value.toFixed(2)}%</span>`;
        }
      }
    ];

    if (this.options.scanType === 'turkey') {
      return [
        ...baseColumns,
        { key: 'volume', label: 'Hacim', sortable: true, className: 'text-right' },
        { key: 'marketCap', label: 'Piyasa Değeri', sortable: true, className: 'text-right' },
        {
          key: 'pe',
          label: 'F/K',
          sortable: true,
          className: 'text-right',
          format: (value) => value ? value.toFixed(2) : '-'
        }
      ];
    } else if (this.options.scanType === 'crypto') {
      return [
        ...baseColumns,
        { key: 'volume24h', label: '24h Hacim', sortable: true, className: 'text-right' },
        { key: 'high24h', label: '24h Yüksek', sortable: true, className: 'text-right' },
        { key: 'low24h', label: '24h Düşük', sortable: true, className: 'text-right' }
      ];
    }

    return baseColumns;
  }

  /**
   * Load data
   */
  async loadData() {
    if (this.isLoading) return;

    try {
      this.isLoading = true;
      this.showLoading(true);
      this.hideError();

      if (this.options.scanType === 'turkey') {
        this.data = await dataService.fetchTurkeyStocks();
      } else if (this.options.scanType === 'crypto') {
        this.data = await dataService.fetchCryptos();
      } else if (this.options.scanType === 'global') {
        this.data = await dataService.fetchGlobalSymbols();
      }

      this.table.setData(this.data);
      appLogger.info('Scanner data loaded', { type: this.options.scanType, count: this.data.length });
    } catch (error) {
      appLogger.error('Failed to load scanner data', { error: error.message });
      this.showError(`Veri yükleme hatası: ${error.message}`);
    } finally {
      this.isLoading = false;
      this.showLoading(false);
    }
  }

  /**
   * Start auto refresh
   */
  startAutoRefresh() {
    this.refreshTimer = setInterval(() => this.loadData(), this.options.refreshInterval);
    appLogger.info('Auto refresh started', { interval: this.options.refreshInterval });
  }

  /**
   * Stop auto refresh
   */
  stopAutoRefresh() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
      appLogger.info('Auto refresh stopped');
    }
  }

  /**
   * Export data
   */
  exportData() {
    if (this.table) {
      const filename = `scanner_${this.options.scanType}_${new Date().toISOString().split('T')[0]}.csv`;
      this.table.exportCSV(filename);
    }
  }

  /**
   * Show loading indicator
   */
  showLoading(show = true) {
    if (this.loadingDiv) {
      this.loadingDiv.style.display = show ? 'block' : 'none';
    }
  }

  /**
   * Show error message
   */
  showError(message) {
    if (this.errorDiv) {
      this.errorDiv.textContent = message;
      this.errorDiv.style.display = 'block';
    }
  }

  /**
   * Hide error message
   */
  hideError() {
    if (this.errorDiv) {
      this.errorDiv.style.display = 'none';
    }
  }

  /**
   * Destroy scanner
   */
  destroy() {
    this.stopAutoRefresh();
    if (this.table) {
      this.table.clear();
    }
    this.container.innerHTML = '';
    appLogger.info('Scanner destroyed');
  }
}

export { ScannerComponent };

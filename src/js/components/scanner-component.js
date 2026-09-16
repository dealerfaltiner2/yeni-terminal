/**
 * Scanner Component
 * TradingView scanner UI wrapper
 */

import { TradingViewAPI } from '../api/tradingview.js';
import { TableComponent } from './table-component.js';
import { appLogger } from '../utils/logger.js';

const DEFAULT_ERROR_MESSAGE = 'Tarama verisi şu anda yüklenemiyor';
const numberFormatter = new Intl.NumberFormat('tr-TR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

const wholeNumberFormatter = new Intl.NumberFormat('tr-TR', {
  maximumFractionDigits: 0
});
const decimalFormatters = new Map();

function getNumberFormatter(digits) {
  if (!decimalFormatters.has(digits)) {
    decimalFormatters.set(
      digits,
      new Intl.NumberFormat('tr-TR', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits
      })
    );
  }

  return decimalFormatters.get(digits);
}

class ScannerComponent {
  constructor(options = {}) {
    this.api = options.api || new TradingViewAPI();
    this.table =
      options.table ||
      new TableComponent(options.tableContainerId, [], {
        defaultSortKey: 'marketCap',
        defaultSortDirection: 'desc',
        onRowClick: options.onRowClick
      });

    this.tableContainerId = options.tableContainerId;
    this.sectorSelect = document.getElementById(options.sectorSelectId);
    this.searchInput = document.getElementById(options.searchInputId);
    this.minVolumeSelect = document.getElementById(options.minVolumeSelectId);
    this.countElement = document.getElementById(options.countElementId);
    this.limit = options.limit ?? 250;
    this.stocks = [];
    this.filteredStocks = [];

    this.handleFilterChange = this.handleFilterChange.bind(this);
    this.columns = options.columns || this.getDefaultColumns();
  }

  getDefaultColumns() {
    return [
      { key: 'ticker', label: 'Sembol' },
      { key: 'name', label: 'Ad' },
      {
        key: 'close',
        label: 'Son',
        render: (value) => this.formatNumber(value)
      },
      {
        key: 'change',
        label: '%',
        className: (value) => this.getTrendClass(value),
        render: (value) => this.formatPercent(value)
      },
      {
        key: 'turnover',
        label: 'Hacim ₺',
        render: (value) => this.formatWholeNumber(value)
      },
      {
        key: 'relativeVolume',
        label: 'RVOL',
        render: (value) => this.formatNumber(value, 1)
      },
      { key: 'sector', label: 'Sektör' }
    ];
  }

  init() {
    this.table.setColumns(this.columns);
    this.bindFilters();
    appLogger.info('Scanner component initialized', {
      container: this.tableContainerId
    });
  }

  bindFilters() {
    [this.sectorSelect, this.searchInput, this.minVolumeSelect]
      .filter(Boolean)
      .forEach((element) => {
        element.addEventListener('input', this.handleFilterChange);
        element.addEventListener('change', this.handleFilterChange);
      });
  }

  async loadStocks(options = {}) {
    this.table.setLoading(true);

    try {
      const result = await this.api.scanTurkeyStocks({
        limit: options.limit ?? this.limit
      });
      const stocks = Array.isArray(result) ? result : [];

      this.stocks = stocks.map((stock) => this.normalizeStock(stock));
      this.updateSectorOptions();
      this.applyFilters();

      appLogger.info('Scanner stocks loaded', { count: this.stocks.length });
      return this.filteredStocks;
    } catch (error) {
      this.table.setLoading(false);
      this.table.renderState(DEFAULT_ERROR_MESSAGE);
      appLogger.error('Failed to load scanner stocks', { error: error.message });
      throw error;
    }
  }

  normalizeStock(stock) {
    const close = Number(stock.close) || 0;
    const volume = Number(stock.volume) || 0;

    return {
      ...stock,
      turnover: close * volume,
      relativeVolume: stock.relativeVolume ?? stock.relative_volume_10d_calc ?? null
    };
  }

  updateSectorOptions() {
    if (!this.sectorSelect) {
      return;
    }

    const currentValue = this.sectorSelect.value;
    const sectors = [...new Set(this.stocks.map((stock) => stock.sector).filter(Boolean))].sort(
      (a, b) => a.localeCompare(b, 'tr', { sensitivity: 'base' })
    );

    this.sectorSelect.innerHTML = '';

    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Tüm sektörler';
    this.sectorSelect.appendChild(defaultOption);

    sectors.forEach((sector) => {
      const option = document.createElement('option');
      option.value = sector;
      option.textContent = sector;
      option.selected = sector === currentValue;
      this.sectorSelect.appendChild(option);
    });
  }

  handleFilterChange() {
    this.applyFilters();
  }

  applyFilters() {
    const sector = this.sectorSelect?.value || '';
    const query = (this.searchInput?.value || '').trim().toLocaleLowerCase('tr-TR');
    const minVolume = Number(this.minVolumeSelect?.value || 0);

    this.filteredStocks = this.stocks.filter((stock) => {
      const matchesSector = !sector || stock.sector === sector;
      const haystack = [stock.ticker, stock.name, stock.description, stock.sector]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('tr-TR');
      const matchesQuery = !query || haystack.includes(query);
      const matchesVolume = !minVolume || (Number(stock.turnover) || 0) >= minVolume;

      return matchesSector && matchesQuery && matchesVolume;
    });

    this.table.setLoading(false);
    this.table.setData(this.filteredStocks);
    this.updateCount();
    return this.filteredStocks;
  }

  updateCount() {
    if (this.countElement) {
      this.countElement.textContent = `${this.filteredStocks.length} kayıt`;
    }
  }

  formatNumber(value, digits = 2) {
    if (value == null || Number.isNaN(Number(value))) {
      return '-';
    }

    return getNumberFormatter(digits).format(Number(value));
  }

  formatWholeNumber(value) {
    if (value == null || Number.isNaN(Number(value))) {
      return '-';
    }

    return wholeNumberFormatter.format(Number(value));
  }

  formatPercent(value) {
    if (value == null || Number.isNaN(Number(value))) {
      return '-';
    }

    const numericValue = Number(value);
    return `${numericValue >= 0 ? '+' : ''}${numberFormatter.format(numericValue)}%`;
  }

  getTrendClass(value) {
    if (Number(value) > 0) {
      return 'up';
    }
    if (Number(value) < 0) {
      return 'dn';
    }
    return '';
  }

  destroy() {
    [this.sectorSelect, this.searchInput, this.minVolumeSelect]
      .filter(Boolean)
      .forEach((element) => {
        element.removeEventListener('input', this.handleFilterChange);
        element.removeEventListener('change', this.handleFilterChange);
      });

    this.table.destroy();
    appLogger.info('Scanner component destroyed', {
      container: this.tableContainerId
    });
  }
}

export { ScannerComponent };

/**
 * Search Component
 * Symbol search functionality
 */

import { dataService } from '../services/data-service.js';
import { appLogger } from '../utils/logger.js';

class SearchComponent {
  constructor(containerId, options = {}) {
    this.containerId = containerId;
    this.container = document.getElementById(containerId);
    this.options = {
      placeholder: 'Search symbols...',
      minChars: 2,
      maxResults: 10,
      debounceMs: 300,
      ...options
    };
    this.searchInput = null;
    this.resultsContainer = null;
    this.debounceTimer = null;
    this.listeners = [];
    this.init();
  }

  /**
   * Initialize component
   */
  init() {
    if (!this.container) {
      appLogger.error('Search container not found', { containerId: this.containerId });
      return;
    }

    this.render();
    this.attachEventListeners();
    appLogger.debug('Search component initialized');
  }

  /**
   * Render component
   */
  render() {
    this.container.innerHTML = `
      <div style="position: relative;">
        <input 
          type="text" 
          id="search-input"
          placeholder="${this.options.placeholder}"
          style="
            width: 100%;
            padding: 12px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 14px;
            box-sizing: border-box;
          "
        />
        <div 
          id="search-results"
          style="
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background: white;
            border: 1px solid #ddd;
            border-top: none;
            border-radius: 0 0 4px 4px;
            max-height: 400px;
            overflow-y: auto;
            display: none;
            z-index: 100;
          "
        ></div>
      </div>
    `;

    this.searchInput = this.container.querySelector('#search-input');
    this.resultsContainer = this.container.querySelector('#search-results');
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    this.searchInput.addEventListener('input', (e) => {
      this.onInput(e.target.value);
    });

    this.searchInput.addEventListener('focus', () => {
      if (this.resultsContainer.children.length > 0) {
        this.resultsContainer.style.display = 'block';
      }
    });

    document.addEventListener('click', (e) => {
      if (!this.container.contains(e.target)) {
        this.resultsContainer.style.display = 'none';
      }
    });
  }

  /**
   * Handle input
   */
  onInput(value) {
    clearTimeout(this.debounceTimer);

    if (value.length < this.options.minChars) {
      this.resultsContainer.innerHTML = '';
      this.resultsContainer.style.display = 'none';
      return;
    }

    this.debounceTimer = setTimeout(() => {
      this.search(value);
    }, this.options.debounceMs);
  }

  /**
   * Search
   */
  async search(query) {
    try {
      appLogger.debug('Searching for', { query });
      const results = await dataService.searchSymbols(query);
      this.displayResults(results.slice(0, this.options.maxResults));
    } catch (error) {
      appLogger.error('Search failed', { error: error.message });
      this.resultsContainer.innerHTML = `
        <div style="padding: 12px; color: #ef4444;">
          Error searching symbols
        </div>
      `;
    }
  }

  /**
   * Display results
   */
  displayResults(results) {
    if (results.length === 0) {
      this.resultsContainer.innerHTML = `
        <div style="padding: 12px; color: #999;">
          No results found
        </div>
      `;
      this.resultsContainer.style.display = 'block';
      return;
    }

    this.resultsContainer.innerHTML = results
      .map(result => `
        <div 
          class="search-result"
          data-symbol="${result.symbol}"
          style="
            padding: 12px;
            border-bottom: 1px solid #eee;
            cursor: pointer;
            transition: background 0.2s;
          "
        >
          <div style="font-weight: bold; color: #333;">${result.symbol}</div>
          <div style="font-size: 12px; color: #999;">${result.name || result.symbol}</div>
        </div>
      `)
      .join('');

    this.resultsContainer.style.display = 'block';

    // Attach click handlers
    this.resultsContainer.querySelectorAll('.search-result').forEach(el => {
      el.addEventListener('click', () => {
        const symbol = el.getAttribute('data-symbol');
        this.selectResult(symbol);
      });
    });
  }

  /**
   * Select result
   */
  selectResult(symbol) {
    this.searchInput.value = symbol;
    this.resultsContainer.style.display = 'none';
    this.notifyListeners(symbol);
    appLogger.debug('Symbol selected', { symbol });
  }

  /**
   * Add listener
   */
  addListener(listener) {
    this.listeners.push(listener);
  }

  /**
   * Notify listeners
   */
  notifyListeners(symbol) {
    this.listeners.forEach(listener => {
      try {
        listener(symbol);
      } catch (error) {
        appLogger.error('Error in search listener', { error: error.message });
      }
    });
  }

  /**
   * Get value
   */
  getValue() {
    return this.searchInput.value;
  }

  /**
   * Set value
   */
  setValue(value) {
    this.searchInput.value = value;
  }

  /**
   * Clear
   */
  clear() {
    this.searchInput.value = '';
    this.resultsContainer.innerHTML = '';
    this.resultsContainer.style.display = 'none';
  }
}

export { SearchComponent };

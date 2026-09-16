/**
 * Table Component
 * Reusable sortable data table
 */

import { appLogger } from '../utils/logger.js';

class TableComponent {
  constructor(containerId, columns = [], options = {}) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      throw new Error(`Container ${containerId} not found`);
    }

    this.columns = columns;
    this.options = {
      className: 'table-component',
      emptyMessage: 'Veri bulunamadı',
      loadingMessage: 'Yükleniyor...',
      sortable: true,
      onRowClick: null,
      ...options
    };

    this.data = [];
    this.loading = false;
    this.sortState = {
      key: options.defaultSortKey || null,
      direction: options.defaultSortDirection || 'asc'
    };
  }

  setColumns(columns = []) {
    this.columns = columns;
    this.render();
  }

  setData(data = []) {
    this.data = Array.isArray(data) ? [...data] : [];
    this.render();
  }

  setLoading(isLoading) {
    this.loading = Boolean(isLoading);
    this.render();
  }

  sortBy(key) {
    if (!key) {
      return;
    }

    if (this.sortState.key === key) {
      this.sortState.direction = this.sortState.direction === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortState = { key, direction: 'asc' };
    }

    this.render();
  }

  getSortedData() {
    if (!this.sortState.key) {
      return [...this.data];
    }

    const { key, direction } = this.sortState;
    const factor = direction === 'asc' ? 1 : -1;

    return [...this.data].sort((left, right) => {
      const a = left?.[key];
      const b = right?.[key];

      if (a == null && b == null) {
        return 0;
      }
      if (a == null) {
        return 1;
      }
      if (b == null) {
        return -1;
      }

      if (typeof a === 'number' && typeof b === 'number') {
        return (a - b) * factor;
      }

      return String(a).localeCompare(String(b), 'tr', { sensitivity: 'base' }) * factor;
    });
  }

  createCell(column, row) {
    const cell = document.createElement('td');
    const value = row?.[column.key];

    if (column.className) {
      cell.className =
        typeof column.className === 'function' ? column.className(value, row) : column.className;
    }

    if (typeof column.render === 'function') {
      const rendered = column.render(value, row);
      if (rendered instanceof Node) {
        cell.appendChild(rendered);
      } else {
        cell.textContent = rendered ?? '';
      }
    } else {
      cell.textContent = value ?? '';
    }

    return cell;
  }

  renderState(message) {
    this.container.innerHTML = '';
    const state = document.createElement('div');
    state.className = 'note';
    state.textContent = message;
    this.container.appendChild(state);
  }

  render() {
    if (this.loading) {
      this.renderState(this.options.loadingMessage);
      return;
    }

    if (!this.data.length) {
      this.renderState(this.options.emptyMessage);
      return;
    }

    const table = document.createElement('table');
    table.className = this.options.className;

    const headRow = document.createElement('tr');
    this.columns.forEach((column) => {
      const th = document.createElement('th');
      const sortable = this.options.sortable && column.sortable !== false;

      th.textContent = column.label || column.key;
      if (sortable) {
        th.style.cursor = 'pointer';
        th.addEventListener('click', () => this.sortBy(column.key));
      }

      if (this.sortState.key === column.key) {
        th.textContent += this.sortState.direction === 'asc' ? ' ▲' : ' ▼';
      }

      headRow.appendChild(th);
    });

    const thead = document.createElement('thead');
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    this.getSortedData().forEach((row) => {
      const tr = document.createElement('tr');
      tr.className = 'row';

      if (typeof this.options.onRowClick === 'function') {
        tr.style.cursor = 'pointer';
        tr.addEventListener('click', () => this.options.onRowClick(row));
      }

      this.columns.forEach((column) => {
        tr.appendChild(this.createCell(column, row));
      });

      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    this.container.innerHTML = '';
    this.container.appendChild(table);
  }

  clear() {
    this.data = [];
    this.loading = false;
    this.container.innerHTML = '';
  }

  destroy() {
    this.clear();
    appLogger.info('Table component destroyed', { container: this.container.id });
  }
}

export { TableComponent };

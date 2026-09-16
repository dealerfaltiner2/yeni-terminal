/**
 * Table Component
 * Dynamic data table with sorting and filtering
 */

import { appLogger } from '../utils/logger.js';

class TableComponent {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      throw new Error(`Container ${containerId} not found`);
    }

    this.options = {
      paginate: options.paginate !== false,
      pageSize: options.pageSize || 50,
      sortable: options.sortable !== false,
      filterable: options.filterable !== false,
      ...options
    };

    this.data = [];
    this.columns = [];
    this.currentPage = 1;
    this.sortBy = null;
    this.sortOrder = 'asc';
    this.filter = {};
  }

  /**
   * Set table columns
   */
  setColumns(columns) {
    this.columns = columns;
    appLogger.debug('Table columns set', { count: columns.length });
  }

  /**
   * Set table data
   */
  setData(data) {
    this.data = data;
    this.currentPage = 1;
    this.render();
    appLogger.debug('Table data updated', { rows: data.length });
  }

  /**
   * Add row
   */
  addRow(row) {
    this.data.push(row);
    this.render();
  }

  /**
   * Remove row by index
   */
  removeRow(index) {
    this.data.splice(index, 1);
    this.render();
  }

  /**
   * Sort by column
   */
  sort(columnKey) {
    if (this.sortBy === columnKey) {
      this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortBy = columnKey;
      this.sortOrder = 'asc';
    }
    this.currentPage = 1;
    this.render();
  }

  /**
   * Filter data
   */
  filter(filterObj) {
    this.filter = filterObj;
    this.currentPage = 1;
    this.render();
  }

  /**
   * Get filtered and sorted data
   */
  getProcessedData() {
    let data = [...this.data];

    // Apply filters
    Object.entries(this.filter).forEach(([key, value]) => {
      data = data.filter(row => {
        const cellValue = String(row[key]).toLowerCase();
        return cellValue.includes(String(value).toLowerCase());
      });
    });

    // Apply sort
    if (this.sortBy) {
      data.sort((a, b) => {
        const aVal = a[this.sortBy];
        const bVal = b[this.sortBy];

        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return this.sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
        }

        const aStr = String(aVal).toLowerCase();
        const bStr = String(bVal).toLowerCase();
        return this.sortOrder === 'asc'
          ? aStr.localeCompare(bStr)
          : bStr.localeCompare(aStr);
      });
    }

    return data;
  }

  /**
   * Get paginated data
   */
  getPaginatedData() {
    const data = this.getProcessedData();

    if (!this.options.paginate) {
      return data;
    }

    const startIdx = (this.currentPage - 1) * this.options.pageSize;
    const endIdx = startIdx + this.options.pageSize;
    return data.slice(startIdx, endIdx);
  }

  /**
   * Get total pages
   */
  getTotalPages() {
    if (!this.options.paginate) {
      return 1;
    }

    const data = this.getProcessedData();
    return Math.ceil(data.length / this.options.pageSize);
  }

  /**
   * Go to page
   */
  goToPage(page) {
    const maxPage = this.getTotalPages();
    if (page >= 1 && page <= maxPage) {
      this.currentPage = page;
      this.render();
    }
  }

  /**
   * Render table
   */
  render() {
    const table = document.createElement('table');
    table.className = 'table table-striped';

    // Header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');

    this.columns.forEach(col => {
      const th = document.createElement('th');
      th.textContent = col.label || col.key;

      if (this.options.sortable && col.sortable !== false) {
        th.style.cursor = 'pointer';
        th.classList.add('sortable');

        if (this.sortBy === col.key) {
          th.classList.add('sorted', this.sortOrder);
        }

        th.addEventListener('click', () => this.sort(col.key));
      }

      headerRow.appendChild(th);
    });

    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Body
    const tbody = document.createElement('tbody');
    const rows = this.getPaginatedData();

    rows.forEach(row => {
      const tr = document.createElement('tr');

      this.columns.forEach(col => {
        const td = document.createElement('td');
        const value = row[col.key];

        if (col.format) {
          td.innerHTML = col.format(value, row);
        } else {
          td.textContent = value;
        }

        td.className = col.className || '';
        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });

    table.appendChild(tbody);

    // Clear and render
    this.container.innerHTML = '';
    this.container.appendChild(table);

    // Render pagination
    if (this.options.paginate) {
      this.renderPagination();
    }
  }

  /**
   * Render pagination
   */
  renderPagination() {
    const totalPages = this.getTotalPages();
    if (totalPages <= 1) return;

    const pagination = document.createElement('div');
    pagination.className = 'pagination';

    // Previous button
    const prevBtn = document.createElement('button');
    prevBtn.textContent = '← Önceki';
    prevBtn.disabled = this.currentPage === 1;
    prevBtn.addEventListener('click', () => this.goToPage(this.currentPage - 1));
    pagination.appendChild(prevBtn);

    // Page numbers
    const startPage = Math.max(1, this.currentPage - 2);
    const endPage = Math.min(totalPages, this.currentPage + 2);

    for (let i = startPage; i <= endPage; i++) {
      const pageBtn = document.createElement('button');
      pageBtn.textContent = i;
      pageBtn.className = i === this.currentPage ? 'active' : '';
      pageBtn.addEventListener('click', () => this.goToPage(i));
      pagination.appendChild(pageBtn);
    }

    // Next button
    const nextBtn = document.createElement('button');
    nextBtn.textContent = 'Sonraki →';
    nextBtn.disabled = this.currentPage === totalPages;
    nextBtn.addEventListener('click', () => this.goToPage(this.currentPage + 1));
    pagination.appendChild(nextBtn);

    this.container.appendChild(pagination);
  }

  /**
   * Export to CSV
   */
  exportCSV(filename = 'export.csv') {
    const data = this.getProcessedData();
    const csv = this.convertToCSV(data);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();

    appLogger.info('Table exported to CSV', { filename, rows: data.length });
  }

  /**
   * Convert data to CSV
   */
  convertToCSV(data) {
    const headers = this.columns.map(c => c.label || c.key).join(',');
    const rows = data.map(row =>
      this.columns.map(col => {
        const value = row[col.key];
        return typeof value === 'string' ? `"${value}"` : value;
      }).join(',')
    );
    return [headers, ...rows].join('\n');
  }

  /**
   * Clear table
   */
  clear() {
    this.data = [];
    this.container.innerHTML = '';
  }
}

export { TableComponent };

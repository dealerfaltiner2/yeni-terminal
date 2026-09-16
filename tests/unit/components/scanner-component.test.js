/** @jest-environment jsdom */

import { jest } from '@jest/globals';

jest.unstable_mockModule('../../../src/js/api/tradingview.js', () => ({
  TradingViewAPI: class {
    async scanTurkeyStocks() {
      return [
        {
          ticker: 'THYAO',
          name: 'Türk Hava Yolları',
          description: 'Ulaştırma',
          close: 320,
          change: 1.25,
          volume: 1000000,
          sector: 'Ulaştırma',
          relativeVolume: 1.8,
          marketCap: 400000000000
        },
        {
          ticker: 'GARAN',
          name: 'Garanti',
          description: 'Banka',
          close: 140,
          change: -0.5,
          volume: 10000,
          sector: 'Bankacılık',
          relativeVolume: 0.9,
          marketCap: 600000000000
        }
      ];
    }
  }
}));

const { ScannerComponent } = await import('../../../src/js/components/scanner-component.js');

describe('ScannerComponent', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <select id="sector"></select>
      <input id="query" />
      <select id="min-volume">
        <option value="0">All</option>
        <option value="100000000">100M</option>
      </select>
      <span id="count"></span>
      <div id="scanner-table"></div>
    `;
  });

  test('loads stocks and renders filtered results', async () => {
    const scanner = new ScannerComponent({
      tableContainerId: 'scanner-table',
      sectorSelectId: 'sector',
      searchInputId: 'query',
      minVolumeSelectId: 'min-volume',
      countElementId: 'count'
    });

    scanner.init();
    await scanner.loadStocks();

    expect(document.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(document.getElementById('count').textContent).toBe('2 kayıt');
  });

  test('filters results by query and minimum volume', async () => {
    const scanner = new ScannerComponent({
      tableContainerId: 'scanner-table',
      sectorSelectId: 'sector',
      searchInputId: 'query',
      minVolumeSelectId: 'min-volume',
      countElementId: 'count'
    });

    scanner.init();
    await scanner.loadStocks();

    document.getElementById('query').value = 'thy';
    document.getElementById('min-volume').value = '100000000';
    document.getElementById('min-volume').dispatchEvent(new Event('change'));

    expect(document.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(document.querySelector('tbody tr td').textContent).toBe('THYAO');
  });
});

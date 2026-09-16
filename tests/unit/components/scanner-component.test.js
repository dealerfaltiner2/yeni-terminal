/** @jest-environment jsdom */

import { jest } from '@jest/globals';

jest.unstable_mockModule('../../../src/js/api/tradingview.js', () => ({
  TradingViewAPI: class {
    async scanTurkeyStocks(options = {}) {
      expect(options).toEqual({ limit: 250 });
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
    document.getElementById('query').dispatchEvent(new Event('input'));
    document.getElementById('min-volume').value = '100000000';
    document.getElementById('min-volume').dispatchEvent(new Event('change'));

    expect(document.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(document.querySelector('tbody tr td').textContent).toBe('THYAO');
  });

  test('renders error state and rethrows load failures', async () => {
    const scanner = new ScannerComponent({
      api: {
        scanTurkeyStocks: jest.fn().mockRejectedValue(new Error('Tarama başarısız'))
      },
      tableContainerId: 'scanner-table',
      sectorSelectId: 'sector',
      searchInputId: 'query',
      minVolumeSelectId: 'min-volume',
      countElementId: 'count'
    });

    scanner.init();
    scanner.filteredStocks = [{ ticker: 'OLD' }];
    document.getElementById('count').textContent = '1 kayıt';

    await expect(scanner.loadStocks()).rejects.toThrow('Tarama başarısız');
    expect(document.getElementById('scanner-table').textContent).toContain(
      'Tarama verisi şu anda yüklenemiyor'
    );
    expect(document.getElementById('count').textContent).toBe('0 kayıt');
  });

  test('normalizes raw API fields before filtering', async () => {
    const scanner = new ScannerComponent({
      api: {
        scanTurkeyStocks: jest.fn().mockResolvedValue([
          {
            ticker: 'KCHOL',
            name: 'Koç Holding',
            close: 200,
            change: 0.75,
            volume: 1000000,
            sector: 'Holding',
            relative_volume_10d_calc: 2.4
          }
        ])
      },
      tableContainerId: 'scanner-table',
      sectorSelectId: 'sector',
      searchInputId: 'query',
      minVolumeSelectId: 'min-volume',
      countElementId: 'count'
    });

    scanner.init();
    await scanner.loadStocks();

    expect(scanner.filteredStocks[0].turnover).toBe(200000000);
    expect(scanner.filteredStocks[0].relativeVolume).toBe(2.4);

    document.getElementById('min-volume').value = '100000000';
    document.getElementById('min-volume').dispatchEvent(new Event('change'));

    expect(document.querySelectorAll('tbody tr')).toHaveLength(1);
  });

  test('preserves existing relative volume values', async () => {
    const scanner = new ScannerComponent({
      api: {
        scanTurkeyStocks: jest.fn().mockResolvedValue([
          {
            ticker: 'SISE',
            name: 'Şişecam',
            close: 45,
            change: 0.2,
            volume: 500000,
            sector: 'Sanayi',
            relativeVolume: 1.1,
            relative_volume_10d_calc: 2.5
          }
        ])
      },
      tableContainerId: 'scanner-table',
      sectorSelectId: 'sector',
      searchInputId: 'query',
      minVolumeSelectId: 'min-volume',
      countElementId: 'count'
    });

    scanner.init();
    await scanner.loadStocks();

    expect(scanner.filteredStocks[0].relativeVolume).toBe(1.1);
  });
});

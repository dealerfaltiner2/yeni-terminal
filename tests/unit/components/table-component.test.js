/** @jest-environment jsdom */

import { TableComponent } from '../../../src/js/components/table-component.js';

describe('TableComponent', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="table"></div>';
  });

  test('renders rows with provided data', () => {
    const table = new TableComponent('table', [
      { key: 'ticker', label: 'Sembol' },
      { key: 'close', label: 'Son' }
    ]);

    table.setData([
      { ticker: 'THYAO', close: 320.4 },
      { ticker: 'ASELS', close: 120.5 }
    ]);

    expect(document.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(document.querySelector('tbody tr td').textContent).toBe('THYAO');
  });

  test('sorts rows when header is clicked', () => {
    const table = new TableComponent(
      'table',
      [
        { key: 'ticker', label: 'Sembol' },
        { key: 'close', label: 'Son' }
      ],
      { defaultSortKey: 'close' }
    );

    table.setData([
      { ticker: 'THYAO', close: 320.4 },
      { ticker: 'ASELS', close: 120.5 }
    ]);

    document.querySelectorAll('th')[1].click();
    expect(document.querySelector('tbody tr td').textContent).toBe('THYAO');

    document.querySelectorAll('th')[1].click();
    expect(document.querySelector('tbody tr td').textContent).toBe('ASELS');

    document.querySelectorAll('th')[0].click();
    expect(document.querySelector('tbody tr td').textContent).toBe('ASELS');
  });

  test('renders node content from custom renderer', () => {
    const badge = document.createElement('strong');
    badge.textContent = 'Pozitif';

    const table = new TableComponent('table', [
      {
        key: 'signal',
        label: 'Sinyal',
        render: () => badge
      }
    ]);

    table.setData([{ signal: 'AL' }, { signal: 'SAT' }]);

    expect(document.querySelectorAll('tbody strong')).toHaveLength(2);
    expect(
      Array.from(document.querySelectorAll('tbody strong')).every(
        (node) => node.textContent === 'Pozitif'
      )
    ).toBe(true);
  });
});

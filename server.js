import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';

const normalizeBasePath = (value) => {
  if (!value || value === '/') return '/api';
  return value.startsWith('/') ? value.replace(/\/$/, '') || '/api' : `/${value.replace(/\/$/, '')}`;
};

const apiBaseUrl = normalizeBasePath(process.env.API_BASE_URL);
const port = Number(process.env.MOCK_API_PORT || 3001);
const requestOrigin = 'http://127.0.0.1';
const defaultSymbols = ['THYAO', 'ASELS', 'KCHOL', 'GARAN', 'TUPRS', 'EREGL', 'SISE', 'BIMAS'];

const symbolCatalog = {
  THYAO: { symbol: 'THYAO', name: 'Turkish Airlines', sector: 'Transportation' },
  ASELS: { symbol: 'ASELS', name: 'Aselsan', sector: 'Defense' },
  KCHOL: { symbol: 'KCHOL', name: 'Koc Holding', sector: 'Holding' },
  GARAN: { symbol: 'GARAN', name: 'Garanti BBVA', sector: 'Banking' },
  TUPRS: { symbol: 'TUPRS', name: 'Tupras', sector: 'Energy' },
  EREGL: { symbol: 'EREGL', name: 'Eregli Demir Celik', sector: 'Materials' },
  SISE: { symbol: 'SISE', name: 'Sisecam', sector: 'Materials' },
  BIMAS: { symbol: 'BIMAS', name: 'BIM', sector: 'Retail' },
  AKBNK: { symbol: 'AKBNK', name: 'Akbank', sector: 'Banking' },
  SAHOL: { symbol: 'SAHOL', name: 'Sabanci Holding', sector: 'Holding' }
};

const json = (res, statusCode, payload) => {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(payload));
};

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });

const symbolSeed = (symbol) =>
  [...symbol.toUpperCase()].reduce((total, char, index) => total + char.charCodeAt(0) * (index + 1), 0);

const buildQuote = (symbol) => {
  const key = symbol.toUpperCase();
  const meta = symbolCatalog[key] || { symbol: key, name: key, sector: 'Unknown' };
  const seed = symbolSeed(key);
  const price = Number((seed % 250 + 25 + ((seed % 17) / 10)).toFixed(2));
  const changePercent = Number((((seed % 21) - 10) / 3).toFixed(2));
  const changeAmount = Number((price * changePercent / 100).toFixed(2));

  return {
    ...meta,
    price,
    changePercent,
    change: changeAmount,
    high: Number((price * 1.03).toFixed(2)),
    low: Number((price * 0.97).toFixed(2)),
    open: Number((price - changeAmount).toFixed(2)),
    volume: 1000000 + seed * 25,
    updatedAt: new Date().toISOString()
  };
};

const buildChart = (symbol, timeframe = '1d') => {
  const base = buildQuote(symbol).price;
  const points = Array.from({ length: 30 }, (_, index) => {
    const wave = Math.sin((index + symbol.length) / 3) * 3;
    return Number((base + wave + index * 0.25).toFixed(2));
  });

  return {
    symbol: symbol.toUpperCase(),
    timeframe,
    prices: points,
    labels: points.map((_, index) => `P${index + 1}`)
  };
};

const buildNews = (symbol) => {
  const target = symbol?.toUpperCase() || 'BIST';
  return [
    {
      id: `${target}-1`,
      symbol: target,
      title: `${target} için sabah piyasa özeti`,
      source: 'Mock News',
      publishedAt: new Date().toISOString()
    },
    {
      id: `${target}-2`,
      symbol: target,
      title: `${target} teknik görünüm güncellemesi`,
      source: 'Mock News',
      publishedAt: new Date(Date.now() - 3600000).toISOString()
    }
  ];
};

const createMockServer = () => {
  const watchlist = new Set(defaultSymbols);
  const orders = [];
  let nextOrderId = 1;

  return createServer(async (req, res) => {
  if (!req.url) {
    json(res, 400, { error: 'Missing request URL' });
    return;
  }

  if (req.method === 'OPTIONS') {
    json(res, 204, {});
    return;
  }

  const url = new URL(req.url, requestOrigin);
  const pathname = url.pathname;

  try {
    if (pathname === `${apiBaseUrl}/health`) {
      json(res, 200, { status: 'ok', apiBaseUrl, port });
      return;
    }

    if (pathname === `${apiBaseUrl}/search`) {
      const query = (url.searchParams.get('q') || '').trim().toUpperCase();
      const results = Object.keys(symbolCatalog)
        .filter((symbol) => !query || symbol.includes(query) || symbolCatalog[symbol].name.toUpperCase().includes(query))
        .slice(0, 10)
        .map((symbol) => buildQuote(symbol));
      json(res, 200, results);
      return;
    }

    if (pathname.startsWith(`${apiBaseUrl}/symbols/`)) {
      const symbol = pathname.slice(`${apiBaseUrl}/symbols/`.length);
      json(res, 200, buildQuote(symbol));
      return;
    }

    if (pathname.startsWith(`${apiBaseUrl}/charts/`)) {
      const symbol = pathname.slice(`${apiBaseUrl}/charts/`.length);
      json(res, 200, buildChart(symbol, url.searchParams.get('timeframe') || '1d'));
      return;
    }

    if (pathname === `${apiBaseUrl}/watchlist` && req.method === 'GET') {
      json(res, 200, [...watchlist].map((symbol) => buildQuote(symbol)));
      return;
    }

    if (pathname === `${apiBaseUrl}/watchlist` && req.method === 'POST') {
      const body = await readBody(req);
      if (body.symbol) {
        watchlist.add(String(body.symbol).toUpperCase());
      }
      json(res, 200, [...watchlist].map((symbol) => buildQuote(symbol)));
      return;
    }

    if (pathname.startsWith(`${apiBaseUrl}/watchlist/`) && req.method === 'DELETE') {
      const symbol = pathname.slice(`${apiBaseUrl}/watchlist/`.length).toUpperCase();
      const deleted = watchlist.delete(symbol);
      json(res, deleted ? 200 : 404, { success: deleted, symbol });
      return;
    }

    if (pathname === `${apiBaseUrl}/market`) {
      json(res, 200, Object.keys(symbolCatalog).map((symbol) => buildQuote(symbol)));
      return;
    }

    if (pathname === `${apiBaseUrl}/trending`) {
      json(res, 200, ['THYAO', 'ASELS', 'GARAN', 'AKBNK'].map((symbol) => buildQuote(symbol)));
      return;
    }

    if (pathname === `${apiBaseUrl}/news`) {
      json(res, 200, buildNews(url.searchParams.get('symbol')));
      return;
    }

    if (pathname === `${apiBaseUrl}/orders` && req.method === 'GET') {
      json(res, 200, orders);
      return;
    }

    if (pathname === `${apiBaseUrl}/orders` && req.method === 'POST') {
      const body = await readBody(req);
      const order = {
        id: nextOrderId++,
        status: 'filled',
        createdAt: new Date().toISOString(),
        ...body
      };
      orders.push(order);
      json(res, 201, order);
      return;
    }

    if (pathname.startsWith(`${apiBaseUrl}/orders/`) && req.method === 'DELETE') {
      const orderId = Number(pathname.slice(`${apiBaseUrl}/orders/`.length));
      const index = orders.findIndex((order) => order.id === orderId);
      if (index < 0) {
        json(res, 404, { success: false, orderId });
        return;
      }

      orders.splice(index, 1);
      json(res, 200, { success: true, orderId });
      return;
    }

    if (pathname === `${apiBaseUrl}/account`) {
      json(res, 200, {
        balance: 250000,
        currency: 'TRY',
        buyingPower: 180000,
        riskLevel: 'moderate'
      });
      return;
    }

    if (pathname === `${apiBaseUrl}/portfolio`) {
      json(res, 200, {
        totalValue: 312450,
        dailyChangePercent: 1.84,
        positions: [...watchlist].slice(0, 4).map((symbol, index) => ({
          symbol,
          quantity: (index + 1) * 100,
          averagePrice: buildQuote(symbol).price - 3,
          currentPrice: buildQuote(symbol).price
        }))
      });
      return;
    }

    json(res, 404, { error: 'Not found', path: pathname });
  } catch (error) {
    json(res, 500, { error: error.message || 'Unexpected server error' });
  }
  });
};

const startMockServer = ({ host = '127.0.0.1', listenPort = port } = {}) => {
  const server = createMockServer();

  return new Promise((resolve) => {
    server.listen(listenPort, host, () => {
      console.log(`Mock API listening on http://${host}:${listenPort}${apiBaseUrl}`);
      resolve(server);
    });
  });
};

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await startMockServer();
}

export { apiBaseUrl, createMockServer, startMockServer };

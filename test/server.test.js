import assert from 'node:assert/strict';
import test from 'node:test';

import { apiBaseUrl, createMockServer } from '../server.js';

const startServer = async () => {
  const server = createMockServer();

  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  return server;
};

const stopServer = (server) =>
  new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

test('watchlist delete reports success and not-found states accurately', async (t) => {
  const server = await startServer();
  t.after(() => stopServer(server));

  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}${apiBaseUrl}`;

  let response = await fetch(`${baseUrl}/watchlist/THYAO`, { method: 'DELETE' });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true, symbol: 'THYAO' });

  response = await fetch(`${baseUrl}/watchlist/UNKNOWN`, { method: 'DELETE' });
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { success: false, symbol: 'UNKNOWN' });
});

test('order delete reports success and not-found states accurately', async (t) => {
  const server = await startServer();
  t.after(() => stopServer(server));

  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}${apiBaseUrl}`;

  let response = await fetch(`${baseUrl}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbol: 'THYAO', side: 'BUY', quantity: 10 })
  });

  assert.equal(response.status, 201);
  const order = await response.json();
  assert.equal(order.symbol, 'THYAO');

  response = await fetch(`${baseUrl}/orders/${order.id}`, { method: 'DELETE' });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true, orderId: order.id });

  response = await fetch(`${baseUrl}/orders/999`, { method: 'DELETE' });
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { success: false, orderId: 999 });
});

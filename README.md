# Trading Terminal

Trading Terminal, tarayıcıda çalışan tek sayfalı bir piyasa terminalidir. Bu repository artık yerel geliştirme için Vite ve basit bir mock API sunucusu ile hazır gelir.

## Gereksinimler

- Node.js 18+
- npm 9+

## Kurulum

Repository kök dizininde aşağıdaki komutları çalıştırın:

```bash
npm install
npm start
```

`npm start` şunları birlikte başlatır:

- `server.js` üzerinden mock API (`http://127.0.0.1:3001`)
- Vite development server (`http://127.0.0.1:5173`)

Vite development server başlarken tarayıcıyı otomatik açar.

## Ortam değişkenleri

Kök dizinde örnek çalışır ayarlarla bir `.env` dosyası bulunur:

```env
API_BASE_URL=/api
MOCK_API_PORT=3001
PORT=5173
```

- `API_BASE_URL`: Frontend'in kullanacağı API path'i
- `MOCK_API_PORT`: Mock API sunucusunun portu
- `PORT`: Vite development server portu

## Mock API

`vite.config.js`, `API_BASE_URL` isteklerini otomatik olarak mock API'ye proxy eder. Hazır örnek uç noktalar:

- `GET /api/health`
- `GET /api/search?q=THY`
- `GET /api/symbols/THYAO`
- `GET /api/charts/THYAO?timeframe=1d`
- `GET /api/watchlist`
- `POST /api/watchlist`
- `DELETE /api/watchlist/:symbol`
- `GET /api/market`
- `GET /api/trending`
- `GET /api/news`
- `GET /api/orders`
- `POST /api/orders`
- `DELETE /api/orders/:id`
- `GET /api/account`
- `GET /api/portfolio`

## Kullanışlı komutlar

```bash
npm run dev       # Sadece Vite development server
npm run mock-api  # Sadece mock API server
npm run build     # Production build
npm run preview   # Build çıktısını yerelde önizle
```

## Başlatma doğrulaması

Kurulumdan sonra aşağıdaki kontroller beklenir:

1. `npm install` hata vermeden tamamlanır.
2. `npm start` iki servisi birlikte ayağa kaldırır.
3. Tarayıcı `http://127.0.0.1:5173` adresinde açılır.
4. `http://127.0.0.1:5173` üzerinden Trading Terminal yüklenir.
5. `http://127.0.0.1:5173/api/health` çağrısı JSON cevap döner.

## Notlar

- Ana uygulama halen `index.html` içindeki mevcut arayüzü kullanır.
- Mock API geliştirme ve entegrasyon testleri için yerel, deterministik veri sağlar.

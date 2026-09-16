# Trading Terminal

Trading Terminal, tarayıcıda çalışan tek sayfalı bir piyasa terminalidir. Bu repository artık yerel geliştirme için Vite ve basit bir mock API sunucusu ile hazır gelir.

## Gereksinimler

- Node.js 20.19+
- npm 10+

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
npm test          # Mock API kontrat testleri
npm run build     # Production build
npm run preview   # Build çıktısını yerelde önizle
npm run deploy    # Vercel'e production deploy (lokal)
npm run deploy:ci # Vercel'e production deploy (CI)
```

## Vercel dağıtım kurulumu

Bu proje Vercel'de `dist/` çıktısı ile deploy edilir.

1. Vercel CLI ve GitHub entegrasyonunu hazırlayın:
   ```bash
   npm install
   npx vercel login
   npx vercel link
   ```
2. Production bundle'ı oluşturun:
   ```bash
   npm run build
   ```
3. Lokalden production deploy edin:
   ```bash
   npm run deploy
   ```

### CI/CD (GitHub Actions → Vercel)

`.github/workflows/ci-cd.yml` pipeline'ı:
- PR ve `main` push'larında test + build doğrulaması yapar
- `main` push'unda Vercel production deploy çalıştırır

Repository Secrets olarak aşağıdakileri ekleyin:
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

Runtime endpoint ayarları `env-config.js` üzerinden yönetilir ve build sırasında `dist/env-config.js` içine taşınır.

## Başlatma doğrulaması

Kurulumdan sonra aşağıdaki kontroller beklenir:

1. `npm install` hata vermeden tamamlanır.
2. `npm start` iki servisi birlikte ayağa kaldırır.
3. Tarayıcı `http://127.0.0.1:5173` adresinde açılır.
4. `http://127.0.0.1:5173` üzerinden Trading Terminal yüklenir.
5. `http://127.0.0.1:5173/api/health` çağrısı JSON cevap döner.

## Notlar

- Ana uygulama halen `index.html` içindeki mevcut arayüzü kullanır.
- Mock API geliştirme ve hafif API kontrat testleri için yerel, deterministik veri sağlar.

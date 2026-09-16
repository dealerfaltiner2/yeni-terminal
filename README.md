# yeni-terminal

Trading Terminal statik olarak yayınlanır ve mobil tarayıcıda doğrudan açılabilir. Repository hem sıfır kimlik bilgisi gerektiren GitHub Pages deploy'unu hem de isteğe bağlı Vercel pipeline'ını içerir.

## Canlı URL

- Birincil yayın: `https://dealerfaltiner2.github.io/yeni-terminal/`
- İkincil yayın: Vercel workflow'u yalnızca gerekli `VERCEL_*` secrets tanımlıysa deploy çalıştırır.

## Local development

```bash
npm install
npm start
```

`npm start` şunları birlikte başlatır:

- `server.js` mock API (`http://127.0.0.1:3001`)
- Vite development server (`http://127.0.0.1:5173`)

## Production build

```bash
npm test
npm run build
npm run preview
```

`npm run build`, `dist/` altında şu yayın paketini üretir:

- `index.html`
- `env-config.js`
- `vercel.json`
- `src/`
- `styles/`
- `backup-restore-v2.js`
- `.nojekyll`

Bundle göreli asset yolları kullandığı için GitHub Pages alt yolunda (`/yeni-terminal/`) ve Vercel root deploy'unda çalışır.

## Ortam değişkenleri

İsteğe bağlı build/deploy ayarları:

- `TRADING_TERMINAL_WORKER_URL`
- `TRADING_TERMINAL_DEFAULT_DATA_SOURCE`
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

Örnek değerler için `.env.example` dosyasını kullanın.

## GitHub Actions deploy akışı

- `.github/workflows/ci-cd.yml`: `npm test` + `npm run build` doğrulaması yapar; `main` push'larında Vercel credentials varsa Vercel deploy çalıştırır.
- `.github/workflows/github-pages.yml`: `main` push'larında aynı `dist/` bundle'ını build edip GitHub Pages'e deploy eder.

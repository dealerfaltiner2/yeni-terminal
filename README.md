# yeni-terminal

Trading Terminal uygulaması Vercel'e static olarak deploy edilecek şekilde ayarlandı. Uygulama production'da HTTPS üzerinden açılır ve mobil tarayıcılarda kullanılabilir.

## Gerekli environment variables

Uygulama build/deploy sırasında aşağıdaki değişkenleri kullanır:

- `TRADING_TERMINAL_WORKER_URL`: BIST worker endpoint'i
- `TRADING_TERMINAL_DEFAULT_DATA_SOURCE`: varsayılan veri kaynağı (`yahoo` veya `twelvedata`)
- `VERCEL_TOKEN`: Vercel CLI token'ı
- `VERCEL_ORG_ID`: Vercel organization/team id
- `VERCEL_PROJECT_ID`: Vercel project id

Örnek değerler için `.env.example` dosyasını kullanın.

## Local production build

```bash
npm install
npm test
npm run build
```

Build çıktısı `dist/` altında oluşur ve deploy için sadece gerekli dosyaları içerir:

- `index.html`
- `env-config.js`
- `vercel.json`
- `src/`
- `styles/`
- `backup-restore-v2.js`

## Vercel deploy

İlk kullanımda projeyi Vercel hesabınıza bağlayın:

```bash
npx vercel link
```

Ardından production deploy alın:

```bash
npm run deploy
```

Deploy sonrası live link şu formatta olur:

```text
https://<vercel-proje-adiniz>.vercel.app
```

## GitHub Actions otomatik deploy

`.github/workflows/ci-cd.yml` workflow'u:

1. `npm test` ile build konfigürasyonunu doğrular
2. `npm run build` ile fallback/default değerlerle production bundle mekanizmasını doğrular
3. `main` branch'ine push geldiğinde Vercel'e production deploy yapar

Not: Asıl production environment values yalnızca deploy job'unda secrets/variables üzerinden enjekte edilir.

GitHub repository secrets/variables olarak şunları ekleyin:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`
- `TRADING_TERMINAL_WORKER_URL`
- repository variable: `TRADING_TERMINAL_DEFAULT_DATA_SOURCE`

`Twelve Data` anahtarını Vercel bundle içine gömmeyin; uygulamadaki alan artık yalnızca aktif oturum için kullanılır.

## HTTPS / SSL

Vercel production deployment'ları varsayılan olarak HTTPS ile yayınlanır. Deploy tamamlandıktan sonra aşağıdaki komutla doğrulayabilirsiniz:

```bash
curl -I https://<vercel-proje-adiniz>.vercel.app
```

Yanıtta `strict-transport-security` header'ı görünmelidir; bu ayar `vercel.json` içinde tanımlıdır.
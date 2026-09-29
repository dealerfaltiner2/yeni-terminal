# BIST Terminal · PRO — proje notları (Claude için)

Sahibi: Fatih (İstanbul, BIST gün içi / scalp). iPhone'dan çalışır; Türkçe, adım adım,
basit anlatım ister. Önce plan, sonra uygulama. Kod verilecekse tek parça.
Test etmeden yayınlama ("dikkatli yaz, test et öyle ver").

## Parçalar
- `index.html` — tek dosyalık terminal (GitHub Pages: https://dealerfaltiner2.github.io/yeni-terminal/).
  `APP_VER` sürüm numarası; her değişiklikte artır (güncelleme bandı buna bakar).
  Ana ekran uygulaması (PWA): `manifest.webmanifest`, `sw.js`, `icon-*.png`.
- `worker/` — Cloudflare Worker **bist-tv** (Workers Builds ile GitHub'dan otomatik yayın;
  root dir `worker`, include path `*`). ESKİ `bist` Worker'ına DOKUNMA (Yahoo proxy).
  - Secrets (Cloudflare'de, repoda YOK): TV_SESSION, TV_SESSION_SIGN, ACCESS_KEY.
  - KV: binding `DB` → namespace `bist_db` (id 3dd0…07b0). Boş olan `bist_db_bos_kullanilmiyor`.
  - Cron her dakika: alarm, sunucu radarı, KAP haberleri, bağlantı sağlığı, Pine senkronu.
  - Yollar (hepsi `/<ACCESS_KEY>/...`): test, status, bars, news, sync, prefs,
    tv-token, WebSocket `?direct=1` (doğrudan boru — CPU limiti için), pine-test, pine-sync.
- `pine/` — Pine v6 göstergeleri. Sunucu 5 dk'da bir değişenleri derleyip kullanıcının
  TradingView "Göstergelerim"ine kaydeder (başarıda mesaj yok, hatada Telegram).
  NABIZ testte başarısız oldu (30 hisse, 6 ayar, hepsi eksi) ve silindi. Yeni göstergeler ÖNCE worker/src/strat.js aday yarışında test edilir, sonra Pine yazılır.

## Veri
- Canlı: yalnızca TradingView (kullanıcının gerçek zamanlı BIST yetkisi, Worker üzerinden).
- Yedek: Midas (15 dk gecikmeli; tavan/taban için). Yahoo ve Twelve Data kaldırıldı.

## Bilinen dersler
- D1 ücretsiz: günde 5M satır OKUMA. bars tablosunu json_each ile tarama (~5M satır). Özet tablolar kullan.
- Ücretsiz Cloudflare: istek başına 10 ms CPU → canlı akış Worker kodundan GEÇMEMELİ (direct=1).
- TradingView quote_add_symbols: bayrak objesi ekleme; 20'lik paketler, sırayla (tvPump).
- SEANS SAATİNDE (hafta içi 09:55–18:15) PUSH YAPMA: Workers Builds include path '*' → HER push Worker'ı yeniden yayınlar → herkesin canlı
  WebSocket bağlantısı kopar (29.09 sabahı 'kopma 9'un sebebi). Acil değilse commit'le, 18:20'den sonra push et.
- GitHub Pages yayını ara sıra "deploy" adımında düşer → boş commit ile yeniden tetikle.
- v6.0 ANA CİHAZ: sahip kodu D1 meta k='owner' (sıfırlamak için o satırı sil). Yalnız sahip: sync, prefs, cron-test, pine-sync, devices, dev-block (?own=KOD).
  Kod yokken (sahip belirlenmeden) eski davranış. Cihazlar D1 tablo dev (hello, tv-token, WS direct'te kaydedilir; blocked=1 → canlı akış kesilir).
  Terminal: LS devId/devName/ownTok; Ayarlar → "Ana cihaz · bağlı cihazlar".

- v6.1 SİNYAL KARNESİ (worker/src/sig.js): D1 tablo sig. Kaynaklar: radar (sunucu), algi + firsat-A/B (yalnız ana cihaz, /siglog).
  Seans dışında cron sigEval: 1 dk mumlarla o10/o15 (±%1/±%1,5 hangisi önce; aynı mumda ikisi → stop), r15, r60, rc, mfe, mae, idx.
  18:20 sonrası Telegram özeti (meta 'sigsum'). Elle: /sig-eval?own=KOD (&sum=1 özet). Bağlantı hatasında sinyal bekletilir.
- v6.3 KAP HABER (worker/src/kap.js): KAP'ın kendi API'si POST /tr/api/disclosure/members/byCriteria (günün tüm bildirimleri, Worker'dan çalışıyor).
  Dakikada bir (her gün), çalışma başına ≤40 yeni bildirim; D1 tablo kap (idx PK), meta kap_last / kap_st / kap_err.
  Sınıflandırma RULES (tür/yön/önem). Telegram: yalnız TAZE (<15 dk); önem3 her hisse, önem2 (yönlü/bilanço) XU100+izleme, izleme önem≥1.
  Pencere dışındakiler (sent=0) hafta içi 09:30 'Gece gelen önemli KAP'lar' özeti. Önem≥1 her haber Sinyal Karnesi'ne src 'kap-<tür>', px=null (giriş = sonraki mumun açılışı; seans dışı → sonraki iş günü 09:59), pre = girişin önceki kapanışa göre farkı.
  Terminal: Menü → KAP Haber (/kap?f=onemli|hepsi&s=A,B). Eski 8 hisselik TV KAP takibi kaldırıldı.
  Ücretsiz plan: 50 dış istek / 1000 iç (D1) istek her çalışmada; sig/kap tablolarında indeks var (okuma sınırı!).

## Sırada
- Yükselenler araştırması: worker/src/rise.js → D1 tablo feat (hisse-gün özellikleri, 10:30'da bilinenler + sonuç), meta 'sector'. Kıyas: yükselen (ret≥4 / rest≥3) vs diğer günler.
- Önceki testler (A/B notu grade-v1, hafta-v1, yarış r-*) Fatih'in isteğiyle İPTAL edildi (D1 okuma sınırı). btStep artık yalnız feat işini yapar.

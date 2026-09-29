# BIST Terminal · PRO — proje notları (Claude için)

Sahibi: Fatih (İstanbul, BIST gün içi / scalp). iPhone'dan çalışır; Türkçe, adım adım,
basit anlatım ister. Önce plan, sonra uygulama. Kod verilecekse tek parça.
Test etmeden yayınlama ("dikkatli yaz, test et öyle ver").

**ÖNCE `docs/DEVIR.md` DOSYASINI BAŞTAN SONA OKU** — ayrıntılı geçmiş, kararlar, denenip tutmayanlar ve sıradaki işlerin nasıl yapılacağı orada.
%60 araması için hazır araçlar: `tools/feat_pack.py` + `tools/feat_search.py`.

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

- v6.4 KOPMA TEŞHİSİ: terminal kapanmaları arka plan (iOS) / gerçek ayırır (TVL.dlog, drops, bgDrops); D1 dev.diag = 'dD bB:SSDD-kod-bg-süre…'.
  29.09 sonucu: gerçek kopmaların sebebi seans içi push'lardı; push olmayınca gerçek kopma ~0.
- v6.5 ALGI RADARI kart görünümü (algiCard): durum etiketi, skor çubuğu, düz Türkçe açıklama, 💬 yorum, "nasıl okunur".
- KARNE mesajı (sigSummary): sade Türkçe (kazandı/kaybetti → %), sabit sıra A/B/Algı/Radar, KAP türleri Türkçe, 'kap-devre' hariç
  (devre kesici haber değil; kap.js karneye yazmaz). Özeti yeniden göndermek: D1 meta 'sigsum' satırını sil (18:20 sonrası cron yeniden yollar).
- Fatih'in tercihi: tablolar/mesajlar sade ve Türkçe olsun; simge/kısaltma yerine düz cümle.
- v6.6 FİLTRE KONTROLÜ (yalnız worker/src/sig.js): sig tablosuna `adr` (son 20 gün ort. günlük aralık %, feat ile aynı formül; sigEval ayrı '1D' çekimiyle, gelmezse boş).
  Endeks zaten `idx` (sinyal anı XU100, önceki kapanışa göre). Karne özetinde '🔎 Filtre kontrolü': endeks artı/eksi, oynak (≥%5)/sakin — tüm günler, yalnız AL, KAP hariç.
  Amaç: araştırmadaki endeks ve oynaklık filtreleri KENDİ sinyallerimizde tutuyor mu? Sinyaller DEĞİŞMEDİ. 1–2 hafta sonra bak, tutarsa sinyal kapısı olarak ekle (Fatih onayıyla).

## Sırada
- 2–3 hafta Sinyal Karnesi biriktir → hangi kaynak/puan/KAP türü tutuyor; tutmayanları kapat/sıkılaştır. Hedef ±%1'de %60 başarı.
- %60 araması için veri hazır: D1 feat tablosunda o10/o15/o20 (±%1/1,5/2 hedef-stop yarışı, 10:30 girişi, 92 hisse, ~13 ay).
  Tarama SQL'de YAPILAMAZ (okuma sınırı); veriyi sıkıştırıp buraya al, yerelde tara (eski dönemde ara, yeni dönemde doğrula).
- 'Güçlü koşucu' (d20≥25, zirveye yakın, oynaklık≥4, endeks≥0) geçmişte artıydı ama Fatih reddetti (çok yükselmiş hisse).
- Derinlik verisi: TradingView'da BIST derinliği yok. Aday: İdeal (ideAlgo, C# robot, Sistem.DerinlikVerisiOku) — Fatih almayı düşünüyor;
  gerekirse robot her dakika derinlik özetini sunucuya POST eder. Windows PC gerekir.
- Sosyal medya şimdilik yok (manipülasyon riski); ileride 'anormal ilgi uyarısı' olabilir.
- İçeriden alım-satım KAP'ında alış/satış ayrımı yok (detay uç noktası: /tr/api/notification/attachment-detail/{idx}).

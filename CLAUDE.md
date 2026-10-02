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
- Workers Builds (sunucu) düşerse BOŞ COMMIT İŞE YARAMAZ (yalnız worker/ altındaki değişiklikle tetiklenir) → worker/ içinde zararsız bir yorum satırı değiştirip push et.
  Yüklemenin gerçekten olduğunu doğrula: GitHub commit check-runs'ta 'Workers Builds: bist-tv' success OLMALI (yoksa yükleme yapılmamıştır).
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
  30.09 düzeltmesi: 'sigsum' yalnız BAŞARILI gönderimde yazılır; başarısızsa 10 dk'da bir yeniden (en çok 12, meta 'sigsum_try').
  Ölçülemeyen sinyal varsa rapor en geç 21:00'de ölçülenlerle gider ('⏳ n sinyal için veri gelmedi'). Veri gelmeyen hisse 3 denemeden sonra sıranın sonuna atılır.
  Teşhis: meta 'sig_st' = son ölçüm çalışmasının sonucu (süre, ölçülen, verisiz, kalan); meta 'cron_hb' = dakikalık işin son ulaştığı adım (1..5). Karne ölçümü KAP'tan önce çalışır.
- v6.7 MİSAFİR MODU (isGuest = LS ownClaimed && !ownTok): Telegram (#tgsec, Algı Telegram) ve Yedek (#yedeksec) gizli, backup/restore/cloudSave kilitli,
  misafirde tgTok/tgChat/algiCfg.chat bir kez silinir (LS guestWiped). Kod girilince guestApply() bölümleri açar.
- v6.8 YENİ CİHAZ ONAYI: D1 dev.ok. Ana cihaz varken onaysız/engelli cihaz canlı akış, tv-token, bars, scan, tv-scan, news, status, test alamaz (403).
  Mevcut cihazlar geçişte onaylandı; own kodu gelen cihaz otomatik onaylı. Onay: Ayarlar → bağlı cihazlar → Onayla (/dev-ok, sahip).
  ?dev= olmadan veri isteği 6 Ekim 2026'ya kadar serbest (DEV_GRACE). pine-test artık sahip yolu. Repo herkese açık → asla sır yazma.
- v6.9–7.0 TASARIM (index.html sonundaki 3 blok): IC{} = 19 bölümün 'Bu nedir?' bilgi kartı (infoOpen(key), #infosheet; eşikler koddan — kod değişirse IC metnini de güncelle!).
  Her sekmenin başına .sechd başlık otomatik eklenir (chart hariç). Menü IC_GRP ile gruplu (SİNYAL VE HABER / PİYASA / BENİM), kutudaki ⓘ kartı açar.
  Algı kartı: 4 şart çipi (✓/○). Fırsat kartı: whyChips 'Neden listede?'; zaman dilimi şeridi + ölçerler Detay içinde.
  Karne sekmesi üstünde SUNUCU KARNESİ: Worker /sigstats (sig.js sigStats, son 10 iş günü, 5 dk önbellek, cihaz onayı gerekir); KSTAT bilgi kartlarına karne rozeti verir.
  v7.0 kompakt katman: hap alt sekmeler, yuvarlak kartlar, sıkı tablolar (yalnız CSS).
- v7.1 ŞİMDİ + BİLDİRİM: ilk sekme 'now' (renderNow, 5 sn'de bir; draw sarmalanır). Alt menü: Şimdi|Fırsat|Algı|Grafik|İzleme|Menü; Canlı menüye taşındı.
  Seans açık: canlı sinyaller (S.algi.rows ates/hazır + bugünkü AL.log + briefData Fırsat A + /kap önem≥2 son 3 sa), karne, açık pozisyonlar.
  Kapalı: son günün karnesi, seans sonrası KAP, 'Yarın izlenecekler' (hacim≥20Mn, %1,5–7 artı, zirveye ≤%1, RVOL≥1,3 — sinyal değil).
  sigToast(): Algı ateşlemesi ve derin tarama A notunda üstten kayan kart (20 sn). sparkFor(sym): 15dk önbellek ya da S.tvHis mini çizgi.
  Renk kuralı: yeşil/kırmızı = yön, sarı = seçili/yapılacak, mavi = bilgi (sekme/menü/kurulum etiketleri nötr).
  DİKKAT: kstatLoad sonuç gelmezse 60 sn yeniden denemez ve çağıranlar yalnız sonuç gelince yeniden çizer (v6.9'da sonsuz döngü vardı).
- v7.2 KENDİNİ TOPARLAMA + AKŞAM BAKIMI: terminal hataları ve toparlamalar → /errlog → D1 tablo `err` (d,src,kind,msg,loc; tekrarında n artar; fixed = bakım notu).
  Sunucu hataları da err'e yazılır (cron, KAP, karne, rapor gönderimi, veri gelmeyen hisse). Terminal: ekran hata verirse bir kez yeniden çizer; seansta veri 60 sn gelmezse bağlantıyı yeniler.
  TESTLER: `bash tests/run.sh` (sözdizimi + karne mantığı + Playwright arayüz 34 kontrol + yerel Worker). HER DEĞİŞİKLİKTEN SONRA ÇALIŞTIR; geçmeden yayınlama.
  Akşam bakımı = zamanlanmış görev (hafta içi 18:53): err + meta durumlarını okur, düzeltir, test eder, geçerse yayınlar. Fatih TELEGRAM İSTEMİYOR — sonuç yalnız Claude bildirimi.
- 01.10 bakım: karne ölçümü 18:25'ten sonra her dakika yarıda kesiliyordu (iz bırakmadan) → karne + KAP durdu. sigEval artık meta 'sig_run' (ölçülen hisseler) + 'sig_kill' (kesilme sayısı) tutar; kesilen hisseler tek tek denenir, 3 kez kesilen 'ölçülemedi' diye kapanır. sigOutcome gün sınırını sayıyla hesaplar (işlemci).
- v7.3 (01.10 akşam, genel bakım): ÜCRETSİZ PLANDA DAKİKALIK İŞİN TAMAMI 10 ms İŞLEMCİ PAYLAŞIR (süre sınırı 15 dk, sorun değil).
  Cron sırası: alarm/radar → duyuru → KAP (3) → karne (4) → btStep (5). Karne: gereken kadar mum (aynı gün 650, eskiye 520/gün, en çok 2500),
  BIST 100 mumları 10 dk önbellek, günlük (1D) yalnız KAP dışı sinyalde; FAIL sayacı hisse başına çalışmada bir; fiyatsız KAP sinyali tatile düşerse sonraki işlem gününe kayar.
  KAP: yanıt uzunluğu aynıysa ayrıştırma atlanır (KAPC), gece 00:00–00:15 dün de istenir, yalnız gerçekten yeni eklenen satırlar karne/Telegram'a gider, kap_last en sonda;
  sabah özeti ≤3500 karakterlik parçalar, yalnız giden satırlar sent=1; /kap 'INDEXED BY kap_t' + cihaz onayı (DATA_ROUTES). JSON yanıtları girintisiz.
  Terminal: Şimdi'de dış metinler htmlEsc; bekçi yalnız TVL.last'a bakar; briefData(true) piyasayı yeniden taramaz; dokunurken Şimdi yeniden çizilmez; otomatik tarama İstanbul saatiyle.
  Testler: tests/kap.mjs eklendi; D1 taklidinde bind() YENİ nesne döndürmeli (gerçek D1 gibi). run.sh sunucu testinin çıkış kodunu artık doğru sayıyor.
- v7.4 İŞ BİLGİSAYARI SİNYAL MOTORU (pc/): Fatih'in iş yerindeki 7/24 açık Windows bilgisayarında terminal ?bot=1 ile başsız Chromium'da (Node+Playwright) sürekli açık.
  Algı + otomatik Fırsat taraması (autoRun, 15 dk) orada çalışır, sinyaller Telegram + karne. Telefon motor canlıyken (hello yanıtı 'bot') Algı/autoRun Telegram'ı göndermez.
  Kurulum: telefonda Ayarlar → Ana cihaz → 'İş bilgisayarını bağla' → /pair-create (sahip) 10 karakterlik tek kullanımlık kod (15 dk, D1 meta 'pair:KOD');
  PC'de PowerShell: irm https://raw.githubusercontent.com/dealerfaltiner2/yeni-terminal/main/pc/kur.ps1 | iex → /pair (anahtarsız) ayarları alır → %LOCALAPPDATA%\BistMotor\ayar.json.
  Başlatma: Başlangıç klasöründe BistMotor.vbs (yönetici izni gerekmez). Durum: http://127.0.0.1:47123 ; günlük: motor.log. Kaldırma: pc/kaldir.ps1.
  bot.js: nabız (window.BOT.beat) 3 dk durursa ya da tarayıcı çökerse yeniden başlatır; her gün 09:40 ve 18:25 tazeler (son sürüm). Sunucu: meta 'bot_seen' (motorun hello'su), seansta 5 dk sessizse Telegram uyarısı (meta 'bot_alert').
  Kütüphane yedeği: unpkg/cdnjs engelliyse jsdelivr, o da yoksa LightweightCharts taklidi (grafik yok ama Algı/Fırsat çalışır — şirket ağı için).
- v7.5 KENDİ ALAN ADI: iş yeri ağı *.workers.dev'i engelliyor (ERR_CONNECTION_CLOSED). altinerpano.com alındı (Cloudflare, otomatik yenileme);
  Worker ayrıca api.altinerpano.com'da (wrangler.jsonc routes custom_domain). workers.dev de çalışır; telefonlar eski adreste.
  pairStart motorun tvproxy'sini yeni adrese çevirir; kur.ps1 /pair'i yeni adrese yollar, npm.cmd/npx.cmd kullanır (betik engeli).
  Şirket PC'sinde PowerShell'de önce 'Set-ExecutionPolicy -Scope Process Bypass -Force'. 01.10 22:48 motor kuruldu, canlı veri var.
- v7.6 ŞİMDİ YENİ GÖRÜNÜM: nHero (BIST 100 büyük rakam, piyasanın havası, artıda/eksi çubuğu, XU030/BANKA/USD/EUR/ALTIN kutuları = S.mkt, refreshTick doldurur), nAvatar, nPill, halka karne (nRing), sektör Türkçe (SEC_TR). Geniş ekranda iki sütun (.ngrid).
- v7.7 (01.10 gece) BİLGİ KATMANI (sinyal kuralları DEĞİŞMEDİ): worker/src/ecal.js TradingView ekonomik takvimi (TR önem≥0, ABD önem 1), 30 dk'da bir → meta 'ecal'; /ecal (DATA_ROUTES).
  Terminal: ECAL, ecTitle (EC_TR Türkçe başlıklar), Şimdi'de 'Ekonomik takvim' kartı + 45 dk kala sarı uyarı; sigNotes(sym) = bilanço ≤7 gün (earnings_release_next_date, BASE kolonu) + 30 dk içindeki veri
  → Algı msgFire, Fırsat Telegram ve bildirim kartına eklenir. VİOP: tvScan('futures') BIST:XU030D1! (S.viop; abonelikte VİOP yok → 15 dk gecikmeli, ⏱); 09:30–10:00 'VİOP açıldı' satırı.
  Şerit: S&P vadeli (CME_MINI:ES1!), DOLAR END. (TVC:DXY), ABD 10Y. /midas (Midas yedeği bist-tv'de; eski 'bist' worker'ında /midas YOK — o worker aslında eski bist-tv kopyası).
  worker/src/probe.js: meta 'probe_req'=0 yazılırsa dakikada bir kaynak denemesi → 'probe:<ad>' (yeni TradingView alanlarını sunucudan denemek için).
  kur.ps1 6. adım: 'oturum açmadan başlasın mı' → Görev Zamanlayıcı BistMotor (AtStartup, Windows şifresi; yönetici izni gerekebilir; olmazsa Başlangıç klasörü yeter).
- v7.8 (03.10, Fatih onayıyla): Radar Telegram mesajı KAPALI (opt.rdTg yoksa; karneye yazmaya devam). KAP 'icerden' Telegram'a gitmez (wantTg). Algı: hisse başına günde tek sinyal (AL.log aynı gün),
  fc≥0.8 → '💪 GÜÇLÜ' etiketi; karne özetinde güçlü/diğer ayrı satır (meta.fc). MOMENTUM (deneme): momScan() 10:30–10:50 bir kez (motor ya da motor yokken ana cihaz):
  dün ≥+%3, 5 gün ≥+%5, adr ≥%6, 10:30'da <%1, 20g ort. ciro ≥50 Mn → en çok 6; src 'momentum', ±%1,5 ile ölçülür (karne özetinde o15). Araştırma: docs/DEVIR.md 6b.
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

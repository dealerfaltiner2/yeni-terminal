# BIST Pusula (eski adı BIST Terminal · PRO) — proje notları (Claude için)

Sahibi: Fatih (İstanbul, BIST gün içi / scalp). iPhone'dan çalışır; Türkçe, adım adım,
basit anlatım ister. Önce plan, sonra uygulama. Kod verilecekse tek parça.
Test etmeden yayınlama ("dikkatli yaz, test et öyle ver").

**ÖNCE `docs/DEVIR.md` DOSYASINI BAŞTAN SONA OKU** — ayrıntılı geçmiş, kararlar, denenip tutmayanlar ve sıradaki işlerin nasıl yapılacağı orada.
%60 araması için hazır araçlar: `tools/feat_pack.py` + `tools/feat_search.py`.

## AJAN DÜZENİ (11.10, Fatih'in isteği — birden çok Claude aynı anda çalışıyor, HER AJAN UYAR)
Fatih her yeni oturumun ilk mesajında rolü söyler: "Rolün: GELİŞTİRİCİ" ya da "Rolün: ARAŞTIRMACI". Rol söylenmediyse ARAŞTIRMACI gibi davran ve sor.
- GELİŞTİRİCİ (aynı anda yalnız BİR tane): kod yazar, `bash tests/run.sh` geçince yayınlar. Yayından hemen önce `git pull --rebase`; çakışma varsa başkasının değişikliğini ezme, birleştir.
  Push yalnız hafta içi 18:20–09:50 arası ya da hafta sonu. Yayından sonra check-runs'ta 'Workers Builds: bist-tv' success'i doğrula.
- ARAŞTIRMACI (en çok bir-iki tane): karne/D1/geçmiş veriyi inceler, sonucu Fatih'e ve docs/DEVIR.md'ye (yalnız kendi bölümüne) yazar. index.html ve worker/ dosyalarına DOKUNMAZ, push yapmaz
  (DEVIR notunu commit'leyebilir ama push'u GELİŞTİRİCİ'ye bırakır ya da seans dışında yalnız docs/ değişikliğiyle yapar). D1'de büyük tarama yapmaz (okuma sınırı ortak): veriyi küçük parçalarla al, yerelde hesapla.
- ZAMANLANMIŞ GÖREVLER: akşam bakımı (hafta içi 18:53) GELİŞTİRİCİ kurallarıyla çalışır; piyasa yorumu yalnız D1 `yorum` tablosuna yazar, koda dokunmaz.
  AJAN DENETİMİ (15.10, Fatih: 'her akşam ajanları takip et, yanlış varsa düzelt'): zamanlanmış görev 'Pusula ajan denetimi' hafta içi 21:07 — günün commit'lerini ve görevlerini kurallara göre denetler (seans içi push, onaysız eşik, indekssiz dakikalık sorgu, sır, araştırmacının koda dokunması), D1 sağlığına bakar, gerekiyorsa düzeltir (testli, GELİŞTİRİCİ kuralları), sonucu Fatih'e bildirim olarak verir.
- HERKES İÇİN: sunucunun DAKİKALIK işine yeni sorgu ekleyen, EXPLAIN QUERY PLAN ile indeks kullandığını gösterir (count/GROUP BY/indekssiz WHERE yasak). Yeni toplayıcı/araştırma işi eklemek GELİŞTİRİCİ'nin işidir ve Fatih onayı ister.
  Sinyal kuralı/eşik değişikliği yalnız Fatih onayıyla. Yaptığın her kalıcı değişikliği bu dosyaya kısa not olarak ekle (sonraki ajan buradan öğrenir).

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
  10.10: kaph.js'in indekssiz 'WHERE st = 0 ORDER BY …' sorgusu her dakika tüm tabloyu okudu → sınır doldu (Cumartesi, gece 03:00'te sıfırlanır). DAKİKALIK HER SORGU İNDEKSLİ OLMALI (EXPLAIN QUERY PLAN ile 'SEARCH … USING INDEX' gör).
  11.10: aynı gün gece sınır YİNE doldu — kaph iş bitince 'GROUP BY kind' sayımını (tüm tablo) her dakika yapıyordu → artık günde bir (meta kaph_st.bitti bugünse atla). Dakikalık yolda count/GROUP BY YASAK.
  11.10 akşam: kaph detay toplayıcı NTHOL 1619094'te takıldı (çalışma işlemci sınırında kesiliyor, satır st=0 kalıyordu → aynı bildirim her dakika; cron_hb hiç '5-tamam' olmadı). Artık detay çekmeden önce st=-1, yanıt 150k karakterde kırpılır.
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
- v7.9 ŞİMDİ KOMUTA MERKEZİ: XU100 gün içi çizgi (idxLoad 5dk mum, IDXD), Güne/Yarına hazırlık kartı (nPrep; 08:00–10:00 ve 18:15 sonrası), Canlı takip (nLive: /sigtoday [sig.js sigToday, 30 sn önbellek]
  + AL.log + MOM.last; stop–hedef çubuğu, TRK gün içi uç noktalar), Piyasa nabzı (sekmeli, LS nowp), Para akışı (sektör ağırlıklı ort.), İzleme listem (W()), Benim günüm (S.jr bugün + KSTAT son 10 gün).
- v8.0 AD: BIST Pusula (03.10). manifest name/short_name, apple-mobile-web-app-title, <title>, ikonlar (pusula: yeşil/kırmızı ibre, altın halka; ?v=2 önbellek kırıcı), Şimdi üstünde .bpbrand. iOS'ta ikon/ad için ana ekrana yeniden eklemek gerekebilir.
- v8.2 (03.10): iPHONE BİLDİRİMLERİ worker/src/push.js (RFC8291+VAPID, kütüphanesiz; anahtar D1 meta 'vapid', abonelik D1 tablo push; /push-key /push-sub /push-off /push-send; kategoriler algi,momentum,firsat,kap,poz,tavan,rapor).
  sw.js push + notificationclick (?s=HİSSE → grafik). Terminal pushMsg = Telegram'la aynı kural (motor canlıysa yalnız motor); Ayarlar #pushsec. KAP push cron'da en çok 2/çalışma.
  ALDIM + POZİSYON ASİSTANI: aldimOpen (lot = sermaye×risk%÷(giriş−stop)) → S.jr (posId) + /pos (worker/src/pos.js, meta 'pos'); cron posWatch: +%1 stopu girişe çek, stopa %0,3, hedef/stop, 17:45 hatırlatma, 18:15 temizlik.
  TAVAN TAKİBİ worker/src/tavan.js: 18:12+ tavan kapananlar src 'tavan' px=null t=kapEntry (ertesi gün 09:59) → pre = açılış farkı; karne özetinde ayrı blok. HAFTALIK RAPOR sig.js weeklySummary (Cuma, karneden sonra, meta 'weeksum').
  Günlük'te jrAnalysis (İşlem analizim), Karne'de labHtml (Deneme laboratuvarı — LAB dizisi index.html'de; yeni araştırma sonucu buraya eklenir). tests/pos.mjs.
- v8.3 (03.10) KÂĞIT ÜZERİNDE BOT worker/src/paper.js (gerçek para/emir YOK; Midas'ın açık API'si yok → tam otomatik şimdilik yok, sıradaki adım 'onaylı bot').
  Karnedeki sig satırlarından hesap (paperSim saf fonksiyon): yalnız AL, seçili kaynaklar, işlem başına sabit tutar, Momentum ±%1,5 (o15) / diğerleri ±%1 (o10), ikisi yoksa rc (gün sonu),
  %0,1 kayma, günde en çok N işlem, hisseye günde bir. Ayar D1 meta 'paper' (/paper-set sahip; /paper DATA, 2 dk önbellek). Karne Telegram'ına + haftalık rapora 🤖 satırı.
  Terminal: Şimdi'de paperCard (bugün canlı yaklaşık + toplam + 10 gün çubuk), Karne başında paperFull (gün gün, kaynak tek başına, son işlemler, kurallar, ⚙️ ayarlar). tests/paper.mjs.
- v8.4 (03.10) BOT YARIŞI (sinyaller DEĞİŞMEDİ): sig'e tx (çabuk çıkış: ±K en çok 60 mum, gelmezse 60. mum kapanışı), pbn/pb (geri çekilme girişi: 30 dk içinde px×0,995'e inerse oradan ±K yarışı, gelmezse gün sonu; pbn 0 = giriş yok, -1 = ölçülemedi).
  sigOutcome hesaplar; eski sinyaller sigBackfill ile tamamlanır (ölçülecek sinyal yokken, çalışmada 3 hisse, son 6 gün). paper.js botRace: mevcut / güçlü Algı / öğle arası yok (11–13) / geri çekilme / çabuk çık / günlük fren (2 stop).
  Karne'de '🏁 Bot yarışı' tablosu, Şimdi kartında 'önde' satırı, karne mesajında önde olan, Cuma raporunda haftalık sıralama. 2–3 hafta sonra kazanan kural Fatih onayıyla gerçek sinyale.
- v8.5 (03.10) HİSSE RÖNTGENİ (arkadaşların isteği): xrayOpen(sym) alt sayfa (#xray). Şimdi'nin en üstünde arama çubuğu, Fırsat araç çubuğunda 🔍.
  analyze() (15 dk mum, Fırsat derin taramayla aynı not) → A/B/C + ön şartlar (gate) + 6 puan maddesi (analyze'a yalnız bilgi alanı stk/nss eklendi, not mantığı DEĞİŞMEDİ),
  mtfStrip + ölçerler, planOf seviyeleri + hacim profili, warnsOf/sigNotes/KAP uyarıları, hissenin 60 günlük karnesi (Worker /sigsym, sig_sym indeksi, 5 dk önbellek), 'yatırım tavsiyesi değildir'.
  Fırsat kartı: zaman dilimi şeridi + 4 ölçer artık Detay'a basmadan görünür.
- v8.6 (03.10 gece, Fatih onayıyla) SESSİZ TREND — SESSİZ KAYIT (araştırma DEVIR 6c): sesScan() 10:31–10:50 bir kez (motor ya da motor yokken ana cihaz),
  15 dk mumlardan rise.js ile BİREBİR formül (sesCalc; testte eşitlik kontrolü): d20≥10, dist≥−3, vr30<1, rng30/adr<0,5, adr≥5 → sigPost src 'sessiz' (en çok 10). Telegram/bildirim/ekranda sinyal YOK.
  ±%1,5 ile ölçülür (HS ve K'de momentum gibi). Günlük karne mesajında, sigToday'de ve Telegram'daki yarış satırlarında gösterilmez; Karne ekranı + bot yarışında '🤫 Sessiz trend' botu.
  Karar: ~3 Kasım'da (bir ay) karne + bot yarışı + sessiz trend birlikte değerlendirilecek.
- v8.7 (04.10) CLAUDE PİYASA YORUMU: zamanlanmış görev 'Pusula piyasa yorumu' (hafta içi 10:40 / 14:40 / 18:40 İstanbul) veriyi okur (BORSA araçları + D1 sig/kap/meta),
  yorumu D1 tablo `yorum` (t ms, slot acilis|ogle|kapanis|hafta, txt ≤1500 karakter, **kalın** + '• ' madde) içine DOĞRUDAN yazar (anahtar gerekmez). Worker /yorum (DATA) son 8'i verir;
  terminal yorumCard Şimdi'nin en üstünde (htmlEsc), başlık 'Pusula'nın piyasa yorumu' (Fatih isteği: Claude adı geçmesin; yorum Pusula ağzından). Kurallar: yalnız veriye dayan, karneyi an, kesin fiyat tahmini yok, 'yatırım tavsiyesi değildir'. Telegram YOK.
- v8.8 (07.10, Fatih: 'çok mesaj geliyor, yalnız Telegram ve yalnız önemli'): iPhone bildirimleri KAPALI (pushMsg ve sunucu pushSend erken döner; D1 push tablosu boşaltıldı).
  Telegram'a giden: Algı yalnız 💪 GÜÇLÜ (fc≥0,8), Fırsat otomatik taraması yalnız A notlu AL (B/SAT yalnız karne), Momentum, KAP önem 3 + izleme listesinde önem≥2 (BIST100 önem-2 artık gitmez),
  pozisyon asistanı, motor uyarısı, akşam karne + Cuma haftalık. KAPALI: tavan listesi mesajı, telefonun eski 'gün sonu raporu'. Karneye yazma HİÇBİRİNDE değişmedi.
- 08.10 MOTOR (antivirüs uyumlu): iş PC'sinde Bitdefender Endpoint Security (kurumsal, istisna İSTENEMEZ) bot.js ve .vbs dosyalarını siliyordu (15:30 kapanmanın sebebi).
  .vbs ve ayrı bekçi KALDIRILDI. bot.js iki rollü: 'node bot.js' = GÖZETMEN (görünür, simge durumunda pencere 'BIST Pusula Motor', kilit 47124) → 'node bot.js --isci' alt sürecini
  çalıştırır; kapanırsa 10 sn sonra, 3 dk yanıt vermezse yeniden başlatır.
  Bitdefender ATC 'ATC.SuspiciousBehavior' PowerShell'i (iex irm + görev/betik oluşturma) engelliyor ve oluşturduğu dosyaları temizliyor → iş PC'sinde PowerShell KULLANMA.
  Kurulum/güncelleme: pc/kur.js (Chrome ile indir → Komut İstemi: node Downloads\kur.js): önce eski motoru kapatır (bot.js/motor.js), repodaki pc/bot.js'i PC'ye 'motor.js' adıyla indirir
  (PC'deki eski bot.js'i Bitdefender kilitledi: üzerine yazma EPERM → ona dokunulmaz; motor.js de yazılamazsa motor2.js), BistMotorBekci görevini ve .vbs artıklarını siler,
  Başlangıç'a 'BIST Pusula Motor.cmd' (start /min node motor.js) yazar ve başlatır; hata olursa eski motoru geri açar. ayar.json gerekir (eşleştirme yeniden gerekirse kur.ps1 sorunlu).
- v8.9 (09.10, Fatih onayıyla) DÜN GÜÇLÜ KAPANIŞ — SESSİZ KAYIT (araştırma DEVIR 6f): dgScan() 10:31–10:50 bir kez (motor ya da motor yokken ana cihaz), günlük mumlardan dgCalc:
  adr≥6 (20 gün, (tepe−dip)/önceki kapanış), dün kapanış yeri yc=(kapanış−dip)/(tepe−dip)≥0,70, 10:30 değişimi −%1…+%1, 20g ort. ciro ≥50 Mn → src 'dunguclu' (en çok 10), ±%1,5 ile ölçülür.
  Momentum sinyallerinin meta'sına yc eklendi. Bot yarışında '💪 Dün güçlü kapanış' + '🧪 Momentum + dün güçlü kapanış' (momentum & yc≥0,7). QUIET_BOTS (paper.js) Telegram yarış satırlarında gösterilmez;
  'dunguclu' karne mesajında ve sigToday'de yok (sessiz gibi). 3 Kasım değerlendirmesine dahil.
- v9.0 (09.10, Fatih: 'sinyalden sonra +%3 başarıdır, gün kapanışı baz alınmasın, stop −%1'): sig'e o31 (−%1'den önce +%3; aynı gün; 0 = sonuçsuz, sayılmaz).
  Karne mesajı, haftalık rapor, /sigstats (Karne ekranı), röntgen, filtre kontrolü, KAP tepkisi artık o31. Eski satırlar sigEnsure'de bir kez mfe/mae'den (meta 'o31fill'); ikisi birden olanlar boş → son 6 gün sigBackfill.
  Renk/çizgi: başabaş %25 (kCol ≥35 yeşil, ≥25 sarı). v9.1: TÜM Telegram sinyal mesajları (Momentum, Algı msgFire, Fırsat A) ve Canlı takip: hedef +%3, stop −%1 (sinyal fiyatından). v9.2: Fırsat B notlu AL da Telegram'a gider (v8.8'de kapatılmıştı). o10/o15 ölçülmeye DEVAM ediyor (bot yarışı ve kâğıt bot hâlâ ±%1/±%1,5 — değişmedi).
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
- v9.3 (09.10 gece, Fatih: 'stop %1'i geçmesin'): SESSİZ çıkış botları (Telegram/ekranda sinyal YOK, yalnız Karne bot yarışı): 'mom4' Momentum +%4/−%1 (sig.o41: 1 hedef, 2 stop, 0 ikisi de yok → rc) ve 'momh' Momentum hedefsiz −%1 (sig.h1 = −1 ya da gün sonu %). sigOutcome hesaplar, sigBackfill son 6 günü tamamlar. Canlı sinyal mesajları +%3/−%1 KALDI. 2–3 hafta sonra kazanan çıkış Fatih onayıyla mesajlara.
- v9.4 (10.10, Fatih onayıyla) EMİR AKIŞI KAYDI (derinlik yerine geçen bilgi; yalnız araştırma, sinyal YOK): motor (BOTMODE) qsd'deki her hacim artışını flowTick ile alıcılı/satıcılı ayırır
  (fiyat ≥ önceki satış fiyatı → alıcılı, ≤ alış fiyatı → satıcılı, arada → fiyat yönü, aynı → önceki yön). Dakika satırı [dk, alıcılı, satıcılı, belirsiz, işlem sayısı, son, alış, satış].
  flowFlush 5 dk'da bir /flow (sahip yolu, worker/src/flow.js) → D1 tablo flow (d, m, n, data = ham JSON, çözülmeden). Motor 200 hisse izler (telefon 100). 10:00 dakikası açılış seansını içerir — araştırmada at.
  Plan: 4–6 hafta biriksin → Momentum adaylarının 10:30'a kadarki alıcılı/satıcılı dengesiyle +%3/−%1 sonucu karşılaştırılır (DEVIR 6i).
- v9.5 (10.10) KAP GEÇMİŞİ TOPLAYICI (worker/src/kaph.js, yalnız araştırma): seans dışında dakikada bir — meta 'kaph_day' imleciyle her çalışmada 1 günün KAP listesi (byCriteria, geçmiş gün de çalışıyor)
  → D1 kaph (kind: is = yeni iş/sipariş, icerden = pay alım satım bildirimi, geri = şirketin geri alımı); sonra bekleyenlerin detayı /tr/api/notification/attachment-detail/{idx} (en çok 3/çalışma) düz metin txt (≤12000).
  Bitince meta 'kaph_st'. Başlatma: meta 'kaph_day'='2025-10-01'. Amaç: haber tutarı ÷ piyasa değeri ve içeriden ALIŞ/SATIŞ ayrımının fiyat etkisi (DEVIR 6j). KAP sayfaları WebFetch'te robots engelli → yalnız Worker toplar.
  Araştırma 10.10 (DEVIR 6j): SPK bedelsiz onayı (etki açılışta biter, alınamaz), halka arz (alınabilenler 20 günde −%15), endeks değişikliği (BIST100'den çıkacaklar −%4) → sinyal yok; uyarı adayları.
- v9.6 (10.10, Fatih: 'çalışanı bul, nasıl bulacağını sen bul'): Momentum Telegram mesajı artık 'Stop −%1 · hedef yok, stop gelmezse 17:55'te sat' (geçmiş 14 ay: +%3'te satmak +0,29, gün sonu +0,55/işlem, 11/14 ay artı; en çok kazandıran 5 hisse hariç +0,12; en uzun kayıp serisi 16).
  Giriş kuralı DEĞİŞMEDİ; karne yine o31 (+%3/−%1) ölçer, bot yarışında 'momh' (hedefsiz −%1) bu çıkışın canlı ölçüsü. Toast'ta hedef yok.
- v9.7 (10.10) ÖĞLE TREND GÜNÜ — SESSİZ KAYIT (keşif motoru, DEVIR 6k): ogScan() 12:00–12:15 bir kez (motor ya da motor yokken ana cihaz): S.idxCh ≥ +0,8 ise piyasa değeri ilk 120'den açılıştan ≥ +%2, değişim < +7 → en çok 3, src 'oglen' (meta ro/it/ch).
  Telegram/ekranda sinyal YOK; karne ekranı + bot yarışı 'oglen' (h1 = stop −1, hedefsiz). sigToday ve karne mesajında gösterilmez. PAPER_SRCS/QUIET_BOTS'ta.
- v9.8 (10.10): Momentum mesajı +%3/−%1'e GERİ alındı (ilk canlı hafta 05–09.10, 23 sinyal: +3/−1 +8,66 puan, hedefsiz −11,72). Hedefsiz çıkış 'momh' botunda ölçülmeye devam; canlıda 2 hafta üst üste önde olursa değişir.
  Fatih'e her Cuma 'o haftanın gerçek sinyalleri, 100.000 TL ile girseydin' tablosu verilecek.
- v9.9 (10.10, Fatih onayıyla) TEMEL ORAN NOTU: sigPost her sinyalin meta'sına sigFund(sym) ekler — pe (F/K), pb (PD/DD), mc (piyasa değeri, milyar TL), S.umap'teki TradingView tarama değerlerinden.
  Yalnız ölçüm; sinyal kuralı değişmez. Birkaç hafta sonra: ucuz/sağlam şirketlerin sinyalleri daha mı iyi (o31, h1)? Geçmiş test YAPILAMAZ (geçmiş oran yok, bugünkü oranla geçmiş test yanıltır).
- v10.0 (11.10, Fatih: 'ücretsiz olanları sırayla ekle') VERİ ZENGİNLEŞTİRME — yalnız not/ölçüm, sinyal kuralı DEĞİŞMEDİ:
  1) BORSA TEDBİRLERİ worker/src/tedbir.js: KAP'taki Borsa duyuruları → meta 'tedbir' {SEMBOL:[{k,t}]}. DİKKAT (D1'de görüldü): VBTS tedbirleri (brüt takas/tek fiyat/açığa/kredili) KAP'ta YAYINLANMIYOR;
     KAP'tan gelenler: 'Pay İşlem Sırası Kapatma / Açma' (durdur, 1 gün; 'İşleme Açılması' siler), 'Pazar Değişikliği — Yakın İzleme Pazarına Alınması' (yip, 180 gün; başka pazara alınma siler),
     Borsa'nın 'Hak Kullanımı' duyurusu (hak, 2 gün). Tür metinden (kap tipi 'diger' olabilir). VBTS için ayrı ücretsiz kaynak bulunursa eklenecek.
     Dakikalık işe ek okuma YOK (kap.js yalnız tedbir türü çıkan yeni satırda tedbirAdd); meta yoksa /tedbir bir kez kap_t indeksiyle (180 gün) kurar. Mantık değişirse meta 'tedbir'i sil (yeniden kurulur). /tedbir DATA yolu. Terminal TEDB (10 dk'da bir, motor da yükler):
     sigNotes'a 'Borsa tedbiri: …' uyarısı (Telegram sinyal mesajı, Şimdi, röntgen), sigFund meta.tb. tests/tedbir.mjs.
  3) OLAĞANDIŞI HACİM: sigFund meta.rv = göreli hacim (rvolOf). Ekranda/Telegram'da yeni yazı yok (Algı zaten gösteriyor).
  2) TEMETTÜ (v10.1): BASE'e 'ex_dividend_date_upcoming' (probe ile doğrulandı: unix saniye, yoksa null). divDays(sym) 0–3 gün → sigNotes 'Yarın temettü hak kullanımı…', meta.dv.
     Bölünme/bedelsiz için ayrı TradingView alanı DOĞRULANMADI; Borsa'nın KAP 'Hak Kullanımı' duyurusu (tedbir 'hak') bunu kapsıyor. Bilinmeyen alan taramayı bozar → doğrulamadan BASE'e alan ekleme.
- 12.10 akşam bakımı: KAP adımı 18:13'ten sonra her dakika işlemci sınırında kesildi (günün ~400 bildirimlik listesi her dakika TAM JSON ayrıştırılıyordu; kap_last sonda yazıldığı için ilerlemedi) → karne, tavan, rapor çalışmadı. kap.js kapFresh: yalnız numaralar taranır, yalnız yeni nesneler ayrıştırılır (biçim farklıysa tam ayrıştırma); kap_last eklemeden hemen sonra yazılır. index.js sigorta: meta 'kap_kill' ≥3 → KAP 5 dk'da bir denenir, arada diğer işler sürer.
- v10.2 (13.10, Fatih onayıyla) ERTESİ GÜN ÖLÇÜMÜ (yalnız ölçüm): sig'e ng (ertesi gün açılış farkı, sinyal günü kapanışına göre %), nh/nl/nc (ertesi gün tepe/dip/kapanış, sinyal fiyatına göre %),
  nt (1 tavan ≥+%9,5 / -1 taban / 0), nx (1 ölçüldü, negatif deneme). sig.js sigNextDay: karne/tamamlama işi yokken en çok 10 dk'da bir (meta 'nx_at'), sig_d indeksiyle son 6 iş günü,
  çalışmada ≤6 hisse, günlük mum 15 adet; ertesi gün mumu yoksa (tatil) bekler. tests/ertesi.mjs. 'Pusula ertesi gün takibi' araştırma görevi (hafta içi 19:22) bu sütunları okur (BORSA'ya bağlı değil).
- 13.10 akşam bakımı: 18:15'ten sonra karne hiç ölçülmedi (272 sinyal bekledi), KAP adımı 17:40'tan beri her denemede kesildi. Belirti: cron_hb '3-KAP bitti' sonrası hiçbir iz yok (sig_run 18:51'de takılı, kesilme kaydı bile yazılamadı) → iş karnenin daha başında işlemci sınırında kesiliyordu.
  v10.2 sigEnsure'e 6 ALTER daha ekledi (soğuk başlangıçta 14 başarısız ALTER + 3 sorgu; sigAdd üzerinden KAP adımı da çağırıyor). Artık meta 'sig_schema' = '10.2' ise hepsi atlanır (1 okuma). sig'e YENİ SÜTUN EKLERKEN SIG_SCHEMA'YI ARTIR.
- v10.3 (14.10, Fatih onayıyla) CAM GÖRÜNÜM (yalnız CSS, mantık yok): html.cam sınıfı (varsayılan açık; LS 'tema' = 'cam' | 'klasik'; Ayarlar → GÖRÜNÜM → Tema, temaSet()). index.html'deki son <style> bloğunun sonunda 'v10.3 CAM GÖRÜNÜM' bölümü.
  Gerçek bulanıklık (backdrop-filter) YALNIZ #top, #tabs, .nhero, .yrm, #more .sh — diğer kartlar (.nrow .nk .ncal .pp2 .xsearch .nempty .nqa) yarı saydam 'sahte cam' (iPhone pil/akıcılık). --panel opak kalır (pencereler okunur).
  Önizleme: Design canvas 'Pusula cam görünüm önizleme'. Sıradaki: Fırsat, Algı, Karne, Röntgen ekranları aynı dille (Fatih onayıyla).
- v10.4 (14.10): 06.10'dan beri Fırsat sinyallerinin karnesinde 'kurulum' (pull = geri çekilme, kvw = Keskin VWAP, vcp, poc) hep BOŞTU — sinyaller motorun otomatik taramasından (autoRun) geliyor, o yolda S.deep yok.
  deepFlags(sym,dir,a): taze S.deep varsa onu, yoksa analyze() sonucundan (a.pull, a.kvw, a.vcp, POC yakınlığı) üretir; sigRecord (meta.kurulum, sigHist.setups) ve autoRun Telegram 'Kurulum:' satırı kullanır. Sinyal kuralı/puan DEĞİŞMEDİ.
- v10.5 (14.10) CAM TÜM SEKMELER (yalnız CSS, html.cam altında; index.html v10.3 bloğunun sonunda): sekme başına renk --ta (sechd başlık çizgisi), .bar koyu şerit kalktı, seg/hap/kart/KAP/Algı/Ayarlar cam;
  Karne (.ppf/.pp2/.lab) tablolarında sabit ilk sütun yok. Şimdi: nSec simge renkleri NSEC_C (simgeye göre --sc). HATA DÜZELTMESİ (iki temada): .kaprow .ks/.kg Karne'nin .ks/.kg sınıflarıyla çakışıyordu (KAP başlığı içerde, etiket ızgara).
- 14.10 akşam bakımı: 18:24'ten sonra karne yine hiç ölçülmedi (244 sinyal bekledi), KAP her denemede kesildi — aynı çalışmadaki diğer işler işlemci payını bitiriyordu. ZAMANLAYICI ÜÇE BÖLÜNDÜ (wrangler.jsonc crons): '* * * * *' ana iş (meta cron_hb), '*/1 * * * *' KAP (meta cron_hb_kap = 'ms SS:DD adım'), '0-59 * * * *' karne + haftalık rapor (meta cron_hb_sig). Her biri ayrı 10 ms. Yardımcı 3 dk sessizse ana iş onun işini kendisi yapar. Ana işte '4-karne bitti' artık yalnız bu yedek durumda görünür. tests/worker.sh üç zamanlayıcıyı dener (--test-scheduled). Beklenmeyen ifade gelirse ana iş çalışmaz, meta cron_unknown = o ifade. DİKKAT (19:40 gözlem): yayından 30 dk sonra ek zamanlayıcılar HİÇ tetiklenmedi (cron_hb_kap/sig/unknown yok; Workers Builds tetikleyicileri uygulamamış olabilir ya da hesap sınırı) → şu an ana iş yedek yoldan hepsini yapıyor. Yeniden yayından sonra karne normal ölçtü (sorun uzun yaşayan çalışma ortamında birikiyor olabilir). Cloudflare panelinde Triggers bölümüne bakılmalı.
- v10.6 (14.10 gece, Fatih onayıyla): (1) sig'e o315 = +%3 hedef / −%1,5 stop yarışı (yalnız ölçüm; SIG_SCHEMA 10.6; sigBackfill son 6 günü doldurur) → bot yarışında sessiz '🧪 Momentum · +%3/−%1,5' (mom315, QUIET_BOTS).
  (2) Cuma haftalık raporuna 'Momentum — hangi çıkış kazandırdı?' bloğu (sig.js momExits: −1 / −1,5 / ±1,5 / hedefsiz, her sinyale 100.000 TL, kayma hariç). Telegram sinyal mesajları DEĞİŞMEDİ.
  (3) Zamanlayıcılar '*/1' ve '0-59' hiç tetiklenmemişti ('* * * * *' ile aynı zamanlama) → KAP '*/2 * * * *' (çift dakika), karne '1-59/2 * * * *' (tek dakika). 21:03 yayınından 7 dk sonra da cron_hb_kap/sig/unknown YOK → sebep aynı zamanlama değilmiş; ek zamanlayıcılar Cloudflare'de hiç kurulmamış görünüyor (bist worker'ında cron yok, hesap sınırı 5 dolmuyor). Fatih'ten panel → bist-tv → Ayarlar → Tetikleyiciler (Cron) ekran görüntüsü istendi; elle eklenebilir. O zamana kadar ana iş yedek yolla hepsini yapıyor.
  (3) Zamanlayıcılar '*/1' ve '0-59' hiç tetiklenmemişti ('* * * * *' ile aynı zamanlama) → KAP '*/2 * * * *' (çift dakika), karne '1-59/2 * * * *' (tek dakika). Yayından sonra meta cron_hb_kap / cron_hb_sig yazılıyor mu bak; yazılmıyorsa ana iş yedek yolla devam eder.
- v10.7 (14.10, Fatih: 'Telegram mesajları daha akıcı ve modern') TELEGRAM KART DÜZENİ (yalnız görünüş; hangi mesaj gider, hedef/stop DEĞİŞMEDİ): terminal tgCard/tgKb/tgPct/tgPlain/tgPost (index.html tgSend yanında),
  sunucu worker/src/tgfmt.js (tgKb, tgPlain, tgPct, tgQuote). Başlık '🟢 AL · SEMBOL   <i>kaynak</i>', fiyat kutusu <blockquote> + <code> rakam (dokununca kopyalanır), düz Türkçe nedenler (RVOL/4S/POC yerine cümle),
  ayrıntı <blockquote expandable>, altta düğmeler (📈 Grafik = TradingView, 📄 KAP'ta oku). KAP mesajında uzun bağlantı yok. Karne/haftalık: tgQuote '   ' ile başlayan alt satırları alıntı kutusuna çevirir.
  tgSend(cfg, text, kb): Telegram biçimi reddederse ('parse/entit/tag/button') düz metin bir kez daha gider. Telegram'da yazı tipi değiştirilemez (istemci belirler).
- v10.8 (14.10, Fatih: karne raporunun başına kısa piyasa özeti — ayrı mesaj DEĞİL): tavan.js mktClose (ana iş, hafta içi 18:12–21:00 bir kez, 3 tarama: BIST:XU100/XU030/XBANK + değişime göre ilk/son 60 hisseden ≥100 Mn TL işlem görenlerin 3'er en iyisi/kötüsü + totalCount ile yükselen/düşen sayısı)
  → meta 'mkt_close' {d, idx, up, dn, nu, nd}. sigSummary en üstte tgfmt.js mktBlock (🧭 Piyasa, alıntı kutusunda). Yalnız bilinen tarama alanları (name, close, change, high, low, volume). Endeks verisi gelmezse dakikada bir yeniden dener.
- v10.9 (15.10, Fatih: 'ateşleme sinyali hiç Telegram'a gelmiyor'): Algı Telegram'ı kendi Chat ID'sine (AL.cfg.chat, Algı → Ayar) bakıyordu; motora eşleştirmede telefonun algiCfg'si kopyalandığı için boş geldi → güçlü ateşlemeler (15.10'da 34 tane) hiç gitmedi, hata da yazılmadı.
  Artık alChat() = AL.cfg.chat || S.tgChat (genel Telegram sohbeti). Algı Telegram reddi errLog('Algı Telegram') ile deftere yazılır.
  v10.9 ek (Fatih onayı: 'sıkılaştır, 30 fazla'): Algı Telegram'ı artık güçlü (fc≥0,8) VE rv≥2 (hacim normalin 2 katı) — karnede 29.09–14.10: güçlü %12,6 (günde ~24) → güçlü+rv≥2 %24,1 (günde ~4, örnek 37, az).
  Takip mesajları (hareket geldi/hedef/stop/sönüyor) yalnız Telegram'a giden ateşlemelerde (e.tg). Karneye yazma DEĞİŞMEDİ (bütün ateşlemeler).
- 15.10 akşam bakımı: hata yok (yalnız 2 geçici KAP ağ kopması → gürültü). Ek zamanlayıcılar ARTIK ÇALIŞIYOR: meta cron_hb_kap ve cron_hb_sig dakika dakika yazılıyor (18:52/18:53), ana iş '5-tamam'.
- v11.0 (15.10 gece, Fatih onayıyla) D1 OKUMA TASARRUFU (mantık değişmedi): sigBackfill iş bulamazsa meta 'bf_idle' yazar ve 15 dk atlar (eskiden seans dışında her dakika ~1.200 satır).
  /paper (paperCalc fresh değilse) meta 'paper_v', /sigstats meta 'stat_v' — 10 dk ORTAK önbellek (tüm çalışma örnekleri); fresh hesap (karne mesajı, paper-set) meta'yı tazeler. Sorun olursa bu meta satırlarını silmek yeter.
- v11.1 (16.10 gece, Fatih onayıyla: 'daha profesyonel, hangi sinyal önde') PUSULA KİMLİĞİ (yalnız görünüm, sinyal kuralı DEĞİŞMEDİ; yalnız cam temada):
  Renkler gece laciverti #0E1626, pirinç #C9A35B/#E6C98A, yeşil #5FD39A, mercan #F07A6A; yazı Barlow + Barlow Condensed (Google Fonts, engelliyse sistem yazısı).
  Ana sayfa (renderNow): nDial() = başlık (Canlı/Motor ışıkları) + arama + pusula kadranı (ibre = XU100 günlük %, ±%3'te tam sapma; dış pirinç yay = seans 10:00→18:00) + hüküm cümlesi + yükselen/düşen + VİOP/Banka/Dolar/Altın şeridi;
  nLig() = 'Hangi sinyal önde?' (KSTAT.src son 10 iş günü, o31 isabeti, en az 10 sonuçlanan; PUS_AD'de olmayan sessiz kaynaklar gösterilmez; pirinç çizgi = başabaş %25). Klasik temada eski nHero.
  Alt menü: Grafik yerine Karne (data-t lab); Grafik menüde PİYASA grubunda.
  v11.2 (16.10 gece, Fatih: 'pusula çok büyük, küçült ve güzelleştir'): nDial yeniden — 148 px pusula (pirinç bilezik + 72 çentik + silik pusula gülü + iki renkli ibre; bilezik üstündeki yeşil yay = yükselen hisselerin payı) solda,
  sağında BIST 100 değeri/değişimi + hüküm cümlesi; altında yükselen/düşen, ince seans çubuğu (10:00→18:00), nowSessLine (seans + motor satırı; UI testi bunu arar) ve VİOP/Banka/Dolar/Altın şeridi — hepsi tek kart (.pcard).
  v11.3 (16.10 gece, Fatih: 'altta beyaz kalıyor, arama belirgin olsun, tam pusula hizmeti'): iPhone'da alt menünün altındaki beyaz şerit — html.cam arka planı #0E1626, #app alt boşluğu 0, #tabs alt boşluğu safe-area kadar (background-attachment:scroll).
  Arama kutusu pirinç 1,5 px çerçeveli. nRota() 'Bugünün rotası' kartı (pusula kartının altında): Piyasa (rejim + endeks → temkinli/dikkatli/açık rota), Saat (seans evresine göre ne yapmalı), Sinyal (karnede önde olan + kaybettirenler), Takvim (20 saat içindeki önemli veri), Pozisyon (açık işlem sayısı). Yalnız öneri metni, sinyal kuralı yok.
- v11.4 (16.10 gece, Fatih: 'hepsini yap, ana sayfa kompakt olsun, ekranı kirletme') AKILLI + SADE PUSULA:
  SİNYAL DEĞİŞİKLİKLERİ (Fatih onayı, DEVIR 6n): (1) kap.js: SEANS İÇİNDE (10:00–17:30) yayınlanan şirket geri alımı → Telegram AL kartı (hedef +%3/stop −%1); hissenin o günkü ilk bildirimi, son 7 günün 3 gününde bildiren ve tabandaki (≤ −%9) hariç; meta 'geri_seen'.
  (2) tavan.js tavanOpen: hafta içi 10:01–10:20 bir kez — dün tavan kapananlardan (meta 'tavan_list', tavanScan yazar) açılışı %6 altı olanlar Telegram'a + karneye src 'tavan6' (px = mesaj anı fiyatı); tatil günü (tarama dünkü tavan değerini verir) mesaj yok; meta 'tavan_open'.
  (3) Fırsat otomatik taraması: endeks ekside iken B notu Telegram'a gitmez (karneye yazılır). Algı kuralı 3 Kasım'a kadar aynı.
  /sigstats artık up/dn (sinyal anında endeks artı/eksi) ve r0 (sonuçsuzların gün sonu toplamı) verir; işlem başı ort. = (3·h − s + r0)/n.
  ANA SAYFA (yalnız cam; renderNowCam): kadranın ibresi = YÖN PUANI pusYon (endeks, yükselen/düşen, ortanca hisse, VİOP, banka, trend; −100…+100) + ayrışma uyarısı;
  'Pusula diyor ki' nAkil (günlük fren: bugün 2 zararlı işlem → 'Bugün dur'; hava; endeksin bugünkü yönündeki günlerde kazandıran/kaybettiren kaynak; saat; 6 sa içindeki veri; kişisel ders ≥8 işlem);
  açık pozisyonlar, canlı takip (3 kart + 'Tümünü göster'; her kartta 'bu havada %X hedef' notu) ya da 'Yarın ilk bakılacaklar' çipleri; nGuven 'Bugünkü gibi günlerde'; geri kalan her şey katlanır satır (nFold, LS 'nowf', kapalı başlar, içerik yalnız açılınca çizilir).
  Testlerde katlı bölüm gerekiyorsa NOWF.f_<ad>=1 yap. Klasik temada eski düzen aynen.
- v11.5 (16.10 gece, Fatih: 'büyükler habere önem veriyor, ne kaçırıyoruz?' → hız yarışına girmiyoruz, haberin ANLAMINI ölçüyoruz; yalnız ölçüm + bilgi, sinyal kuralı DEĞİŞMEDİ):
  sig'e p30 (sinyalden önceki 30 dk'daki hareket %, 10:30 öncesi günün açılışından; sigOutcome) ve hb (önceki iş günü 18:00'den beri son KAP haberine dakika, önem ≥1, devre hariç; −1 = habersiz). SIG_SCHEMA 11.5.
  sig.js sigNews: karne/tamamlama/ertesi gün işi yokken 10 dk'da bir, her seferinde bir gün (meta hb_day/hb_at; 29.09'dan geriye dönük doldurur). p30 yalnız yeni ölçülenlerde.
  KAP Telegram'ı: olumlu haber geldiğinde hisse bugün zaten ≥ %3 artıdaysa '⚠️ Haber gelmeden hisse bugün zaten +%X yükselmişti' satırı. Canlı takip kartında son 16 saatin önemli KAP'ı (kapNote).
  ~1 hafta sonra: haberli/habersiz ve p30 (önceden koşmuş/sakin) kırılımında karne → anlamlıysa 'habersiz sert hareket' uyarısı ya da filtre (Fatih onayıyla). Sıradaki araştırma: KAP 'yeni iş' tutarı ÷ piyasa değeri (kaph metinleri).
- 16.10 02:47 GÖZLEM: D1 günlük okuma sınırı DOLUYDU (UTC 15.10 günü; 03:00'te sıfırlandı, sonra her şey normal). err defterine yazılamadığı için iz yok. v11.4/11.5'in yeni sorguları küçük (sigNews günde ~14 × ~1.000 satır, tavanOpen/geri_seen yalnız meta).
  Şüpheli büyük okuyucu: /sigstats yeniden hesabı ~6.300 satır (10 dk önbellek → en kötü günde ~0,9M) ve gün içi araştırma/ajan sorguları. Ajan denetimi: Cloudflare panelinde D1 → Metrics'ten saat saat okuma grafiğine bakılmalı.
- 16.10 sabah TEMİZLİK (Fatih: 'gereksiz şeyleri sil'): repodan eski şablon dosyaları silindi (src/, styles/, test/, server.js, backup-restore-v2.js, jest/vite/prettier ayarları, kök package.json, PROFESSIONAL_ROADMAP.md, .env) — hiçbiri kullanılmıyordu; README yeniden yazıldı.
  index.html: kullanılmayan nRota/nLig ve eski büyük kadranın CSS'i silindi (v11.6). D1: kullanılmayan `bt` ve `mlpack` tabloları silindi. `bars` (araştırma mum arşivi, ~50 MB), `feat`, `kaph`, `flow`, `ertesi` KORUNDU.
- v11.7 (16.10 sabah, Fatih: 'Pusula Telegram mini uygulaması') — BotFather /newapp: t.me/FatihBistSinyal2026Bot/pusula (bot = sinyal grubuna mesaj atan bot; Web App URL = GitHub Pages adresi).
  Sunucu worker/src/tgapp.js: /tgauth (ANAHTARSIZ, POST {d: initData}) Telegram imzasını cfg.tgTok ile doğrular (HMAC 'WebAppData', 24 saat), getChatMember(cfg.chat): grup KURUCUSU → 'PUSULA|wss://<host>/<ACCESS_KEY>|<owner>' (sahip), üye/yönetici → sahip kodu olmadan (misafir + cihaz onayı), diğerleri 403.
  Terminal: <head>'de telegram-web-app.js YALNIZ adres '#tgWebAppData=' içerirse yüklenir. TGA bloğu: expand, disableVerticalSwipes, lacivert üst/alt renk, BackButton (röntgen kapat / ana sayfa), start_param → xrayOpen(SEMBOL).
  İlk açılışta tvproxy yoksa tgaAuth (api.altinerpano.com/tgauth) → sahipse /prefs sessiz geri yükleme (restore(true)) → yeniden yükleme. Telegram'ın hafızası ayrı (LS boş başlar).
  Telegram düğmeleri (terminal tgKb + worker tgfmt.js tgKb): ilk satır '🧭 Pusula'da aç' (…/pusula?startapp=SEMBOL), altında KAP / Grafik; tavan sakin açılış listesinde de var. Grupta direkt bağlantı (web_app düğmesi yalnız özel sohbette çalışır). tests/tgapp.mjs.
  v11.8 (16.10 08:30): ilk denemede sahip girişi oldu ama cihaz 'onay bekliyor' kaldı (onay yalnız ?own= taşıyan istekte veriliyor) → tgaAuth devId gönderir, /tgauth kurucuda devApprove (dev.ok=1). İlk cihaz D1'de elle onaylandı.
- v11.9 (16.10, Fatih: 'insanlar ayarları görmesin'): MİSAFİRDE (isGuest) AYARLAR TAMAMEN GİZLİ — html.noset: menüde/alt menüde 'set' yok, showTab('set') → 'now' (sunucu adresi/anahtar görünmesin). Sahip yeni cihazda kod girecekse adrese ?ayar=1 ekler (guestHideSet).
- v11.10 (16.10): meta 'announce' artık JSON da olabilir: {"t": HTML metin, "kb": inline_keyboard nesnesi, "pin": 1} → düğmeli duyuru + bot yetkiliyse gruba sabitleme (sonuç meta announce_res). Düz metin eskisi gibi çalışır.
- 16.10 ANA SUNUCU: iş bilgisayarı yerine EV bilgisayarı (motor5953a6e76e704aa9, adı 'Ana sunucu'); eski iş PC motoru (motor1b9f6cebc0f14784) D1'de blocked=1. Ev PC'de Windows görevleri: 'Pusula Ana Sunucu - Uyandir' (hafta içi 09:15, WakeToRun) ve '- Uyut' (19:00, uyku), hibernate kapalı.
  Ev ağında Playwright tarayıcı indirmesi SSL/zaman aşımı verdi → bot.js artık sırayla BIST_CHROME / channel 'chrome' / 'msedge' dener; kur.ps1 indirme olmazsa BIST_CHROME'u bilgisayardaki Chrome/Edge'e ayarlar.
  Worker devTouch: motorun eski adı 'İş bilgisayarı (motor)' gelirse 'Ana sunucu' yazılır. Ekrandaki/Telegram'daki 'İş bilgisayarı' yazıları 'Ana sunucu' oldu.
- v12.0 (16.10, Fatih: 'Telegram'dan giren herkes üye olsun, amaç üye toplamak — Ücretsiz Derinlik botu gibi büyüyüp reklam almak') ÜYE SÜRÜMÜ:
  /tgauth: grup kurucusu = sahip; DİĞER HERKES = üye → D1 tablo 'uye' (id=Telegram kullanıcı no, ad, kadi, grup, first, last, n) + cihaz dev.ok = 2 (zaten 1/engelliyse dokunulmaz).
  dev.ok=2 ('uye'): DATA yolları açık ama bars/scan/tv-scan ve canlı akış (direct=1) SAHİBİN TradingView OTURUMU OLMADAN (Cookie yok, unauthorized_user_token) → TradingView 15 dk gecikmeli veri. tv-token üyeye {uye:1} döner.
  NEDEN: sahibin kişisel TradingView Pro oturumunu çok kişiye dağıtmak hesabın kapatılması + Borsa verisi lisans riski. Üye büyürse sonraki adım lisanslı veri (İdealData gibi, dağıtım izinli) + Workers Paid.
  Sahip: Ayarlar → bağlı cihazlar'da üye sayısı (/uyeler, OWN) ve üye cihazı 'Canlı veriye yükselt' (dev-ok → ok=1). Terminal: S.uye/TVL.uye → ana sayfada 'Üye sürümü · fiyatlar 15 dk gecikmeli', sigToast üyede kapalı.
  Telegram'da: onay bekleyen eski cihaz açılınca bir kez yeniden tgauth (sessionStorage tga_re) → üye. Telefonda tam ekran (requestFullscreen, html.tgfs → #top üst boşluk = Telegram güvenli alanı).
  YASAL UYARI Fatih'e söylendi: herkese açık AL/hedef/stop + reklam/ücret → SPK yatırım danışmanlığı riski; avukata danışması önerildi. Sıradaki (2. aşama, Fatih onayıyla): herkese açık kanal + günlük özet.
- v12.1 (16.10 gece, Fatih onayıyla, DEVIR 6o): (1) MOMENTUM TEKRAR UYARISI — momScan her aday için /sigsym'e bakar (momRepOf/momRepPick); son 6 takvim gününde de Momentum verdiyse Telegram kartına '⚠️ Tekrar' satırı, sig meta.tk=1. Kural DEĞİŞMEDİ.
  Karne mesajında Momentum altında 'tekrar eden hisse / tekrarsız' satırı (sig.js momRep/momRepLine, sig_d ile günde bir ~4k satır). (2) tavanPick: mesaj anındaki fiyat da dünkü kapanışın %6'dan fazla üstündeyse listeye alınmaz (TMPOL vakası).
  (3) İŞLEM GÖRMEYEN KODLAR: karne ölçümü TradingView 'resolve error' görünce kodu meta 'sym_bad' {KOD: gün}'e yazar (30 gün, symBadAdd); kap.js haberin hisse listesinden bunları çıkarır (OMD, BNPPI, IYM… karneye/geri alım kartına gitmez). Yanlış işaretlenen olursa meta 'sym_bad'dan o kodu sil.

- v12.2 (16.10 gece, Fatih onayıyla 'B'): ÜYE GÖRÜNÜMÜ — üyede (isUye = S.uye||TVL.uye, html.uye) canlı AL/hedef/stop YOK: Fırsat, Algı, Özet sekmeleri gizli ve showTab'da 'now'a döner; Şimdi'de canlı takip yerine 'Bugün güçlü gidenler' (watchTomorrow, 'sinyal değil'); röntgende giriş/stop/hedef yok (destek/direnç kalır).
  Sunucu: /sigtoday üyeye boş liste. Karne (geçmiş), KAP, piyasa, röntgen notu açık. Amaç: herkese açık uygulamada SPK yatırım danışmanlığı riskini azaltmak; canlı sinyal kapalı grupta kalır.
  BOT KARŞILAMA worker/src/tgbot.js: POST /tgbot (anahtarsız; Telegram 'X-Telegram-Bot-Api-Secret-Token' = sha256('pusula-hook|'+bot anahtarı) ilk 48 hane). Yalnız özel sohbet: her mesaj/Başlat → hoş geldin + '🧭 Pusula'yı aç' web_app düğmesi (kişi başı 20 sn'de bir). Gruba yanıt yok.
  Webhook'u ana iş kurar (tgHookEnsure, meta 'tghook'='1', sonuç 'tghook_res'); yeniden kurmak için meta 'tghook'u sil. DİKKAT: webhook varken getUpdates çalışmaz. tests/tgbot.mjs.
- v12.3 (17.10 gece): Telegram tam ekranda üst boşluk iki kez sayılıyordu (#app env(safe-area) + #top Telegram güvenli alanı) → html.tgfs #app padding-top 0, sigtoast Telegram alanına göre. refreshTick: genel taramada BIST endeksleri (XU100/XU030/XBANK/XUSIN) eksik ya da boşsa 'turkey' taramasından tamamlanır (Telegram'da BIST 100 '–' görünüyordu). 'Yarın ilk bakılacaklar' Cuma akşamı/hafta sonu 'Pazartesi'.
  BotFather (Fatih yaptı): bot adı 'BIST Pusula', açıklama + hakkında yazısı, profil resmi = icon-512.png, Main Mini App açık (Fullsize, açılış ekranı lacivert #0E1626 + tek path pusula SVG).
- v12.4 (17.10 gece, Fatih: 'grubu büyütmek senin görevin') BÜYÜME: (1) HERKESE AÇIK KANAL worker/src/kanal.js — Fatih kanalı açıp botu yönetici yapınca webhook 'my_chat_member' → meta 'pubch' {id,title,user} + sabitlenmiş tanıtım mesajı (sonuç 'pubch_res'); botu çıkarınca silinir.
  Hafta içi kanalAm 09:35–10:00 (meta 'pub_am'): akşamdan beri önem≥2 KAP (kap_t indeksi, en çok 8) + bugünün önemli verileri (meta 'ecal'). kanalPm 18:30–21:00 (meta 'pub_pm'): mktBlock + günün karnesi toplamı (yalnız algi/firsat-A/B/momentum/tavan6, sig_d indeksi; meta 'sigsum' bugün olunca, en geç 20:30 karnesiz) + abone sayısı meta 'pub_hist' (60 gün).
  Kanalda canlı AL/hedef/stop YOK (SPK). Düğme startapp=k_am/k_pm/k_giris. Webhook TGHOOK_V '2' (allowed_updates + my_chat_member).
  (2) DAVET: Şimdi'nin altında 'Arkadaşını davet et' (yalnız Telegram içinde; tgUid/tgInvite) → t.me/share ile …/pusula?startapp=r_<Telegram no>. /tgauth start_param r_/k_ → uye.ref (yalnız ilk kayıtta; kendini davet sayılmaz). Hisse bağlantısı (startapp=SEMBOL) ref değildir. tests/kanal.mjs.
  Kanal: t.me/bistpusulatr (BIST Pusula). TEK SEFERLİK PAYLAŞIM: meta 'pub_once' = {"t": HTML, "tag": etiket} → ana iş kanala düğmeli gönderir, başarıda siler (sonuç 'pub_once_res').
  (3) Haftalık büyüme raporu = zamanlanmış görev 'Pusula büyüme raporu' (Pazar akşamı; D1 uye + pub_hist okur, Fatih'e bildirim + öneri; koda dokunmaz).
- v12.5 (17.10 gece, Fatih onayıyla) KANAL İÇERİĞİ: (1) SEANS İÇİ ÖNEMLİ KAP — kap.js kapPoll sonucu 'pub' = taze (≤15 dk), önem 3, ilk sembolü BIST 100'de (meta 'xu100'), hafta içi 10:00–18:00, geri/içeriden/devre hariç → kanal.js kanalKap: çalışma başına 1, günde en çok 3 (meta 'pub_kap' {d,n}), yönlü haber önce; 'Son dakika KAP' metni (AL/hedef/stop YOK), düğme k_kap.
  (2) PAZAR 'HAFTAYA BAKIŞ' kanalWeek (Pazar 19:55–21:00, meta 'pub_wk'): XU100 günlük mumlarından haftalık değişim (fetchBarsTV 1D 12), Cuma özeti (mkt_close), son 6 günün önem 3 KAP'ı (is/ihale/bedelsiz/temettu/birlesme/teklif/risk/ceza, en çok 6), gelecek haftanın önemli verileri (meta 'ecal'). Düğme k_hafta.
  Fatih'e önerildi (kendisi yapacak): kanal açıklamasına 'Uygulama: @FatihBistSinyal2026Bot', tepkiler açık, yorumlar kapalı.
  NOT: v12.4a (tgbot.js my_chat_member iz kaydı → meta 'tg_mcm') Fatih aracı durdurduğu hâlde yayına çıkmıştı; zararsız teşhis kaydı, yerinde bırakıldı.
- v12.6 (17.10 gece, Fatih onayıyla) YENİ ARANABİLİR BOT: uygulama @BistPusulaBot'a taşındı (ana mini uygulama; bağlantı t.me/BistPusulaBot?startapp=… — tgapp.js TG_APP/tgAppLink, index.html TG_APP). Anahtarı Cloudflare SECRET 'TG_APP_TOKEN' (repoda/D1'de yok).
  Eski @FatihBistSinyal2026Bot (cfg.tgTok) sinyal grubunda kalır; grup sahibi tespiti (getChatMember) eski botla. /tgauth iki anahtarı da dener (eski bağlantılar çalışır). /tgbot iki botun imza başlığını tanır, hangi bottan geldiyse onunla yanıtlar.
  Yeni botun webhook'u hookAppEnsure (meta 'tghook_app'='1', sonuç 'tghook_app_res'). Kanal kaydı pubch.via ('app' | eski) → kanal mesajları o botla; kanalı yöneten olmayan botun çıkarılması kaydı silmez. tests/kanal.mjs.
- v12.7 (17.10, Fatih: 'ücretsiz diye belirtelim'): bot hoş geldin mesajı 'tamamen ücretsiz · Ücret yok, kayıt yok'. BotFather adı/açıklaması Fatih tarafından 'Ücretsiz' kelimesiyle güncelleniyor (aramada çıksın).
- v12.8 (17.10, Nihat'ın önerisi, Fatih onayıyla) ARAŞTIRMA VERİ PAKETİ: Karne → Laboratuvar'ın altında (renderLab sarmalayıcı, vpHtml/vpRun, YALNIZ SAHİP — üye/misafirde yok, veri lisansı). Grup: piyasa değeri en büyük 30/100 (S.uni market_cap_basic), izleme listesi, elle; tf 15/60/240/1D; mum 1.000–10.000.
  Worker /bars'tan 2'şer (10.000'de 1'er) toplar, XU100/XU030/XBANK/XUSIN ekler → JSON {paket, olusturma, tf, aralik, bicim, gelmeyen, hisseler:{SYM:[[t,o,h,l,c,v]…]}} navigator.share ya da indirme. 40 MB üstü engellenir. Claude'a yüklenince yeni fikirler güncel veriyle test edilir.
- v12.9 (17.10 gece, Fatih: 'botu sen tanıtacaksın') YAYILMA DÜĞMELERİ (yalnız Telegram düğmeleri; sinyal/mesaj metni DEĞİŞMEDİ): kanal.js kanalKb(tag, user) — kanal kullanıcı adı varsa her kanal mesajında ikinci satır '📣 Arkadaşına gönder' (t.me/share → t.me/<kanal>, SHARE_TXT).
  tgbot.js welcomeKb(uid, chUser): karşılamada '👥 Arkadaşını davet et' (t.me/share → …?startapp=r_<kişinin no> → uye.ref) + kanal kayıtlıysa '📢 Kanala katıl' (özel mesajda meta 'pubch' PK okuması). 'Pusula büyüme raporu' görevi davetleri (uye.ref r_ / k_) sayar.
- v12.10 (18.10, Fatih: 'bağlantıları sen ekle') ADLI KANAL DAVET BAĞLANTILARI (kanal.js kanalLinks/kanalJoin): D1 meta 'pub_links_req' = JSON ad listesi → ana iş kanalı yöneten botla createChatInviteLink (ad ≤32, en çok 10) → meta 'pub_links' {ad: url}, sonuç 'pub_links_res' (istek önce silinir).
  Yeni botun webhook'u artık 'chat_member' da alır (TGHOOK_APP_V '2'; meta tghook_app) → kanala katılan kayıtlı kanalda sayılır: meta 'pub_join' {bağlantı adı | 'Doğrudan / kanal adı': sayı}. Büyüme raporu bunu okur. Bot kanalda 'kullanıcı davet etme' yetkisi ister.
- v13.0 (20.10, Fatih: aracı kurum uygulamasındaki fikirler, 'hepsini yap') YALNIZ BİLGİ/GÖRÜNÜM, sinyal kuralı DEĞİŞMEDİ:
  (1) FİYAT ARALIĞI (rngCalc/rngRow): Günlük/Aylık/Yıllık en düşük–en yüksek çubuğu + fiyatın yeri + hacim ağırlıklı ortalama — röntgende (xrayRange; günlük ortalama = röntgenin 15 dk mumlarından dayVw), ana sayfada BIST 100 kartının altında kompakt (nIdxRng, Gün + Yıl).
  (2) DÖNEM GETİRİSİ (retGrid): 7 gün / 30 gün / 3 ay / 6 ay / 52 hafta / bu yıl — günlük mumlardan (dbarGet: getBars 1D 300 mum, 30 dk önbellek; XU100 seansta 10 dk). TradingView'a yeni tarama alanı EKLENMEDİ.
  (3) FİYAT VURGUSU pxFl(anahtar, fiyat) (erken tanımlı, cls'nin yanında): fiyat değişince 1,2 sn yeşil/kırmızı parlama — BIST 100 rakamı, röntgen fiyatı, İzleme tablosu.
  (4) KEŞFET sekmesi (t-kesif, renderKesif; menüde PİYASA grubunun başında, ÜYEDE alt çubukta): Yükselenler/Düşenler/Hacimliler + 12 hazır liste (Golden/Death Cross, yeni iş ilişkisi + tutar/piyasa değeri, geri alım, güçlü trend, 52 hafta zirve/dip, olağandışı hacim, dün tavan, temettü 14 gün, bilanço 7 gün, Borsa tedbiri). Sinyal değil; hisseye dokununca röntgen.
     Golden/Death Cross: piyasa değeri en büyük 100 hissenin günlük mumları cihazda taranır (kesCross, 16'şar), günde bir, LS 'kcross'. Sunucu worker/src/kesif.js /kesif (DATA): kaph 'is' detay metninden tutar (kesAmount: TL/USD/EUR, Türkçe+İngilizce yazım; gerçek 77 haberin 53'ünde buldu),
     bugünkü yeni işler + 7 günlük geri alım kap_t indeksiyle, meta 'tavan_list'; ortak önbellek meta 'kesif_v' 30 dk (dakikalık işe sorgu YOK). Döviz tutarı terminalde günün kuruyla TL'ye çevrilir. tests/kesif.mjs, ui.js'te 10 yeni kontrol.
- v13.1 (20.10, Fatih: 'Matrix IQ uygulaması görselleri gibi yap, grafik açılınca da') MATRIX GÖRÜNÜMÜ — yeni VARSAYILAN tema (Ayarlar → Tema: Matrix | Cam | Klasik). html.cam.mx: siyah zemin, turuncu vurgu #FF6A00, düz koyu gri kutular #1C1C1E, sistem yazısı (SF), alt çubukta seçili turuncu, sekme hapları turuncu dolu.
  Renkler artık değişkende: cam paletindeki sabit renkler → var(--pir) / var(--pir2) / rgb(var(--pirc) / a) / var(--bgk) / var(--sis), Barlow → var(--fnt)/var(--fntc). Matrix bunları html.mx'te ezer; index.html sonundaki 'v13.1 MATRIX GÖRÜNÜMÜ' bloğu.
  Geçiş: LS temaV<131 ise klasik olmayan herkes bir kez 'matrix'e geçer. Grafik: chartCols()/chartTheme() (siyah zemin, #4CC35A/#EF5350 mum), temaSet çağırır. Telegram üst/alt rengi Matrix'te #000.
  Röntgen: xrayInfo 'Piyasa ve işlem bilgileri' tablosu (Son, Fark, % Fark, işlem hacmi/adedi, açılış, önceki kapanış, tavan/taban, piyasa değeri, F/K, PD/DD, temettü verimi — tarama verisi). SVG özniteliğinde var() ÇALIŞMAZ → renkli SVG'de style="fill:…" kullan.
- v13.2 (20.10, Fatih: Matriks Mobil IQ'yu incele, 'en faydalı olanları yap') YALNIZ BİLGİ, sinyal kuralı DEĞİŞMEDİ:
  (1) Röntgende PİVOT (pivotOf/pivotHtml, klasik P, Direnç 1-3, Destek 1-3; seans içinde dünkü mum, 18:00 sonrası bugünkü mum 'yarın için'), fiyatın yeri satır olarak.
  (2) MUM FORMASYONLARI (patAt/patOf, günlük mum; trend = son 5 gün ±%3): çekiç, ters çekiç, asılı adam, kayan yıldız, yutan boğa/ayı, delen mum, kara bulut, sabah/akşam yıldızı, üç beyaz asker/üç kara karga, doji (PAT_AC düz Türkçe açıklama). Röntgende son 5 gün; Keşfet 'patu'/'patd' = kesCross taramasında son mum (LS kcross artık pu/pd taşır).
  (3) KENDİ TARAYICIN Keşfet 'tar' (TAR_F alanları tarama verisinden, TAR_P 4 hazır şablon, LS 'ktar' kayıtlı taramalar en çok 12, 'ktarc' son koşullar).
  (4) Bilanço takvimi 30 gün, gün başlıklı (kesItems satırında grp). (5) Sermaye artırımı listesi: /kesif 'sa' (bedelsiz/bedelli/tahsisli, 30 gün, ayrı 6 saatlik önbellek meta 'kesif_sa', kap_t indeksi).
  Yapılamayanlar (Fatih'e söylendi): emir/hızlı al-sat, derinlik/kademe/aracı kurum dağılımı/takas (veri yok), sesli komut, sosyal medya.

# DEVİR TESLİM — BIST Terminal · PRO (son güncelleme 29.09.2026 akşamı)

> Yeni sohbetteki Claude için: CLAUDE.md kısa kurallar, BU DOSYA ayrıntılı geçmiş ve "nasıl yapılır".
> İkisini de baştan sona oku. Emin olmadığın bir kararı Fatih'e sormadan değiştirme.

## 1. Fatih ile çalışma
- Türkçe, sade, adım adım. Simge/kısaltma yerine düz cümle. Tablolar ve bot mesajları okunur olmalı, gereksiz sayı olmamalı.
- Önce kısa plan → onay → uygula → TEST ET → yayınla → kısa rapor (ne değişti, yayınlandı mı, test sonucu).
- iPhone'dan çalışır; ekran görüntüsü atar. Kod istenirse tek parça.
- Komisyon ödemiyor (hesaplarda yalnız ~%0,05 kayma).
- Dürüstlük önemli: sonuç kötüyse açıkça söyle; "başarılı görünüyor" diye süsleme. Kesin olmayanı kesin gibi sunma.
- Hafta içi 09:55–18:15 PUSH YOK (her push Worker'ı yeniden yayınlar → herkesin canlı bağlantısı kopar).
  Acil değilse commit'i ayrı dala it (ör. `bekleyen-xxx`), 18:20'den sonra main'e al. Fatih "yayınla" derse seans içinde de yayınla ama
  "bir kez kopma olacak" diye önceden söyle.

## 2. Sistem haritası
- Terminal: `index.html` (GitHub Pages, PWA). Sürüm `APP_VER` (şu an 6.5). Fatih'in cihazı "Fatih Ana Cihaz" = ana cihaz.
- Sunucu: Cloudflare Worker `bist-tv` (`worker/src/index.js` + `sig.js` + `kap.js` + `rise.js`). GitHub main'e push → otomatik yayın (~2–4 dk).
- Veritabanı: D1 `bist_bt` (id f45bd262-2d5b-4f62-94b5-36c30651b709) — Cloudflare MCP `d1_database_query` ile doğrudan sorgulanır.
  Tablolar: `meta` (k,v), `dev` (cihazlar + diag), `sig` (sinyal karnesi), `kap` (KAP bildirimleri), `feat` (araştırma verisi), `bars` (mum önbelleği — DOKUNMA, çok büyük; araştırma verisi). `bt` ve `mlpack` 16.10'da silindi (kullanılmıyordu).
- KV `DB`: cfg (alarm, Telegram, izleme listesi), st (sunucu durumu), prefs (yedek). MCP ile KV okunamıyor.
- Sandbox'tan Worker'a ve kap.org.tr'ye curl ile ulaşılamıyor. Sunucuda bir şey denemek için: kodu cron'a geçici "prob" olarak koy, sonucu D1 meta'ya yazdır, D1'den oku (29.09'da KAP API böyle doğrulandı).
- Yerel test: `npx wrangler@3 dev --local` + sahte veri; terminal için Playwright (Chromium kurulu). LightweightCharts CDN'i sandbox'ta yüklenmez — o hata normal.
  sig.js için hızlı yol: node:sqlite ile sahte D1 + sahte fetchBarsTV (29.09'da böyle test edildi); derleme kontrolü `npx wrangler@3 deploy --dry-run --outdir <geçici>`.

## 3. Ne yapıldı (sürümler)
- v5.x: canlı akış doğrudan boru (?direct=1), PWA, Pine otomatik yükleme, Telegram düzeltmesi, Yahoo/TwelveData kaldırıldı.
- v6.0 Ana cihaz kilidi + bağlı cihazlar (arkadaşlar aynı sunucuyu kullanıyor; sadece Fatih ayar değiştirir, cihaz engellenebilir).
- v6.1 Sinyal Karnesi: radar (sunucu), Algı, Fırsat A/B sinyalleri D1 sig'e; seans sonrası 1 dk mumlarla ±%1/±%1,5 sonucu; 18:20 Telegram özeti.
- v6.2 Algı karnesi komisyonsuz (%0,05 kayma).
- v6.3 KAP Haber: KAP'ın kendi API'si, dakikada bir, sınıflandırma, Telegram, 09:30 gece özeti, tepki ölçümü, terminalde Menü → KAP Haber.
- v6.7 Misafir modu: ana cihaz kodu olmayan cihazda Telegram + Yedek bölümleri gizli; eski kopyalanmış Telegram bilgisi bir kez silinir (LS guestWiped).
- v6.8 Güvenlik: YENİ CİHAZ ONAYI (dev.ok; özellik gelince kayıtlı tüm cihazlar onaylı sayıldı; ana cihaz kodu gelen cihaz kendiliğinden onaylı). Onaysız/engelli cihaz: WS (direct ve eski relay), tv-token, bars, scan, tv-scan, news, status, test → 403 'onay bekliyor'. Veri yollarında ?dev= yoksa 6 Ekim 2026'ya kadar izin (eski sürümler güncellensin), sonra ret (tarayıcıdan /test için &own=KOD ekle). pine-test ve dev-ok yalnız ana cihaz. Terminal: Ayarlar → bağlı cihazlar'da 'ONAY BEKLİYOR' + Onayla. htmlEsc tırnakları da kaçırır, haber linki yalnız http(s), takvim başlıkları kaçırılır. tv-scan artık oturum bilgisi göndermez; misafirde elle girilmiş TV oturumu 'worker' yapılır (guestWiped2).
- v6.9–7.0 Tasarım: her bölümde 'Bu nedir?' bilgi kartı (IC{}), Algı/Fırsat 'neden sinyal' çipleri, gruplu menü, Karne sekmesinde sunucu karnesi (/sigstats), kompakt görünüm katmanı. Fırsat ⓘ eşik yazıları koda uyduruldu; günlükte Kapat düğmesi; Canlı 'Hız' = lot/sn.
- v7.1: 'Şimdi' ana ekranı (ilk sekme), üstten kayan sinyal kartı, mini fiyat çizgileri, renk düzeni, kapalı piyasa ekranları. Karne yükleyicisindeki sonsuz döngü düzeltildi (sunucuya ulaşılamazsa sayfa donuyordu).
- v7.2: Hata defteri (D1 err) + terminalde kendini toparlama + kalıcı testler (tests/run.sh) + akşam bakımı zamanlanmış görevi (hata bul → düzelt → test → yayınla; yalnız Claude bildirimi, Telegram yok).
- v7.3: genel bakım (işlemci yükü, KAP dayanıklılığı, güvenlik). v7.4: iş bilgisayarı sinyal motoru (pc/) — Algı/Fırsat telefona bağlı olmaktan çıktı; eşleştirme kodu ile kurulum.
- v6.4 Kopma teşhisi (arka plan / gerçek ayrımı). v6.5 Algı radarı okunur kart görünümü.
- Karne mesajı sadeleştirildi; devre kesici bildirimleri karneden çıkarıldı.

## 4. Denendi, TUTMADI (tekrar önerme — ya da yeni kanıtla gel)
- NABIZ göstergesi + 14 strateji varyantı (30 hisse, 5 dk/15 dk): hepsi eksi. Silindi.
- Terminal A/B notu geçmiş testi (BIST 100): +0,05…+0,08R, çok zayıf; sonuç endeks yönüne bağlı (yükselen günde +0,51R, düşen günde −0,38R).
- "10:30'da al, kapanışta sat" kuralları: kalıcı iz yok.
- Kovalamak kötü: sabah +%4 üstü ya da ilk 30 dk hacmi ≥4 kat olan hisseler günün kalanında zayıf.
- "Henüz koşmamış" fikirleri (geri çekilme, sert düşüş dönüşü, aşağı açılıp toparlanan, sıkışma, endeks düşerken yükselen): tutarsız/eksi.
  Tek hafif artı: "dipte hacimli dönüş" (zirveden %15+ aşağıda, sabah hacim ≥1,5 kat, 10:30'da artıda) — küçük avantaj.
- "Güçlü koşucu" (20 günde ≥+%25, zirveye %3 yakın, oynaklık ≥%4, endeks ≥0; +%3 hedef/−%1,5 stop): geçmişte iki dönemde de artıydı
  (+%0,44…0,49/işlem, 14 ayın 11'i). FATİH REDDETTİ: "hisseler çok yukarıda olmuş, güvenilmez". Önerme.

## 5. Araştırma bulguları (feat tablosu, 92 hisse, Ağu 2025–Eyl 2026)
- 10:30'dan sonra +%3 görme oranı hissenin günlük oynaklığına çok bağlı (%2–3 oynaklıkta %9, %8+ oynaklıkta %50). Oynaklık avantaj değil, alan.
- Sabah oynaklığı +%3 ihtimalini de stop ihtimalini de artırıyor → tek başına avantaj yok.
- Endeks 10:30'da 0…−%0,5 arasındaysa günün en kötü grubu.
- Tavan kapanan hisse ertesi gün ortalama +%1,8…2,1 açılıyor, %76 yukarı açılış (tavanda satma, ertesi açılışta sat mantığı).
- Raporlar: /mnt/user-data/outputs/Yukselenler-Arastirmasi.pdf ve -v2.pdf (bu sohbetin çıktıları).
- 29.09 akşamı FİLTRE TESTİ (100 hisse, her gün 10:30'da al, ±%1 önce hangisi; eski = 15.03.2026 öncesi / yeni = sonrası; sadece sonuçlananlar):
  hepsi %46 / %44 · endeks artıda %48 / %46 · endeks ekside %41 / %42 · oynaklık <%4 %45 / %43 · oynaklık ≥%6 %49 / %49 ·
  endeks artı + kovalamasız + oynaklık ≥%5 → %50 / %48. Endeks etkisi 14 ayın 11'inde tutarlı (en güvenilir bulgu).
  Kovalama (r30≥4 veya vr30≥4) bu ölçümde belirgin fark YOK. Hiçbir filtre tek başına %60'a getirmiyor; işe yarayan yanı kötü günleri elemek.
  Not: i30 günlük bir değer → etkin örnek sayısı gün sayısıdır (eski ~148, yeni ~132 gün), satır sayısı değil.
  Yöntem: bu testler D1'de TEK gruplama sorgusuyla yapılabilir (her biri ~55 bin okuma) — veri aktarmaya gerek yok. Tam kombinasyon araması için yine feat_pack/feat_search.

## 6. SIRADAKİ İŞ: %60 başarı araması — NASIL YAPILIR
Hedef: hedef = stop (±%1, ±%1,5, ±%2) iken %60+ tutan, 10:30'da bilinebilen şartlardan oluşan kural. (Başa baş %50.)
1. SQL'de tarama YAPMA. Kombinasyon taraması D1'de ~84M satır okur (günlük sınır 5M) — 29.09'da ölçüldü.
2. `tools/feat_pack.py 0 3000` → çıkan SQL'i Cloudflare MCP ile çalıştır → sonuçtaki `s` metnini `tools/data/parca_00000.txt`'ye yaz.
   OFFSET 3000, 6000 … 24000 ile tekrarla (~9 parça, toplam ~115 bin okuma — güvenli).
3. `cd tools && python3 feat_search.py 1` (sonra 1.5 ve 2). Kurallar ESKİ dönemde (15.03.2026 öncesi) aranır, YENİ dönemde doğrulanır.
   Sentetik testte gizli kuralı doğru buldu. Yeni dönemde de ≥%60 tutan (✅) kural yoksa bunu açıkça söyle: "günlük fiyat/hacim verisinde %60 yok".
4. Aday bulunursa: tek tek hisselere bağımlı mı kontrol et (en çok sinyal veren 5 hisse hariç tekrar), ay ay tutarlılık, sonra Fatih'e sade tablo.
   Onay gelmeden terminale/sunucuya ekleme. Eklenirse önce canlı izleme (Sinyal Karnesi'ne yeni kaynak olarak).
- feat sütunları: gap, r30 (10:30 getiri), vr30 (ilk 30 dk hacim/normal), d1/d5/d20, dist (20g zirveye uzaklık), sq (sıkışma), vt (3g/20g hacim),
  above (EMA20 üstü), i30 (endeks 10:30), wd (gün), rng30 (sabah aralığı %), adr (20g ort. günlük aralık %), o10/o15/o20 (1 hedef, 2 stop, 0 yok),
  rest (10:30→kapanış), mfe/mae/t3/dd3.

## 6b. 03.10 %60 ARAMASI SONUCU (feat, 27.514 satır, 100 hisse, Ağu 2025–Eyl 2026; eski <15.03.2026 / yeni ≥)
- Taban (her hisseyi 10:30'da al): ±%1,5'te %43 — 10:30 alımı genelde kaybettiriyor.
- Gün düzeyi şartlar (wd, i30) eski dönemde %70+ çıkıp yenide çöküyor → sahte (az sayıda güne bağlı). Bunları arama dışı bırak (scratchpad s2.py mantığı).
- TUTARLI ADAYLAR (10:30 girişi, hedef=stop):
  A) 5 günde ≥+%5 · 20g oynaklık (adr) ≥%6 · 10:30'da gün getirisi <%2 → ±%1,5: %58,3 (eski 58,1 / yeni 58,5), 14 ayın 14'ü ≥%50; ±%2: %58,8. En çok 5 hisse hariç %55,7.
  B) dün ≥+%3 · adr ≥%5 · 10:30'da <%1 → ±%2: %58,8 (60,2 / 57,5), 13/14 ay; 5 hisse hariç %57,9 (60 hisse, daha yaygın).
  A VE B → ±%2: %62,8 (eski 66,9 / yeni 58,7), n=242 (~günde 1), 11/12 ay, 5 hisse hariç %63, ort +%0,53/işlem.
- Uyarı: 'güçlü koşucu' ailesine yakın (Fatih o versiyonu reddetti); bu daha ılımlı (5 gün +%5 / dün +%3, 20 günlük +%25 değil). Spread/kayma yok sayıldı.
- Fatih onayı olmadan sinyale eklenmez; önerilen yol: karneye 'deneme' kaynağı olarak canlı ölçüm.

## 6c. 03.10 gece "SESSİZ TREND" ÇALIŞMASI (Fatih'in INTET gözlemi: tavanda Güç/Trend yüksek, Hacim/Oynaklık düşük)
- Ekrandaki profil SONUÇ, sebep değil: Güç = bugünkü değişim (tavan → 97), Hacim/Oynaklık = 15 dk RVOL/ATR (tavana kilitlenince düşer). Sonradan bakış.
- 10:30'daki karşılığı feat'te test edildi (eski/yeni dönem, ±%1,5 ve ±%2 önce hangisi, kapanış ort.):
  Güç (ilk 30 dk ≥+%2) + trend + sessiz → eski %60, yeni %50 → TUTMADI. Güç tek başına taban gibi.
  SESSİZ TREND = 20g ≥+%10 VE zirveye ≤%3 VE ilk 30 dk hacmi normalin altında (vr30<1) VE ilk 30 dk aralığı < günlük ort. aralığın yarısı:
    ±1,5: %56 / %55 (n 791/404), kapanış +0,09 / +0,16. Aynı trend + YÜKSEK hacim: %47 / %57, kapanış −0,03 / −0,25.
  SESSİZ TREND + oynak hisse (adr ≥%5): ±1,5 %60 / %60, ±2 %60 / %60, kapanış +0,33 / +0,55 (n 130/120). Hacim <0,7x ile: %59 / %67 (n 92/78).
  Sessiz trend ∩ Momentum: %88 / %75 ama n 17/21 (çok az). Haftanın günü dağılımı: 46–69 (Çarşamba zayıf, küçük n).
- 03.10 Fatih kararı: bir ay bekle; Sessiz trend SESSİZ KAYIT olarak açıldı (v8.6, src 'sessiz', bildirim yok). ~3 Kasım'da toplu değerlendirme.

## 6d. 09.10 gece MOMENTUM DERİN İNCELEME (feat, 242 sinyal, 155 gün; canlı kuralla aynı: d1≥3, d5≥5, adr≥6, r30<1; ciro şartı feat'te yok)
Her işlemde %0,1 kayma düşüldü. Eski <15.03.2026 / yeni ≥. İşlem başına ortalama % (taban = diğer tüm hisse-günler: −0,16…−0,32):
- ±%1: +0,05 / +0,09 (avantaj yok denecek kadar az) · ±%1,5 (CANLI): +0,33 / +0,19 · ±%2: +0,60 / +0,26
- Stop −%3, hedef yok, kapanışta sat (mae ≤ −3 → −3, yoksa rest; bu hesap SIRADAN BAĞIMSIZ, kesin): +1,34 / +0,51. Stopsuz kapanış: +1,54 / +0,58 ama yeni dönemde işlemlerin %13'ü −%5 ve kötüsü.
- Hisse yoğunluğu: en sık 5 hisse (PASEU, KLRHO, KTLEV, DSTKF, EFOR) 242'nin 96'sı. ±1,5/±2 yarışı onlar hariç de tutuyor (yeni dönem ±1,5 kazanma %60, +0,20).
  'Stop −3 kapanış' kârı ise büyük ölçüde bu koşuculardan: 5'i hariç yeni dönem +0,07 → kırılgan.
- Piyasa filtresi (piyasa genişliği = o gün tüm hisselerin 20g ort. getirisi; endeks 10:30 yönü): iki dönemde tutarlı fark YOK (hücreler küçük). Momentum'da piyasa kapısı önerme.
- Seri/düşüş (eşit tutar, toplam % = işlem başına % toplamı): ±1,5 en derin düşüş −10,6, en uzun 6 zararlı gün; ±2 −10,9 / 6; stop−3 −13,2 / 5, en kötü gün −9,3.
  20.000 TL/işlemde ±2: 13 ayda ~+21.000 TL, en derin düşüş ~2.200 TL (kayma dışı maliyet, taban kilidi, likidite hesaba katılmadı).
- Ay ay (stop−3): 14 ayın 10'u artı. ±2: 14 ayın 10'u artı.
- ÖNERİ (3 Kasım'da Fatih'e): canlı Momentum ±1,5 → ±2'ye geçiş adayı (iki dönemde de daha iyi, hisseye bağımlı değil). 'Stop −3 kapanış' bot yarışına deneme botu olarak eklenebilir; gerçek sinyal olmaz.
  Yeni dönem eski dönemin yarısı kadar kazandırıyor → avantaj küçülüyor olabilir; canlı karne bunu doğrulamalı.

- 09.10 ek testler: (1) Momentum'u ertesi güne taşımak belirgin iyileştirmiyor (ertesi kapanış +1,85/+0,87 vs aynı gün kapanış +1,54/+0,58; ertesi açılış daha kötü) → gün içi kalsın.
  (2) Günün en iyi 1 hissesini seçmek (dün/5 gün en çok, en oynak, sabah en zayıf) hepsini almaktan tutarlı iyi DEĞİL → hepsini al.
  (3) CANLI karne, saate göre (algi+firsat+radar, AL, kapanışa kadar tutma rc): 10–11 −1,30 · 11–13 −0,41 · 13–15 −0,34 · 15–18 −0,60 → gün içi sinyaller hareketi KOVALIYOR (bölüm 4 ile aynı ders).
     İlke: "güçlü hisse, SAKİN an" (Momentum gibi) — hareket eden hisseyi değil, güçlü ama o an durgun hisseyi al.
  (4) Ertesi gün açılış (tüm hisseler): tavan kapanan +1,76/+2,13 (%76–77 yukarı) — en güçlü etki ama tavana kilitlenince alınamaz; −%5 ve kötüsü kapanan ertesi gün −0,94/−2,54 (%31–45 yukarı) → ertesi gün bu hisselere AL sinyali verme (filtre adayı).
  Sıradaki (dakikalık mum gerekir): Momentum hisselerinde 10:30 dışı sakin-an girişleri; gün sonu 'tavana gidiyor' adayı (17:00'de +%7 üstü) ertesi açılış testi; çıkış (yarısı +%2, kalanı izleyen stop).
## 6e. 09.10 gece MAKİNE ÖĞRENMESİ DENEMESİ (feat → sıkıştırılmış aktarım, 11.444 satır adr≥4, 279 gün)
- Aktarım: D1 tablo `mlpack` (gün başına sıkıştırılmış satır, 64 karakterlik alfabe, 16 özellik + o10/o15/o20) → elle kopya + gün uzunluğu/sağlama toplamı kontrolü (280/280 doğru).
  Sandbox'tan Cloudflare/Worker'a doğrudan erişim YOK (yalnız GitHub) — veri aktarımı bu yolla yapıldı.
- Model: HistGradientBoosting, ay ay ileriye dönük (yalnız geçmiş aylarla eğit, sonraki ayı tahmin et; test 2025-11..2026-09, 11 ay).
  Özellikler: 10:30 anlık feat + gün başlığı (md20/md5/mr30/artıda payı) + gün içi sıralar. Maliyet varsayımı %0,2 gidiş-dönüş.
- SONUÇ: MODEL MOMENTUM'U GEÇEMEDİ.
  ±1,5: model en iyi 1–2 hisse ort +0,17 (net ≈0), kazanma %48–50 · Momentum +0,29, kazanma %59, 11/11 ay artı.
  ±2: model +0,13..+0,26 · Momentum +0,41 (net +0,21), en iyi 5 hisse hariç +0,21.
  Stop −3/gün sonu: model top2 +0,55 ama en iyi 5 hisse hariç +0,15 (birkaç uçan hisseye bağlı); Momentum +0,61 ama 5 hisse hariç −0,16.
  Şans kontrolü (hedef gün içinde karıştırılıp aynı model): top1 ±2 ort −0,31..+0,32 → modelin +0,26'sı şans aralığında.
  Model puanı Momentum adaylarını TERS sıralıyor (puanı düşük yarı daha iyi) → filtre olarak da kullanılmaz.
  Kazanma olasılığı sınıflandırıcısı (±1,5 önce hedef): %52–53 (taban %42) ama ortalama getiri +0,15 — maliyet sonrası sıfır.
- Ders: tek bir 10:30 anlık görüntüsü (günlük özet özellikler) daha fazla bilgi taşımıyor; algoritmayı büyütmek çözmez.
  Yeni kenar için YENİ BİLGİ gerekir: dakikalık mum arşivi (10:30'a kadar seyir şekli, hacim dağılımı), derinlik/emir defteri, takas/aracı kurum dağılımı.
- Öneri (3 Kasım'dan SONRA, Fatih onayıyla): (1) Worker'a günlük dakikalık mum arşivi (seans sonrası, R2/D1; CPU sınırı için motor/iş PC'si de yazabilir),
  (2) 2–3 ay arşiv birikince model yeniden denenir, (3) derinlik (İdeal) en büyük potansiyel yeni bilgi.
  Momentum ±1,5 → ±2 önerisi geçerli (6d). Betikler: tools/ml/ (pack.py SQL üretir, check.py doğrular, decode.py çözer, model.py + m2.py test); mlpack tablosu 16.10'da silindi; yeniden gerekirse pack.py ile feat'ten yeniden üretilir.

## 6f. 09.10 gece ZENGİN VERİ (15 dk mumlar) — İLK GERÇEK İLERLEME
- VERİ YOLU (önemli): D1 MCP sorgusunun BÜYÜK sonucu Claude Code'da otomatik dosyaya kaydediliyor (~/.claude/projects/.../tool-results/*.txt, belirteç harcamadan).
  `SELECT sym,data FROM bars ORDER BY sym LIMIT 10 OFFSET n` × 14 → 132 satır (101 hisse+XU100 @15 = 10.000 mum ≈ 14 ay; 30 hisse 5 dk ≈ 50 gün), ~50 MB, okuma ~132 satır.
  Veriyi REPOYA KOYMA (herkese açık, TradingView verisi). Betikler: tools/ml/build_rich.py (özellik + sonuç), tools/ml/rich_model.py (ileriye dönük model).
- Yeni özellikler: dünün kapanış yeri (yclv = (kapanış−dip)/(tepe−dip)), dünün son saati, dün VWAP farkı, gün içi VWAP farkı, aynı saate kadar hacim/20g ort. (vrT),
  aralıktaki yer, endekse göre fark; 10 giriş saati (10:30…17:30); sonuç ±1/±1,5/±2 yarışı (aynı mumda ikisi → stop), gün sonu, ertesi açılış.
- TUZAK (düzeltildi): ilk model tabana yakın (−%8…−10) hisseleri seçiyordu — taban sınırı yüzünden −%2 stop matematiksel olarak gelemiyor; gerçekte satılamazsın.
  Bundan sonra her testte −%7 < 10:30 değişimi < +%7 şartı.
- MODEL (10:30, ±2, günde 1 hisse, test 11 ay ileriye dönük): ort +0,55, hedef önce %59, 10/11 ay artı, en çok seçilen 5 hisse hariç +0,33. Şans (karıştırılmış) −0,07.
  Seçtikleri: oynak (adr ~7), 20 günde güçlü (d20 ~+30), zirveye yakın, DÜNÜ GÜÇLÜ KAPATMIŞ (yclv ~0,84), 10:30'da sakin (değişim ~0, hacim normalin altında).
  Diğer saatler (11:00 sonrası) zayıf — en iyi giriş 10:30.
- MODELDEN ÇIKAN SADE KURALLAR (eski <15.03 / yeni ≥15.03, ±2 ort / hedef önce %):
  Momentum                         +0,71 %70 / +0,30 %58
  Momentum + dün güçlü kapanış (yclv≥0,7)   +0,64 %68 / +0,47 %63  (±1,5: %63/%62; ±1: %54/%62) — 12/14 ay artı, 5 hisse hariç +0,29
  Momentum + yclv≥0,7 + 10:30 hacmi normalin altı (vrT<1)  +0,59 %64 / +0,60 %65 (az işlem: 50/57)
  YENİ "GÜÇLÜ KAPANIŞ" (adr≥6, yclv≥0,7, 10:30 değişimi −1…+1): +0,44 %64 / +0,45 %62, 12/14 ay, 306 işlem 165 gün, Momentum'la 109 ortak.
  Eşik taraması pürüzsüz (yclv 0,6→0,8 ve adr 5→7 hep aynı yönde) → tek eşiğe uydurma gibi durmuyor.
- GECE ETKİSİ: hisselerde 10:30→kapanış ort −0,10, 17:30→ertesi açılış ort +0,2 (her iki dönemde, günlerin ~%70'i artı sepet).
  Gün içi alım bu ters rüzgârla yarışıyor. −%5 altı kapananlar ertesi sabah kötü, tavan kapananlar iyi (bilinen). Gece taşıma modeli düz sepetten iyi değil.
- Maliyet notu: Fatih komisyon ödemiyor → gerçek maliyet ~1 fiyat adımı kayma (~%0,05–0,1); testlerde %0,1 kullanıldı.
- 09.10 Fatih ONAYLADI → v8.9'da eklendi (src 'dunguclu' + bot 'momgk'). Eski öneri metni: 'Güçlü kapanış' + 'Momentum + güçlü kapanış' SESSİZ KAYIT olarak karneye (sessiz trend gibi, Telegram yok) → 3 Kasım'da canlı veriyle karar.
  Canlıda yclv için dünün 1D mumu (tepe/dip/kapanış) yeter.

## 6g. 09.10 sabah FATİH'İN BAŞARI TANIMI: "sinyalden sonra +%3 gelmesi başarıdır, gün kapanışı baz alınmasın"
- Ölçüm (15 dk mumlar, 10:30 girişi, −%7…+%7 arası; eski <15.03 / yeni): taban: gün içinde +%3'e ulaşma %19/%18 (−%3'e de %15/%17).
  Oynak hepsi (adr≥6): %42/%41 · Momentum: %61/%54 (−3 de %29/%36), +3 önce/−3 önce %70/%61, 3 iş günü içinde +3 %79/%70.
  Momentum + dün güçlü: %63/%57, önce/−3 %70/%64, 3 günde %80/%76 · Dün güçlü kapanış: %48/%51, önce/−3 %67/%62, 3 günde %72/%77.
  Sessiz trend benzeri: %41/%39. +3 hedefli model (günde 1): gün içi %56, önce/−3 %61 — Momentum'dan iyi değil (şans %23 / %55).
- CANLI KARNE (09.10'a kadar, mfe/mae): +%3'e ulaşan → Algı 25/207 (%12), Fırsat B 21/137 (%15), Fırsat A 1/13, Radar 24/52 (%46, ama −3 de 33),
  Momentum 11/19 (%58; −3 de 7), Tavan 47/73. Algı/Fırsat ±%1 için tasarlandı; +%3 tanımında zayıflar.
- Dikkat: "+3'e ulaştı" tek başına yanıltıcı (oynak hisse hem +3 hem −3 görür). Doğru ölçü: +3 mü önce, −K mı önce (K = Fatih'in stopu).
- Bekleyen: karnede ölçünün +3'e çevrilmesi (Fatih'in stop tercihi sorulacak) — seans dışında, testli.

## 6h. 09.10 gece "+%3 hedef / −%1 stop" için en iyi ne yapılabilir (15 dk mumlar, ileriye dönük test 2025-11..2026-09)
- Rastgele hisse (10:30): +3 önce %13, −1 önce %61, işlem başı −0,06.
- Momentum: +3 önce %33, işlem başı +0,39 (5 hisse hariç +0,20), 8/11 ay artı · Momentum + dün güçlü: %34, +0,43, 9/11 ay.
- Model (+3/−1 getirisini tahmin, günde 1): 10:30 +0,27 · 11:00 +0,39 · 12:00 +0,33 — Momentum'u geçmiyor, en çok seçilen 5 hisse çıkınca ~0.
- SONUÇ: bu veriyle ulaşılabilecek tavan işlem başı ~+0,3–0,4 (günde 1–2 işlem). "Her gün %3" verinin hiçbir köşesinde yok (Fatih'e dürüstçe söylendi).
  Daha fazlası için yeni bilgi gerekir (derinlik/takas). Karar: Momentum ailesi + disiplinli risk, canlı karne 3 hafta.
- 09.10 gece ÇIKIŞ/GİRİŞ TESTİ (Momentum 241 sinyal, 15 dk mumlar; işlem başı ort, eski/yeni): şu anki +3/−1 +0,42 (0,41/0,44) ·
  hedef +4 +0,60 (0,62/0,58) · hedef +6 +0,68 · hedefsiz stop −1 gün sonu +0,69 (0,62/0,76) · hedef +4 stop −1,5 +0,74 (0,89/0,60, 5 hisse hariç +0,35) ·
  hedef +5 stop −1,5 +0,71 · iz süren stop +0,47 · +1,5'te stop girişe +0,41 · geri çekilmede gir +0,47 (yeni 0,22) · 3 gün tut +0,46.
  DERS: kazananı +3'te kesmek kazancın üçte birini bırakıyor; asıl iyileştirme sinyalde değil ÇIKIŞTA. Öneri: bot yarışına sessiz '+4/−1,5' ve 'hedefsiz −1' botları.

## 6i. 10.10 gece YENİ GİRİŞ FİKİRLERİ (+%3/−%1, aynı gün, %0,1 maliyet; 15 dk mumlar, 100 hisse, 14 ay, 20g ort. ciro ≥50 Mn)
Betikler: tools/ml/prep.py (S.pkl), ideas.py, summ.py, night.py, late.py, mom2.py. İşlem başı ort / kazanma % / ay artı / en çok kazandıran 5 hisse hariç:
- KARŞILAŞTIRMA Momentum (10:30): +0,29 · %33 · 9/14 · +0,04 (hedefsiz −1: +0,55)
- İlk saat tepesini kırınca al −0,08 · 20 gün zirvesini kırınca −0,10 · hacim patlaması + güçlü mum −0,05 · yükselen hissede VWAP dönüşü +0,13 (top5 hariç +0,07)
  boşlukla açılıp tutunan +0,28 (84 gün, top5 hariç +0,05) · aşağı açılıp artıya dönen −0,12 · endeks düşerken güçlü hisse −0,07 · dün tavan → ertesi gün açılışta al +0,04 (10:30'da −0,07).
  → HİÇBİRİ Momentum'u geçmedi.
- GECE: TAVAN KAPANIŞTA ALINIRSA ertesi gün +%3/−%1: +1,64, kazanma %55, 14/14 ay, top5 hariç +1,28 (kazancın çoğu açılış boşluğu: ort +1,9).
  AMA alıcılı tavanda emir genelde dolmaz; dolanlar büyük ihtimalle zayıf olanlar (ters seçilim). Dolabilir sürüm (17:45/18:00'de +%7–9'dakini al) zayıf: +0,26..+0,48, top5 hariç ~0.
  Canlı 'tavan' karnesi ertesi gün açılıştan ölçüyor → geçmişte ~0 (canlıda 12/30 iyi görünse de az örnek).
  Derinlik verisi gelirse (İdeal): tavan kuyruğu lot/sıra bilgisiyle 'dolabilir tavan' araştırılabilir — derinliğin somut bir kullanım yeri.
- Giriş saati (Momentum): 10:00 +0,19 · 10:15 +0,03 · 10:30 +0,29 · 11:00 +0,24 · 12:00 +0,15 → 10:30 kalsın.
- ŞÜPHELİ ADAY: Momentum + 10:30'da BIST 100 ≤ +%0,3: +0,59 · %40 · 13/14 ay · top5 hariç +0,34 (eşik eğrisi düzgün; >0,3 günlerde −0,03..+0,0).
  Ama: gün karıştırma testi eşik seçimiyle %6 şans; 11:00 girişte etki TERS; Dün güçlü kapanış ve oynak hisselerde etki yok/ters → büyük ihtimalle tesadüf.
  Canlı ilk hafta (05–09.10): endeks ≤0,3 günleri 5/13, >0,3 günleri 2/8 (aynı yönde, çok az). sig.idx zaten var → yeni ölçüm gerekmez; 3 Kasım'da canlı karneyle bak.
- Hafta günü (Salı iyi, Perşembe kötü) — çoklu deneme gürültüsü sayıldı, kullanılmadı.
- SONUÇ: fiyat/hacim mumlarından yeni giriş kuralı çıkmadı. Kazanç kaynağı hâlâ Momentum + doğru çıkış (6h). Yeni bilgi = derinlik / takas.

## 6j. 10.10 OLAY ARAŞTIRMASI (fiyat kalıbı değil, hisseyi hareket ettiren olaylar; veri: SPK bültenleri + BORSA günlük fiyat, ham veri scratchpad'de, repoda yok)
- SPK BEDELSİZ ONAYI (2024/07–2026/10, 213 olay, 3 yıl bülten okundu): önceki kapanış → bülten günü +1,9 (Perşembe +2,7), ertesi açılış boşluğu +1,7 (%76 artı),
  ertesi gün açılıştan sonra −0,5; ertesi açılışta al +3/−1: 39 kazan / 112 kayıp. Bülten AKŞAM yayımlanıyor (haber saatleri 20:20–23:52) → hareket alınamıyor. SİNYAL YOK.
- HALKA ARZ (2024–2026/09, 86 arz): tavanla açılanlara girilemez (5 günde +22 ama alınamaz). Tavanla AÇILMAYAN (alınabilen) 22 arz: 5 gün −6,8, 20 gün −14,6.
  Tavan serisi bozulunca kapanışta al: ertesi açılış −2,6, 10 gün medyan −14,6. → 'yeni halka arzda tavan bozulunca / tavanla açılmayınca alma' UYARI adayı.
- ENDEKS DEĞİŞİKLİĞİ (11 dönem 2024Q2–2026Q4, 232 olay; BIST30 listeleri tek kaynaktan okundu, şüpheli): BIST100'e GİREN: duyurudan sonraki açılıştan geçerlilik öncesi kapanışa endekse göre +3,1 (medyan +2,3, %64 artı)
  ama dönemden döneme −2,7…+13 (2026Q4'ün 27 olayı ortalamayı şişiriyor). BIST100'den ÇIKAN: −4,2 (medyan −2,2), geçerlilik sonrası 5 gün −2,0. → 'çıkacak hissede alım sinyali verme' FİLTRE adayı (yılda 4 kez).
- KAP haber tutarı (2) ve içeriden alış/satış (3): KAP detay ucu Worker'dan çalışıyor (attachment-detail JSON + HTML; 'Yeni İş İlişkisi' taksonomi formu, içeriden bildiriminde metin 'satış işlemi yapılmıştır').
  Geçmiş gün listesi de çalışıyor (byCriteria fromDate=toDate, ~100 KB/gün).
- PAY GERİ ALIMI (kaph 'geri', 2.174 bildirim / 187 hisse, 2025-10..2026-10; 15 dk mumu olan 32 büyük hissede 322 olay, giriş: seans içiyse sonraki mum, değilse ertesi 10:00):
  +3/−1 ort +0,05 (aynı hisselerin sıradan günü −0,13), hedefsiz +0,17, 6/12 ay, en çok kazandıran 5 hisse hariç −0,29; 30 günde ilk bildirim 47 olay +0,07. → zayıf, SİNYAL YOK.
  'Yeni iş ilişkisi' detay metninde tutar 'oda_ExplanationTextBlock' açıklamasında ('1.570.000 Usd tutarlı', '732.000 Avro') → düzenli ifadeyle çıkarılabilir.
- KAP YENİ İŞ / SİPARİŞ TUTARI (11.10; 893 haber, 617'sinde tutar okundu, 123 hisse; tutar ÷ piyasa değeri; günlük fiyat; tools/ml/olay/is_an.py):
  gece/sabah gelen haber → ertesi açılış boşluğu tutarla büyüyor (<%1: +0,7 · %1-5: +1,1 · %5-20: +1,9 · >%20: +2,8) AMA açılıştan sonra almak kaybettiriyor:
  açılış→kapanış +0,08 / −1,05 / −0,42 / +0,48; +3/−1 kazan/kayıp 28/53, 18/75, 17/47, 7/17; 3 gün −1,5…+1,1. Seans içi haber: o gün açılış→kapanış %5-20'de +1,4 ama kapanışta alan ertesi gün ~0.
  → Haber fiyata AÇILIŞTA yansıyor, sonra geri veriyor. SİNYAL YOK. Uyarı/süzgeç adayı: 'KAP iş haberiyle boşluklu açılan hissede açılışta alma' (canlı karne kap-is 8/30 ile uyumlu). v9.5 kaph.js 2025-10-01'den bugüne topluyor (seans dışında). Canlı karne: kap-geri 300 olay 75/163 (%31,5 > %25 başabaş), kap-is 8/30.

## 6k. 10.10 KEŞİF MOTORU (tools/ml/engine.py): 672.436 kural tek seferde (23 özellik × 9 eşik × 2 yön, tek ve ikili koşul) × 4 giriş saati (10:30/11:00/12:00/14:00) × 2 çıkış (+3/−1 ve hedefsiz −1)
- Matris çarpımıyla saniyeler içinde. Eğitim <2026-03-01, doğrulama 03-01..06-14, test ≥06-15. Eğitimde ilk 200 → doğrulamada > +0,3: 232 kural (ŞANS kontrolü: karıştırılmış sonuçla 6–13) → kalıcı yapı VAR.
  Ama 232'nin test ortalaması +0,03 (yarısı artı) — çoğu tesadüfe yakın. Not: test dönemine sıralamada bakıldı → bundan sonrası CANLI sessiz kayıtla doğrulanacak.
- Öne çıkan aile: 12:00 'TREND GÜNÜ' — endeks ≥ +0,8 VE hisse açılıştan ≥ +2: 919 işlem / yalnız 54 gün; işlem başı +0,38 (dönemler +0,32/+0,55/+0,33, 5 hisse hariç +0,33),
  eşik yüzeyi düzgün (açılıştan getiri ve endeks arttıkça artıyor). AMA gün ortalaması +0,18–0,23, günde en çok 3 seçilince +0,27 (5 hisse hariç +0,07) — kazanç birkaç güçlü güne yığılmış.
  → v9.7 sessiz kayıt 'oglen' (en çok 3, piyasa değeri ilk 120, değişim < +7, stop −1 hedefsiz). Diğer adaylar: 11:00 'd5≥5,9 & dün hacmi düşük (yvr≤0,49)', 'aralık dar & d20≥20' (sessiz trende benzer).

## 6l. 11.10 D1 OKUMA BÜTÇESİ ÖLÇÜMÜ (ARAŞTIRMACI; MCP rows_read ile, sig ~2.500 satır iken)
- sigBackfill seçimi (sig_t, son 6 gün): 1.537 satır/çağrı — seans DIŞINDA her dakika (ölçülecek sinyal yokken) → günde ~1,3M. EN BÜYÜK KALEM.
- paperCalc (/paper, 2 dk önbellek, isolate başına): 2.510 satır (tüm tablo; 'd >= start' sig_d kullanmıyor gibi) → istemci sayısıyla günde 1–2M olabilir.
- sigStats (/sigstats, 5 dk önbellek): 2.430 satır → günde ~0,7M. sig tablosu günde ~150–250 satır büyüyor → bu üçü doğrusal ARTAR; birkaç hafta içinde 5M sınırı hafta içi de dolabilir.
- ÖNERİ (GELİŞTİRİCİ işi, Fatih onayıyla): (1) sigBackfill'i 'iş yoksa' meta bayrağıyla atla (yeni ölçüm gelene kadar) ya da 15 dk'da bir çalıştır; (2) paperCalc ve sigStats sonucunu karne ölçümünden sonra meta'ya bir kez yaz, /paper ve /sigstats meta'dan okusun;
  (3) worker fetch'i try/catch ile sar → D1 kapalıyken CORS'lu anlaşılır 503 (şu an 'Load failed'); ownerTok D1 hatasında son bilinen değeri kullansın (taslak: araştırmacı oturumunda git stash 'D1 dayaniklilik').
- err tablosu (son 7 gün): yalnız kendini toparlama kayıtları (canlı veri 60 sn gelmedi ×10, karne ölçümü yarıda kesildi ×2) — çözülmemiş gerçek hata yok. Motor canlı (bot_seen 11.10 04:57), cron 5-tamam.

## 6m. 15.10 gece GÜNLÜK GÖZDEN GEÇİRME (Fatih onayıyla 3 iş)
- Canlı Momentum 05–15.10: 42 sinyal, 9 kazandı / 30 kaybetti, +3/−1 toplam −0,84 puan (≈ −840 TL, 100.000 TL/işlem, kayma hariç); hedefsiz −1: −21,3; gün sonu tut: −61. İlk hafta +8,66, 12–15.10 −9,5 (2/17).
- TEKRAR EDEN HİSSE (aynı hisse son 4 günde yine Momentum): canlı 7 işlem 1 kazandı (−3 puan), tekrarsız 35 işlem +2,2.
  feat geçmişi (92 büyük hisse, ciro şartı yok; eski <15.03 / yeni): tekrar ±1,5 ort +0,28 / −0,12, tekrarsız +0,48 / +0,48; gün sonu tekrar +1,90 / +0,47, tekrarsız +1,21 / +0,84.
  → İki dönemde YÖN TUTARSIZ (eski dönemde tekrar iyi, yenide kötü). KURAL ÖNERİLMEDİ; 3 Kasım'da canlı karneyle tekrar bak (sig'den sym+d ile hesaplanır, yeni ölçüm gerekmez).
- EMİR AKIŞI İLK BAKIŞ (flow, 12–15.10, 19 Momentum sinyalinin hepsinde veri var): 10:01–10:29 alıcılı payı 0,38–0,69. Kazanan 2 sinyal (ONCSM, KAPLM) 0,44'te; gün sonu sonucuyla da düzen yok. ÖRNEK ÇOK AZ — 4–6 hafta sonra.
  Sorgu kalıbı (az okuma, ~4.300 satır): flow JOIN sig ON d, m BETWEEN 600 AND 625, json_each(json_extract(data,'$.s.'||sym)); dakika satırı [dk, alıcılı, satıcılı, belirsiz, işlem, son, alış, satış].
- OKUMA TASARRUFU (v11.0, GELİŞTİRİCİ işi): sigBackfill boş bulursa meta 'bf_idle' → 15 dk atlar (önce her dakika ~1.200 satır); /paper → meta 'paper_v', /sigstats → meta 'stat_v' 10 dk ortak önbellek.
## 6n. 15.10 gece CANLI KARNE DERİN BAKIŞ (sig, 29.09–15.10, 13 iş günü, 2.634 AL sinyali; +%3/−%1, ikisi de yoksa gün sonu; işlem başı %0,15 maliyet; aynı gün aynı hisse tek)
- Dönem çoğunlukla düşüş (endeks ekside 7–9 gün). Gün-t = günlük ortalamaların t değeri (gün kümelenmesi), "en iyi 3 hisse hariç" = tek hisse etkisi kontrolü.
- KAYBETTİREN (tutarlı): Algı −0,35/işlem (549, 0/11 gün artı), Fırsat B −0,33 (267, gün-t −2,9; endeks ekside −0,55, gün-t −5,9), Fırsat A −0,30 (26), Radar −0,60 (gün-t −3,3), KAP temettü −1,03 (hak kullanımı düşüşü), bedelsiz −0,95, sessiz/dunguclu az ve eksi.
  Algı güçlü+rv≥2 (v10.9 Telegram kuralı) −0,15 (38) — diğerlerinden iyi ama hâlâ eksi. Algı'da hiçbir kırılım (endeks, saat, oynaklık) artıya geçmedi.
- ADAY 1 — KAP ŞİRKETİN GERİ ALIMI, SEANS İÇİNDE YAYINLANAN (giriş = yayından sonraki 1 dk mumun açılışı): 42 sinyal/20 hisse %52 isabet +0,77 (9/12 gün artı, gün-t +2,7).
  Her gün bildiren DCTTR/BLCYT ve tabandaki girişler (pre ≤ −9) hariç: 23 sinyal/16 hisse %57, +1,15/işlem, 6/10 gün, en iyi 3 hisse hariç +0,76. Her hissenin ilk sinyali: 20/20 hisse %71 +1,78.
  Gece/sabah yayınlanan geri alım (09:59 giriş) ≈ 0 (+0,13). Risk: örnek küçük, gerçek gecikme 1–3 dk (ölçüm yayın dakikasından), şu an Telegram'a gitmiyor (önem düşük).
- ADAY 2 — TAVAN TAKİBİ, AÇILIŞ FARKI < %6 (dün tavan kapanan, 09:59 giriş): 92 sinyal/70 hisse %42 isabet +0,55 (6/7 gün artı; en iyi 3 hisse hariç +0,36). Açılış farkı ≥ %9,4 (tavan açılış) 23'te 0 isabet −0,76, %6–9,4 −0,33.
  Risk: yalnız 7 gün, 5'i 06–12.10 küçük hisse coşkusu; endeks artı günlerde +0,63 (4/4), eksi günlerde zayıf. Ertesi gün takibi ajanının "girişin üstünde kapanan ertesi gün +%4" bulgusuyla uyumlu.
- KAP içeriden alım ve özel durum: endeks artıyken artı (+0,66 / +0,25), ekside eksi — bağımsız bir üstünlük yok, piyasa yönünü taşıyor.
- Kredi notu (kap-not) gece yayınlanan +1,36 (23) — örnek az, izlenmeli.
- ÖNERİ (Fatih onayı gerekir): (1) Geri alım seans içi → Telegram'a anlık mesaj (her hissenin o gün ilk bildirimi, tabandaysa ve her gün bildirenler hariç) + karnede ayrı kaynak; (2) tavan takibi 09:59 listesi yalnız açılış farkı < %6 olanlar, sessiz kayıtla başla; (3) Fırsat B'yi endeks ekside iken Telegram'dan çıkar. 3 Kasım'da birlikte yeniden bak.
- 16.10 gece UYGULANDI (Fatih: 'hepsini yap'): v11.4 — (1) geri alım seans içi Telegram, (2) tavan sakin açılış listesi 10:01 Telegram + karne 'tavan6' (tavan zaten karnede olduğu için sessiz kayıt yerine doğrudan liste), (3) Fırsat B endeks ekside Telegram'a gitmez. 3 Kasım'da 'kap-geri' (seans içi, pub saatine göre) ve 'tavan6' ayrı değerlendirilecek.

## 6o. 16.10 akşam GÜNLÜK GÖZDEN GEÇİRME (endeks −%2,9)
- Momentum 5 sinyal 0 kazandı/4 kaybetti, −4,82 puan (100.000 TL/işlem ≈ −4.820 TL). Canlı 05–16.10: 47 sinyal −5,66 puan; endeks ekside günler 39 işlem −5,66, artı 2 gün 8 işlem 0.
  TEKRAR EDEN HİSSE (son 6 takvim gününde yine Momentum): 12 işlem 1 kazandı, −8,8 puan; tekrarsız 35 işlem +3,2. Bugünkü 5'in 4'ü tekrar (FRIGO, HRKET, MARTI, YKSLN).
- Telegram'a gidenler (yaklaşık): Algı güçlü+rv≥2 10 işlem +4,9 (ALCAR ve DOCO iki kez — motor geçişinde AL.log sıfırlandı), geri alım seans içi 5 işlem +7,35 (DOFRB, SAHOL, TABGD, KGYO, ATAKP), tavan6 10 işlem −2,0 (ilk gün), Fırsat A AL 2 −0,54. Maliyet hariç.
- tavan6 açığı: TMPOL açılış +%3,1 (gap<6) ama 10:01 mesaj anında zaten tavandaydı (pre +9,96) → liste yalnız açılışa bakıyor.
- OMD (KAP üye kodu, OSMEN ile aynı bildirim) sig'e işlem görmeyen sembol olarak yazıldı (px boş).
- Motor: yeni Ana sunucu canlı (20:10). flow 15:35–16:28 boşluk (geçiş). Engelli eski iş PC motoru hâlâ her dakika bağlanmayı deniyor (dev.last 20:14, 1006). Duyuru sabitleme: botun yetkisi yok.
- flow × Momentum (12–16.10, 24 sinyal, 2 kazanan): 10:01–10:29 alıcılı payıyla düzen yok, örnek az.

## 6p. 17.10 (Cumartesi) GÜNLÜK GÖZDEN GEÇİRME
- Hafta 12–16.10 (+3/−1, ikisi yoksa gün sonu, 100.000 TL/işlem, kayma hariç): Momentum 24 sinyal 2 kazandı/20 kaybetti −14,3 puan (≈ −14.300 TL; h1 −15,4). tavan6 10 işlem −2,0; dunguclu 4 −3,8; sessiz 5 −2,1.
- Sağlık: err'de gerçek hata yok; üç zamanlayıcı canlı (20:13), sig_kill boş, kaph BİTTİ (geri 2421, içeriden 2808, yeni iş 908 metin). Motor son görülme Cuma ~20:10 (hafta sonu uyku; Pazartesi 09:15 uyanışını doğrula).
- Kanal kaydı tamam (pubch via app, sabitlenmiş tanıtım 17.10 03:00). uye tablosunda yalnız 1 kayıt (Fatih, ref k_giris) — dışarıdan üye henüz yok.
- Öneri (onay bekliyor): KAP yeni iş tutarı ÷ piyasa değeri araştırması, içeriden ALIŞ/SATIŞ ayrımı araştırması, Momentum tekrar eden hisseyi Telegram'dan çıkarma.

## 6q. 17.10 gece TELEGRAM BÜYÜME — DEVİR NOTU (GELİŞTİRİCİ, sohbet taşındı)
Yapılanlar (ayrıntı CLAUDE.md v12.2–v12.8): üye görünümü B (üyede canlı AL/hedef/stop yok), yeni aranabilir bot @BistPusulaBot (uygulama + hoş geldin + kanal; anahtar Cloudflare secret TG_APP_TOKEN),
eski @FatihBistSinyal2026Bot yalnız sinyal grubunda ('Pusula Trading'), kanal t.me/bistpusulatr (pubch via 'app'), davet bağlantısı (r_), kanal düğmeleri (k_), seans içi önemli KAP (günde ≤3), Pazar 'Haftaya bakış', ilk haftalık paylaşım elle gönderildi.
Zamanlanmış görevler: 'Pusula büyüme raporu' Pazar 19:55 (trig_01Gsu8uNSd98niHK3oggLowe), Pazartesi 09:22 ana sunucu uyanış kontrolü (trig_01REJzEwfubcsCM9rwvScd4m).
Fatih'in yapacakları (kanal açıklaması 'ücretsiz', fazla tanıtım mesajı, tepki/yorum ayarı): 17.10 22:42 Fatih 'bitti' dedi.
v12.9 (17.10 gece): kanal mesajlarına '📣 Arkadaşına gönder', bot karşılamasına '👥 Arkadaşını davet et' (r_) + '📢 Kanala katıl'. Fatih: 'botu sen tanıtacaksın' — Claude başka gruplara yazamaz (Telegram hesabı yok, bot davetsiz gruba giremez, spam); ilk kişileri Fatih tanıdık gruplara paylaşarak getirir, metni Claude hazırlar.
Onay BEKLEYEN (onaysız yapma): Algı'yı Telegram'dan çıkarmak; tavan6'yı sessize almak; Momentum tekrar eden hisseyi Telegram'dan çıkarmak.
İlk kontrol noktaları: Pazar 19:55 ilk otomatik 'Haftaya bakış' + büyüme raporu; Pazartesi 09:35 / 18:30 ilk otomatik kanal mesajları (meta pub_am / pub_pm / pub_wk / pub_kap, hata pubch_res).
Büyüme fikirleri (sırada): Fatih'in başka gruplara paylaşacağı tanıtım metni (ilk denemede 😢 tepki aldı → daha az 'reklam', daha çok somut fayda: 'KAP önemli haberleri tek yerde, ücretsiz'), davet sayısını (uye.ref) büyüme raporunda göstermek.
v12.8 veri paketi: 10.000 mum canlıda denenmedi; sorun olursa 5.000 öner.

## 7. Bekleyen / fikir
- Sinyal Karnesi 2–3 hafta birikince: kaynak, puan aralığı, saat, KAP türüne göre ayıkla. İlk gün (29.09): Fırsat B 4/5, A 0/1, radar 0/1, Algı 0 sinyal (kayıt yolu sağlam, sinyal çıkmamış).
- v6.6 (29.09 akşamı): karne özetinde "Filtre kontrolü" — endeks artı/eksi ve oynak/sakin ayrımı kendi sinyallerimizde. 1–2 hafta sonra bak; tutarsa sinyal kapısı öner.
- İçeriden alım-satım KAP'larında alış/satış ayrımı yok → detay uç noktası `/tr/api/notification/attachment-detail/{idx}` ile çözülebilir.
- Derinlik: TradingView'da BIST derinliği yok. İdeal (ideAlgo, C# robot, `Sistem.DerinlikVerisiOku`) — Fatih almayı düşünüyor; Windows PC gerekir.
  Önce sorulacaklar: hisse için kaç kademe (5 mi 25 mi), robottan HTTP isteği atılabiliyor mu, fiyat.
- Sosyal medya: şimdilik yok (BIST'te manipülasyon riski). İleride "anormal ilgi uyarısı".
- GitHub'da artık dal `v64-seans-sonrasi` kaldı (silme izni yoktu) — zararsız, main ile aynı.

## 6r. 19.10 (Pazartesi) GÜNLÜK GÖZDEN GEÇİRME (endeks −%2,5)
- Momentum BUGÜN 0 sinyal (Cuma −%2,9 sonrası dün ≥+%3 şartını geçen yok; dunguclu aynı pencerede çalıştı → motor 10:31'de canlıydı). sessiz/oglen yok.
- Telegram'a gidenler (yaklaşık, +3/−1, 100.000 TL/işlem, kayma hariç): Algı güçlü+rv≥2 2 işlem 0/2 (−2), Fırsat A 4 işlem 1/3 (0), tavan6 7 işlem 2/5 (+1), seans içi geri alım 5 işlem 3 kazandı (+7,6; KGYO/GENIL/NETCD/MARBL/TABGD — tekrar filtresi bazılarını elemiş olabilir). Toplam ≈ +6,6 puan.
- Tüm Algı 75 sinyal 4 kazandı, −51 puan. Piyasa değeri kırılımı (sig meta mc, 12–19.10, Algı 469): <5 Mr −0,18, 5–25 −0,24, 25–100 −0,25, 100+ −0,35/işlem → büyüklük filtresi Algı'yı kurtarmıyor. Fırsat B her dilimde −0,4…−0,65.
- KAP kaynaklı sinyallerde (sunucu sigAdd) pe/pb/mc YOK → temel oran kırılımı KAP için yapılamıyor.
- Sağlık: err yalnız 1 geçici KAP zaman aşımı (bakımda gürültü işaretli); cron 5-tamam, kap/sig yardımcıları canlı, sig_kill boş; motor bot_seen 18:59 (19:00 uyku); flow 96 satır 10:00–17:55; kaph bitti; uye 3; kanal pub_am/pub_pm gönderildi, pub_join 1.

## 6s. 20.10 (Salı) GÜNLÜK GÖZDEN GEÇİRME (endeks +%3,2)
- Momentum 1 sinyal (EDATA, sonuçsuz, gün sonu −0,9 → ≈ −900 TL). Canlı 05–20.10: 48 sinyal 9/34, −6,6 puan.
- Telegram'a gidenler (yaklaşık, +3/−1, ikisi yoksa gün sonu, kayma hariç): Algı güçlü+rv≥2 7 işlem 5/2 (+13), Fırsat B 12 (1/3, +4,6; endeks artı → Telegram'a gitti), Fırsat A 2 (+1,5), tavan6 6 işlem 1/5 (−2), seans içi geri alım 2 (TCKRC −1; KGYO tekrar).
- Algı Telegram (güçlü+rv≥2) 29.09–20.10: 58 işlem 15/31, +15,7 puan → 'Algı'yı Telegram'dan çıkar' önerisi şimdilik geri çekildi.
- tavan6 16–20.10: 23 işlem 5/18, −3 puan, ortalama gün sonu −2,4%; bugün endeks +%3,2 iken 4'ü −%6…−%10 kapandı (BIGTK, LIDER, PRZMA, MERCN).
- Gece KAP (09:59 giriş, 29.09'dan 1.599): 258/824, ort. +0,17 puan, gün sonu −0,22; stop olup ≥+%1 kapanan 126 → 'açılışta bekle' fikri zayıf, önerilmedi.
- Sağlık: err temiz (1 geçici KAP zaman aşımı, işaretli); üç zamanlayıcı canlı; karne 20:15'te hâlâ ölçüyordu (kalan 8, sigsum 21:00'e kadar); motor 18:59 (uyku); flow 96 satır/gün (~3,6 MB); kaph bitti.
- v13.5 algiB2Fill henüz başlamadı (29.09–19.10 Algı'nın o21'i boş, ~740 satır): sigBackfill yalnız karne ölçümü bitince çalışır; yarın dolmuş olmalı — dolmadıysa bak.

## 6t. 21.10 (Çarşamba) GÜNLÜK GÖZDEN GEÇİRME (endeks −%1,9; 52 yükselen / 569 düşen)
- Momentum 4 sinyal 2/2 (TGSAS, YKSLN +3; BORLS, ADGYO −1) → +4 puan ≈ +4.000 TL (100 bin/sinyal, kayma hariç). BORLS stop olup günü +%5 kapattı.
  Canlı 05–21.10: 52 sinyal 11/36, +3/−1 −2,6 puan; ±%1,5 (o15) +8,4; hedefsiz −1 (h1) −31; +4/−1 −11,6; +3/−1,5 −38,9. Endeks eksideyken 44 sinyal o15 +11,1, artıdayken 8 sinyal −2,7 (örnek az).
- Algı Telegram (güçlü+rv≥2) bugün 5 işlem 0/5 (JANTS +%2 gördü sonra −2,7). 29.09–21.10: 63 işlem 15/36 → +3/−1 +10,7; +2 kâr al +8,1; +2'de stop girişe (b2) +16,8. algiB2Fill bitti (yalnız 02.10'da 4 boş).
- Sessiz botlar 05–21.10: dunguclu 8 işlem 0/7 (−7,8); tavan6 33 işlem 7/26 (−5; ±1,5 ile −16,5); sessiz 14 (+4/−1 +10,8); oglen 3 (+4,3).
- KAP geri alım 05–21.10: SEANS İÇİ (10:00–17:30) 33 sinyal 11/9, +30 puan, ort. gün sonu +0,83; gece/seans dışı (09:59 giriş) 414 sinyal 68/308, −73.
- Fırsat bugün: B AL 0/13 (−13,3), B SAT 11/11 +41,6 (sert düşüş günü).
- Sağlık: err temiz (2 terminal toparlama), üç zamanlayıcı canlı, sigsum gönderildi, ana sunucu 18:59 (uyku), flow 95 satır/gün, kaph bitti (21.10 00:00). BORSA aracı bağlanmadı.
- HATA DÜZELTİLDİ: mkt_close 'dn' boştu (en kötü 60'ın hepsi taban/<100 Mn TL) → tavan.js tarama aralığı 200.

## 6u. 22.10 sabah EMA HEDEF MERDİVENİ ARAŞTIRMASI (Fatih + Nihat'ın kuralı; v14.3 emar tablosu, 29.09–21.10, yalnız AL, 1.385 sinyal)
- Soru: 15 dk AL sonrası üst zaman dilimi EMA 200'leri (30 dk → 1 sa → 2 sa → 4 sa) hedef/direnç mi? Ölçüm aynı gün 5 dk mumla, stop −%1. |uzaklık| > %15 (bölünme/bedelsiz kirliliği) atıldı.
- DİKKAT: Fırsat-A/B karne satırlarının çoğu SAT (dir) — ilk analizde karıştı; analizler s.dir='AL' ile yapılmalı.
- EMA 200'e ulaşma (4 zaman dilimi toplamı): uzaklık %0–0,5 → %66 stoptan önce ulaştı (ulaşanların %34'ü orada durdu, gerisi geçti); %0,5–1 → %31; %1–2 → %21 (stop %32); %2–4 → %7 (stop %44); %4+ → %1 (stop %53).
  → EMA 200 güçlü direnç DEĞİL (yakınsa çoğu geçiliyor); %1'den uzak seviyeler aynı gün nadiren geliyor.
- En güçlü bulgu (sinyal kalitesi): ilk üstteki EMA 200 girişe %1'den yakınsa sinyal neredeyse hiç +%3 yapmıyor: 197 sinyalde 7 hedef / 92 stop, 100.000 TL'lik işlemlerle −45.800 TL.
  %1–2: 133 → 8/58, −12.100; %2–4: 211 → 23/117, −19.100; %4+: 383 → 53/215, −1.400; fiyat bütün EMA 200'lerin üstünde (çoğu Fırsat AL): 328 → 18/194, −76.000 (ayrıca incelenmeli).
- Merdiven çıkış kuralı (ilk üstteki EMA 200, alt sınır %0,5) vs +%3/−%1, hedefi olan sinyallerde: tümü 891 işlem −46.100 TL vs −72.800 TL; Telegram'a gidenler 247 işlem −20.100 vs −33.300.
  İkisi de zararda; merdiven biraz daha az kaybettiriyor. Asıl sorun hedef değil, stopların çokluğu (%66).
- Öneri (Fatih onayı bekliyor, kural değişmeden): (1) Telegram sinyal kartına 'üstte %1'den yakın EMA 200 var — yukarı yer dar' uyarı satırı; (2) grafik not kartında 'üstteki EMA 200'ler' satırı. Filtre olarak kullanmak 3 Kasım değerlendirmesine.

## 6v. 22.10 (Perşembe) GÜNLÜK GÖZDEN GEÇİRME (endeks −%3,1)
- Momentum, dunguclu, sessiz, oglen BUGÜN 0 sinyal (dün −%1,9 sonrası şartı geçen yok; motor canlıydı: Algı 10:21'den, Fırsat 10:10'dan).
- Telegram'a gidenler (yaklaşık, +3/−1, 100.000 TL/işlem, kayma hariç): Algı güçlü+rv≥2 5 işlem 0/5 (BESTE, ARFYE, TAVHL, ULUFA, IZMDC; −5); tavan6 5 işlem 2/3 (+3); seans içi geri alım yalnız BLCYT (her gün bildiren → gitmemeli). Toplam ≈ −2 puan.
- Algı Telegram 29.09–22.10, sinyal anı endeksine göre (idx): ≥+0,3 → 22 işlem 8/11, +13,7; ≤−0,3 → 36 işlem 5/23, −8,3; arada 10 işlem −1,1. (Fırsat B'deki endeks kapısıyla aynı desen.)
- tavan6 05–22.10: 38 işlem 9/29, ≈ −2 puan.
- Sağlık: err temiz; üç zamanlayıcı canlı (20:13); sigsum, pub_am/pub_pm gönderildi; ana sunucu 19:00 uyku; flow 95 satır (bugün ilk dakika 10:07 — 10:00–10:06 boş, küçük); kaph güncel (22.10 00:00); emar bitti. BORSA aracı bağlanmadı.
- Öneri (onay bekliyor): Algı Telegram'a endeks kapısı (idx ≤ −0,3 iken gitmesin, karneye yazılsın); EMA 200 uyarı satırı (6u); tavan6'yı sessize almak.

## 6v. 22.10 gece SİNYAL KURTARMA ARAŞTIRMASI (Fatih: 'başarıya ulaşmamız lazım, nasıl?'; sig, 29.09–22.10, yalnız AL; A = 29.09–10.10 / B = 13–22.10; +3/−1, ikisi de yoksa gün sonu; D1 gruplama sorgularıyla, ~7k okuma/sorgu)
- Kaynak bazında (işlem başı): Algı −0,13 (1.034), Fırsat B −0,19 (335), Fırsat A −0,10 (30), Momentum −0,05 (52), tavan6 −0,05 (38). Sonuçlananların %15'i +3 (başabaş %25). Hiçbiri tek başına artı değil.
- Tek tek özellik (A/B): saat, fiyat seviyesi, oynaklık, hacim, piyasa değeri → tutarlı fark YOK. Endeks ≥+1 A +0,15 / B +0,63 ama yalnız 2 gün (05.10, 20.10) → gün etkisi. Son 2 saatte KAP haberi A +0,24 / B +0,49 (20/30, az).
- Endeks yönüyle kırılım (sinyal anı XU100 ≥0 / <0):
  · KAP GERİ ALIM, SEANS İÇİNDE YAYINLANAN: artı 17 sinyal +0,47, eksi 44 sinyal +0,99 (A +1,41 / B +0,68), isabet %43–52 → İKİ DÖNEMDE DE ARTI, düşen piyasada bile. En sağlam kaynak (v11.4'ten beri Telegram'da).
  · Algı Telegram (fc≥0,8, rv≥2): endeks artı 26 sinyal/6 gün A +0,46 / B +1,55 (hedefsiz +2,93); endeks eksi 42 sinyal A −0,91 / B −0,24. → 'endeks artıdayken' filtresi iki dönemde aynı yönde (geçmiş 14 ay feat bulgusu ile uyumlu: endeks etkisi 14 ayın 11'inde).
  · Fırsat B: eksi günde A −0,33 / B −0,49; artı günde A +0,26 / B −0,30 → güvenilmez. Fırsat A az ve eksi. Momentum canlıda ~0 (geçmiş 14 ayda +0,3–0,4). tavan6 ~0. Gece gelen geri alım = piyasa yönü (artı +0,36, eksi −0,31).
- ÖNERİ (Fatih onayı bekliyor): Telegram'a yalnız (1) seans içi geri alım (aynen), (2) Algı Telegram yalnız XU100 ≥ 0 iken, (3) Momentum izlemede kalsın; Fırsat A/B Telegram'dan çıksın (karneye yazmaya devam). Beklenen: günde ~4–5 sinyal, işlem başı +0,6…+0,9 (küçük örnek!). 2 hafta canlı deneme, %25 altına düşerse geri al.
- Stop şikâyeti (22.10): hesap doğru (−%1'e 1 dk mumda değmek = stop). Bugün 4 AL sinyali stoptan sonra +3 gördü; 5 TL altı hisselerde 1 kuruş = %0,2–1,3 → −%1 stop 1–2 kademe. Stop çeşitleri (kademe payı, 5 dk kapanış, −1,5) için mum yeniden ölçümü gerekir (sig'de yok) — ayrı iş.

## 6w. 23.10 (Cuma) GÜNLÜK GÖZDEN GEÇİRME (XU100 −%0,9; gün içi dip −%4,6, 15:50'den sonra toparlandı)
- v14.8 (endeks kapısı) 10:06'da yayınlandı ama motor sayfayı 09:40'ta yüklemişti → BUGÜN ESKİ KURAL ÇALIŞTI: Algı sig meta'sında 'tg' alanı hiç yok (yeni kod her zaman tg:0/1 yazar). Endeks bütün gün eksiydi; yeni kuralla hiç Algı gitmeyecekti.
  Telegram'a giden (yaklaşık, +3/−1, 100.000 TL/işlem, kayma hariç): Algı güçlü+rv≥2 13 işlem 0/8 (4 sonuçsuz, 1 bekliyor) −6,0; tavan6 (10:01, v14.8'den önce) 5 işlem 2/3 +3; seans içi geri alım SANFM −1, OZYSR −1 (stop sonrası tavan), ISVEA 0 (TAVANDA geldi, alınamaz), OYLUM ölçülmedi → toplam ≈ −5 puan (−5.000 TL). Momentum 0 sinyal.
  Bütün Algı (131, sessizler dahil) +72 puan / 107 ölçülen (o15 54/26) — dipten dönüş günü, tek gün.
- Sessiz botlar: dunguclu 2/2 stop (−2); momentum/oglen/sessiz yok.
- F/K kırılımı (12–23.10, algi+fırsat+momentum, 1.089 sinyal): F/K grubu tutarlı fark VERMİYOR; endeks artı/eksi her F/K grubunda belirleyici (artı 0…+0,7, eksi −0,07…−0,30).
- Sağlık: err temiz; üç zamanlayıcı canlı; motor 19:00 uykuda (normal); flow 96 satır/gün (büyüyor); kaph güncel; karne ölçümü 20:15'te hâlâ sürüyordu (46 kalan, 2 dk'da 5 hisse) → özet ~20:35'te.
- Öneri (onay bekliyor): sinyal meta'sına sürüm etiketi (v) + motorun yeni sürümü seans dışında hemen alması; seans içi geri alımda tavandaki (≥+%9,5) hisseyi Telegram'a göndermemek; stop kademe payı ölçümü (sessiz sütun).

## 6w. 24.10 sabah EMA 20 KURALI (arkadaşın gözlemi: 'Algı EMA 20 altında gelirse +%3 veriyor, EMA 50/200'e yakınsa gitmiyor'; v14.9 emar2, 1.163 Algı sinyali, 29.09–22.10, +3/−1, isabet = +3 / (+3 + stop))
- EMA 20'ye göre fiyatın yeri (A = 29.09–10.10 / B = 13–22.10):
  15 dk: EMA 20'nin %2+ üstü %8/%26 · %0,5–2 üstü %7/%16 · yakın %11/%14 · %0,5–2 ALTI %25/%24 · %2+ ALTI %40/%31.
  5 dk: altında (≥%0,5) %30 (68 sinyal) · üstünde %6–19. 60 dk: %2+ altında %30/%28 (264 sinyal, 17 gün) · üstünde %4–23.
- KURAL: 15 dk EMA 20'nin ≥%0,5 altında VE 15 dk EMA 50/200'e %1'den uzak → 163 sinyal, 16 gün, isabet %29 (A %36 / B %28); bunlardan Telegram'a gidenler (güçlü+rv≥2) 24 → %40; endeks artıyken 31 → %40, eksiyken %27.
  EMA 20 altında AMA EMA 50/200'e %1 yakın → 15 sinyal %11 (arkadaş haklı, örnek az). EMA 20 üstü/yakın → 985 sinyal %15 (başabaş %25 altında).
- Yorum: iki dönemde aynı yönde, 3 zaman diliminde tutarlı (geri çekilmede gelen para girişi, koşmuş hissede gelen değil). Örnek küçük, düşen piyasa ağırlıklı. Fatih onayı bekliyor: Telegram Algı'ya ek şart ya da önce sessiz ölçüm.

## 6y. 27.10 ALGI ALT GRUP ARAŞTIRMASI (Fatih: 'neden başarıyı yakalayamıyoruz'; 1.301 Algı, 29.09–26.10; eğitim 29.09–14.10 / deneme 15–26.10; çıkış: +3/−1 ve 'stop −1 yoksa gün sonu')
- Kaynak geneli (29.09–26.10, işlem başı, stop/hedef ne olursa olsun ~0 ya da eksi): Algı −0,03…−0,21, Fırsat B −0,19…−0,72, Momentum −0,08…−1,31, geri alım +0,10 (+3/−1). Algı sonrası ortalama en iyi +%1,71 / en kötü −%1,71 → GİRİŞTE YÖN ÜSTÜNLÜĞÜ YOK; çıkış oyunları kurtarmaz.
- Tek tek özellik (saat, endeks, rv, fc, akış, adr, p30, haber, piyasa değeri): iki dönemde AYNI yönde tutarlı fark yok (eğitim dönemi genel −0,21, deneme +0,07 → piyasa havası baskın).
- TUTARLI TEK AYRIM — KOVALAYAN vs GERİ ÇEKİLMEDE: 'VWAP üstü + kırılım' (abv & brk) = Algı'nın %71'i: stop/gün sonu eğitim −0,29 / deneme −0,01, gün sonu −0,56 / −0,29, artı gün 1/10 ve 3/8.
  Geri kalan %29 (VWAP altı ya da kırılımsız): eğitim +0,19 / deneme +0,18. VWAP altı (abv=0): +0,35 / +0,15, gün sonu +0,23 / +0,32. 15 dk EMA 20'nin ≥%2 altında: +0,69 / +0,63 (22 + 51 sinyal) — 6w EMA 20 bulgusuyla AYNI yön.
  Uyarı: fark küçük (+0,2…+0,4/işlem), artı gün oranı ~yarı yarıya, 18 iş günü; 'geri çekilme + endeks ≥0' eğitimde −0,02 / denemede +1,43 → tutarsız, kullanma.
- ÖNERİ (Fatih onayı bekliyor): Algı Telegram'a 'kovalayan' (VWAP üstü + kırılım) gitmesin; geri çekilmede gelen Algı + seans içi geri alım kalsın. Önce 2 hafta SESSİZ ölçüm (bot yarışı) ya da doğrudan Telegram kapısı — karar Fatih'in.

## 6z. 27.10 'VOLUME DELTA PIVOT MATRIX' (BigBeluga) FİKRİ — GERÇEK EMİR AKIŞIYLA TEST (flow tablosu, 12–26.10, 981 Algı sinyali, 5 dk mum, pivot ±3 mum, delta = alıcılı − satıcılı, güçlü = en güçlü aktif seviyenin ≥%30'u, kırılan seviye silinir)
- Güçlü ALICILI desteğe %1,5 yakın gelen Algı: 12–16.10 −0,26 / 19–26.10 +0,10 (stop −1, yoksa gün sonu) — 'destek yok' −0,21 / +0,13 → FARK YOK. Güçlü SATICILI direncin altında gelen: −0,03 / +0,07, direnç yok: −0,28 / +0,14 → tutarsız.
- Geri çekilme + destek birlikte: −0,35 / −0,20 (17 + 32) → geri çekilme tek başına daha iyi (−0,04 / +0,19). SONUÇ: göstergenin mantığı Algı'ya üstünlük katmıyor; eklenmedi.
- 27.10 akşam (Fatih HUBVC ekran görüntüsü: güçlü yeşil 1,97'ye değip +%8,6) → 'canlıda ölçelim': v14.27 sessiz kayıt src 'vdpm' (motor, 5 dk mum, güç ≥%80, net alıcılı ≥1 Mn TL, değ-dön). ~2–3 hafta sonra bot yarışında '🎯 Delta destek dönüşü' satırına bak (+%3/−%1, o31). Başabaş %25.

## 7a. 28.10 gece 'TERMİNALİ UÇUR' ARAŞTIRMASI (GELİŞTİRİCİ; canlı karne 29.09–27.10 + feat 13 ay)
- Canlı karne (AL, +3/−1 yoksa gün sonu): hiçbir kaynak başabaşı güvenilir geçmiyor — Algı A −0,21 / B +0,05 (isabet %18), kap-geri +0,37 / −0,24, Fırsat B −0,11 / −0,37, Momentum +0,03 / −0,18, tavan6 −0,13; günlük sonuç piyasanın yönünü izliyor (XU100 Ekim'de −%22).
  Ertesi gün tutma (sig ng/nc) de eksi. Endeks kovası × kovalayan/geri çekilme: gün sayısı çok az, tutarlı değil.
- feat (92 büyük hisse, 2025-08-22…2026-09-25, 276 gün), günlük eşit ağırlıklı ortalama: gece (kapanış→açılış) +0,12 (t 2,8, %70 artı gün), kapanış→10:30 +0,15 (t 3,0, %63), 10:30→kapanış −0,13 (t −1,9).
  Kümülatif: kapanışta al 10:30 sat +%49 (maliyetsiz; %0,05 maliyetle +%30), en derin düşüş −%13, 14 ayın 12'si artı (Mart −4,6, Eylül −12,3); 10:30 al kapanışta sat −%31; endeks +%14.
  Ekim 2026 endeks düzeyinde: gece toplamı −%0,4, gün içi ~−%11 (çöküşte bile gece çok daha iyi).
- Hisse kırılımı (kapanış→10:30, A <15.03 / B): dün <−%3 düşen −0,35/−0,96 (alma), normal +0,23/+0,20, 20g zirvesinde ~0, tavan kapanan +1,6…+2,5 (kapanışta alım gerçekleşmeyebilir), gün: Çarşamba→Perşembe en iyi (+0,46/+0,37), Cuma→Pazartesi en zayıf (+0,19/+0,13).
  Gün başı endeks bilgisiyle (ilk 30 dk, dünkü endeks, genişlik) 10:30→kapanış TAHMİN EDİLEMİYOR (korelasyon 0,03–0,10).
- 28.10 23:10 GERİYE DÖNÜK SEPET TESTİ (Fatih: 'geçmişe dönük test ettin mi'): feat, 274 gün, o gün −%3…+%9,5 arası kapanan hisseler (yayındaki eleme), her gün RASTGELE 8 hisse (3.000 deneme; gerçek kural 'en likit 8' — feat'te işlem hacmi yok, birebir test EDİLEMEDİ):
  maliyetsiz toplam medyan +%78 (en kötü %5: +%56), işlem başı %0,05 maliyetle +%55 (+%36), %0,1 ile +%35 (+%19); zarar eden deneme yok; en derin düşüş medyan −%8 (kötü %5: −%11); 14 ayın 11–12'si artı.
  Eleme önemli: elemesiz tüm hisseler +%49 / Eylül −12,3; elemeli Eylül +0,5. Ekim 2026 hisse verisi yok (feat 25.09'da bitiyor; BORSA servisi o an yanıt vermedi) → Ekim için yalnız endeks düzeyi (gece −%0,4 / gün içi −%11).
- KARAR (Fatih 'kur, yayınla'): v14.23 GECE KUŞU — 17:40 sepet (8 likit BIST 100 hissesi), kapanış seansında al, ertesi 10:25–10:30 sat; karne src 'gece'. 2–4 hafta canlı sonuç izlenecek; zirve eleme (20g yüksek alanı taramada yok) ve Çarşamba ağırlığı sonraki adım adayı.

- 28.10 23:45 YENİ STRATEJİ ARAMASI (Fatih: 'başka strateji bul'; feat 100 hisse 279 gün, D1'den tek sorguyla yerel; eski <15.03 / yeni ≥):
  Gün içi: ertesi gün 10:30→kapanış hiçbir alt grupta iki dönemde artı DEĞİL (hepsi −0,05 / −0,22). 5 günlük swing (d20, zirveye uzaklık): eski artı, yeni eksi → piyasa yönü, kenar yok.
  GECE İYİLEŞTİRMESİ (gün içi sıraya göre): sabahı güçlü (r30 üst çeyrek) + öğleden sonrası zayıf (rest alt yarı) → gece +0,34 / +0,45 (taban +0,22 / +0,24), 14/14 ay.
  Sepet: skor = r30 sırası − rest sırası, ilk 8, −3…+9,5 eleme; ÇIKIŞ AÇILIŞTA (ertesi açılış fiyatı): ort +0,28 (eski 0,29 / yeni 0,28), 13 ay toplam +%119 (maliyetsiz; %0,1 maliyetle +%66),
  en derin düşüş −%5,9, artı gün %78, 14/14 ay artı; en sık 10 hisse hariç +0,26. 10:30 çıkışı ort +0,33 ama düşüş −%8,4, artı gün %66. Rastgele 8 / 10:30: +%90 (ortanca).
  Öneri Fatih'e: Gece Kuşu v2 (seçim kuralı + açılış seansında satış) — ONAY BEKLİYOR. Canlıda 10:30 anlık fiyatı kaydetmek gerekir (meta). Ekim 2026 hisse verisi yok.

- 31.10 01:45 v2 EK TEST (feat): haftanın günü — Cuma akşamı alımı en zayıf (+0,09, 8/14 ay; en kötü gün 27.02 Cuma −5,9). CUMA HARİÇ ilk 8 / açılış çıkışı: +0,33/gece, 13 ay +%109 (maliyet %0,1 ile +%67), en derin düşüş −%2,0, artı gün %80, 14/14 ay, en kötü gece −1,9.
  Piyasa günü filtresi (o gün ortalama ±) iki dönemde tutarlı değil → eklenmez. İlk canlı deneme sepeti (28.10 → 30.10, tatil arası 2 gece): −%1,62 (8/8 eksi; ASELS +5,2 kapanmıştı → −5,1).
  Öneri: Gece Kuşu v2 = sabah güçlü/öğleden sonra zayıf ilk 8 + açılışta sat + Cuma ve tatil öncesi alım yok. ONAY BEKLİYOR.

- 31.10 02:00 EMİR AKIŞI (flow, 13 gün 12–30.10, 1,2M hisse-dakika, günlük ciro ≥100 Mn 234 hisse; ilk 7 gün / son 6 gün): son 5/15/30 dk alıcılı−satıcılı dengesi sonraki 15/30/60 dk getiriyi
  YÖNLÜ tahmin etmiyor (beşte birlikler U şekli, farklar ≤%0,1 < ortanca alış-satış farkı %0,1). Endeks gecikmesi (endeks 5 dk'da gitti, hisse geride kaldı → yetişir mi): yok, iki yarıda ters. → EMİR AKIŞINDA KENAR YOK (bu süre ve bu veriyle).
  Fatih Gece Kuşu'nu reddetti ('işe yaramaz'); kalan tek yeni bilgi adayı: aracı kurum dağılımı (AKD) / takas — lisanslı veri gerekir.

- 31.10 04:20 ÇOK YILLIK GÜNLÜK TEST (v14.26 gunluk tablosu, 132 kod, 2016-07..2026-10, %0,2 maliyet; scratchpad sw/bt.py): BIST 100 al-tut TL %29/yıl ($ −%1); en likit 60 eşit ağırlık %26,7; mevduat (yaklaşık) %22.
  52 hafta zirvesine en yakın 10 (haftalık) %41 / 7 yıl/11 — AMA hayatta kalma yanlılığı: 2016'da zaten büyük olan 40 hissede %33 vs eşit ağırlık %31,7 (fark yok). Momentum 12-1 eski 40'ta %39 vs %32 (7/11, 2. yarıda fark ~2 puan) → zayıf.
  Haftalık geri dönüş (en çok düşeni al) −%6/yıl. Endeks SMA200 zamanlaması getiriyi artırmıyor, yalnız düşüşü −%45 → −%25'e indiriyor. → Günlük/haftalık tutmada da sağlam kenar YOK.

- 31.10 06:25 DERİNLİK PLANI (Fatih onayıyla, yeni oturumda bilgisayara bağlı yapılacak): Telegram 'Ücretsiz Derinlik' botunun 10 hisseyi aynı anda gösteren penceresi ana sunucu bilgisayarında tam ekran açık kalır;
  bilgisayarda küçük bir okuyucu birkaç saniyede bir ekran görüntüsünden kademeleri okur (OCR), yalnız ÖZET (alış/satış ağırlığı, büyük duvar fiyatı/lotu) Pusula sunucusuna gider. En likit 10 hisse, 4 hafta yalnız kayıt (sinyal yok),
  sonra test: alış tarafı ağırken sonraki 5–15 dk getiri. İlk adım: 10'lu pencerenin ekran görüntüsü (yerleşimi görmek için). Fatih'e söylendi: bot tek tek hisse değiştirerek otomatik gezilmeyecek; tutmazsa kapatılır.
  31.10 07:00 ilk bakış (iş bilgisayarı DESKTOP-7RKA7LE, ekran okuma ile): Derinlik botu Telegram masaüstü değil, Chrome'da açık WEB mini uygulaması (Favorilerim listesi: fiyat, %, hacim, saat; alt menü Anasayfa/Kurumsal/Portföy/Diğer). 10'lu kademe ekranı henüz açılmadı (Cumartesi, piyasa kapalı).
  → Sayfa web olduğu için kademeler ekran OCR'ı yerine sayfanın içinden (DOM) okunabilir — daha doğru ve hafif; botun kullanım koşulları açısından Fatih'le konuşulacak. Bu bilgisayarda Claude Chrome eklentisi kurulmaya başlandı, giriş yapılmadı.
  Sıradaki (EV bilgisayarı = ana sunucu): Claude masaüstünde Computer use açık + Chrome'a Claude eklentisi (aynı hesap) → Fatih 10'lu derinlik ekranını açar → yerleşime bakılır → okuyucu (Node, pusula klasörü) + sunucuda derin tablosu (yalnız kayıt).

## 6x. 25.10 (Pazar) TRADINGVIEW HESAP RİSKİ (Fatih: 'TradingView beni engellemesin') — KARAR BEKLİYOR, kod değişmedi
- Durum: onaylı her cihaz (dev.ok=1) /tv-token + ?direct=1 ile TradingView'a FATİH'İN oturumuyla bağlanıyor → aynı anda 4–5 bağlantı (Fatih, Nihat/Almanya, adsız İstanbul iPhone, Ankara Android, Ana sunucu).
- A (önerildi): arkadaş cihazları oturumsuz (eski üye yolu, 15 dk gecikmeli fiyat); sinyaller sunucudan canlı ve aynı kalır.
- B (araştırıldı): Ana sunucu (motor, 200 hisse canlı) saniyede bir değişen fiyatları Cloudflare Durable Object 'yayın odası'na yollar, arkadaşlar odaya bağlanır (TradingView'a hiç bağlanmaz). Ücretsiz plan: DO 100k istek/gün, 13k GB-s/gün; gelen WS mesajı 20:1 sayılır → ~1.440 istek/gün, giden mesaj ücretsiz. Grafik geçmişi /bars, son mum odadan; motor yoksa gecikmeli yedek. Not: B tespit riskini azaltır, veri paylaşımını değil.
- Fatih: 'şimdilik böyle kalsın' — hiçbiri yapılmadı. Aynı gün dev tablosundan 11 ölü kayıt silindi (CLAUDE.md notu).

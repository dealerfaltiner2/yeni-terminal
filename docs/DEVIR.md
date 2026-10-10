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
  Tablolar: `meta` (k,v), `dev` (cihazlar + diag), `sig` (sinyal karnesi), `kap` (KAP bildirimleri), `feat` (araştırma verisi), `bars` (mum önbelleği — DOKUNMA, çok büyük), `bt` (eski, kullanılmıyor).
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
  Momentum ±1,5 → ±2 önerisi geçerli (6d). Betikler: tools/ml/ (pack.py SQL üretir, check.py doğrular, decode.py çözer, model.py + m2.py test); yeniden gerekirse mlpack tablosundan aynı biçimle çözülür.

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
  Geçmiş gün listesi de çalışıyor (byCriteria fromDate=toDate, ~100 KB/gün). v9.5 kaph.js 2025-10-01'den bugüne topluyor (seans dışında). Canlı karne: kap-geri 300 olay 75/163 (%31,5 > %25 başabaş), kap-is 8/30.

## 6k. 10.10 KEŞİF MOTORU (tools/ml/engine.py): 672.436 kural tek seferde (23 özellik × 9 eşik × 2 yön, tek ve ikili koşul) × 4 giriş saati (10:30/11:00/12:00/14:00) × 2 çıkış (+3/−1 ve hedefsiz −1)
- Matris çarpımıyla saniyeler içinde. Eğitim <2026-03-01, doğrulama 03-01..06-14, test ≥06-15. Eğitimde ilk 200 → doğrulamada > +0,3: 232 kural (ŞANS kontrolü: karıştırılmış sonuçla 6–13) → kalıcı yapı VAR.
  Ama 232'nin test ortalaması +0,03 (yarısı artı) — çoğu tesadüfe yakın. Not: test dönemine sıralamada bakıldı → bundan sonrası CANLI sessiz kayıtla doğrulanacak.
- Öne çıkan aile: 12:00 'TREND GÜNÜ' — endeks ≥ +0,8 VE hisse açılıştan ≥ +2: 919 işlem / yalnız 54 gün; işlem başı +0,38 (dönemler +0,32/+0,55/+0,33, 5 hisse hariç +0,33),
  eşik yüzeyi düzgün (açılıştan getiri ve endeks arttıkça artıyor). AMA gün ortalaması +0,18–0,23, günde en çok 3 seçilince +0,27 (5 hisse hariç +0,07) — kazanç birkaç güçlü güne yığılmış.
  → v9.7 sessiz kayıt 'oglen' (en çok 3, piyasa değeri ilk 120, değişim < +7, stop −1 hedefsiz). Diğer adaylar: 11:00 'd5≥5,9 & dün hacmi düşük (yvr≤0,49)', 'aralık dar & d20≥20' (sessiz trende benzer).

## 7. Bekleyen / fikir
- Sinyal Karnesi 2–3 hafta birikince: kaynak, puan aralığı, saat, KAP türüne göre ayıkla. İlk gün (29.09): Fırsat B 4/5, A 0/1, radar 0/1, Algı 0 sinyal (kayıt yolu sağlam, sinyal çıkmamış).
- v6.6 (29.09 akşamı): karne özetinde "Filtre kontrolü" — endeks artı/eksi ve oynak/sakin ayrımı kendi sinyallerimizde. 1–2 hafta sonra bak; tutarsa sinyal kapısı öner.
- İçeriden alım-satım KAP'larında alış/satış ayrımı yok → detay uç noktası `/tr/api/notification/attachment-detail/{idx}` ile çözülebilir.
- Derinlik: TradingView'da BIST derinliği yok. İdeal (ideAlgo, C# robot, `Sistem.DerinlikVerisiOku`) — Fatih almayı düşünüyor; Windows PC gerekir.
  Önce sorulacaklar: hisse için kaç kademe (5 mi 25 mi), robottan HTTP isteği atılabiliyor mu, fiyat.
- Sosyal medya: şimdilik yok (BIST'te manipülasyon riski). İleride "anormal ilgi uyarısı".
- GitHub'da artık dal `v64-seans-sonrasi` kaldı (silme izni yoktu) — zararsız, main ile aynı.

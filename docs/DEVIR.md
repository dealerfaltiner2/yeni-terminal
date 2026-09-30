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

## 7. Bekleyen / fikir
- Sinyal Karnesi 2–3 hafta birikince: kaynak, puan aralığı, saat, KAP türüne göre ayıkla. İlk gün (29.09): Fırsat B 4/5, A 0/1, radar 0/1, Algı 0 sinyal (kayıt yolu sağlam, sinyal çıkmamış).
- v6.6 (29.09 akşamı): karne özetinde "Filtre kontrolü" — endeks artı/eksi ve oynak/sakin ayrımı kendi sinyallerimizde. 1–2 hafta sonra bak; tutarsa sinyal kapısı öner.
- İçeriden alım-satım KAP'larında alış/satış ayrımı yok → detay uç noktası `/tr/api/notification/attachment-detail/{idx}` ile çözülebilir.
- Derinlik: TradingView'da BIST derinliği yok. İdeal (ideAlgo, C# robot, `Sistem.DerinlikVerisiOku`) — Fatih almayı düşünüyor; Windows PC gerekir.
  Önce sorulacaklar: hisse için kaç kademe (5 mi 25 mi), robottan HTTP isteği atılabiliyor mu, fiyat.
- Sosyal medya: şimdilik yok (BIST'te manipülasyon riski). İleride "anormal ilgi uyarısı".
- GitHub'da artık dal `v64-seans-sonrasi` kaldı (silme izni yoktu) — zararsız, main ile aynı.

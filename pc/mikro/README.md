# Mikro motor (derinlik + işlem akışı)

21.11 planı (Fatih onayı). Ev bilgisayarında çalışır; Cloudflare'e yalnız sinyal ve sonuç gider.

```
MatriksIQ robotu (yalnız veri taşır) → 127.0.0.1 → adapters/<sağlayıcı>.mjs → NormalizedMarketEvent → engine.mjs
```

| Dosya | Görevi |
|---|---|
| `schema.mjs` | İç veri şeması ve doğrulama. **Sağlayıcıdan bağımsız.** |
| `adapters/replay.mjs` | Kayıtlı günü geri oynatma (test, eşik ayarı) |
| `adapters/matriks.mjs` | *(1 Aralık)* Matriks ham verisi → şema. Veri biçimi değişirse **yalnız bu dosya** değişir |
| `book.mjs` | Emir defteri: fiyata göre kademe, emir yaşı, erime / iptal ayrımı, spoofing izi |
| `tape.mjs` | İşlem akışı: agresör tarafı, günlük VWAP, normal alım hızı, 1 dk oynaklık |
| `metrics.mjs` | OBI 3/5/10, delta, hız, spread, boşluk, erime süresi (saf fonksiyonlar) |
| `gates.mjs` | Risk ve rejim kapıları |
| `score.mjs` | Güven skoru 0–100, giriş / hedef / stop |
| `engine.mjs` | Aday → teyit durum makinesi, bayat veri / kopma koruması |
| `outcome.mjs` | 30 sn / 1 dk / 3 dk sonuç, H1 / H2 / stop / süre / kaçtı |
| `config.mjs` | Varsayılan eşikler (sunucudan `mikro_cfg` ile ezilir) |

Testler: `node tests/mikro.mjs` (run.sh içinde).

Sıradaki (1 Aralık): `adapters/matriks.mjs`, `ingest.mjs` (yerel sunucu), `sink.mjs` (toplu gönderim + yerel ham kayıt),
`context.mjs` (Pusula'nın 15 dk / 4 sa bağlamı), `pc/matriks/PusulaAkis.cs`, `worker/src/mikro.js` + D1 tablo `mikro`.

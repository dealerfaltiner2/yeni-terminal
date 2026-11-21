// MİKRO MOTOR — varsayılan eşikler (21.11 planı, Fatih onayı). Hepsi başlangıç değeri:
// 1 Aralık'ta gerçek Matriks verisiyle ayarlanacak. Sunucudan (D1 meta 'mikro_cfg') ezilebilir → cfgMerge.
export const MIKRO_DEF = {
  levels: 10,              // derinlikte kullanılan kademe sayısı
  obiTau: 3000,            // OBI yumuşatma zaman sabiti (ms)
  obi3Min: 0.35, obi5Min: 0.25, obi10Min: 0.15,   // aday eşikleri (OBI 10 yalnız puanda)
  obi3Keep: 0.20,          // teyit penceresinde OBI 3 bunun altına düşmemeli
  drCand: 0.30,            // aday: son 10 sn alıcılı/satıcılı dengesi
  drConf: 0.60,            // teyit penceresindeki denge
  confWin: 3000,           // teyit penceresi (ms) — 1000…3000
  confMinTL: 150000,       // teyit penceresinde en az alıcılı işlem (TL)
  confBaseMult: 2,         // … ve normalin en az bu katı
  hizFull: 3,              // hız bu kata ulaşınca puan tam
  erimeOran: 0.60,         // satış₁ TL'sinin en az bu kadarı işlemle erimeli
  erimeStepOran: 0.30,     // ya da satış₁ bitti + fiyat adım attı (işlemle eriyen en az bu oran)
  spreadMaxT: 1, spreadMaxTLow: 2, lowPx: 20, spreadMaxPct: 0.20,
  clearStrong: 8, clearMax: 15,                    // erime süresi (sn)
  bigMult: 3, bigMinTL: 500000,                    // büyük emir: ortanca kademenin 3 katı ve ≥ 500 bin TL
  youngMs: 2000,           // 2 sn'den genç büyük emir OBI'de tam sayılmaz
  spoofAgeMs: 5000, spoofFarT: 2, spoofWin: 300000, spoofHi: 0.5,
  graceMs: 400,            // kademe azalması ile işlemin geliş sırası farkı (işlem sonra gelebilir)
  maxChase: 3,             // günlük VWAP'tan en çok +%3 uzakta
  ttlMs: 20000, t1Pct: 0.5, t1MinT: 3, t2Pct: 1.0, stopMaxPct: 1.0, stopDefPct: 0.6, timeStopMs: 180000, kactiT: 2,
  hbMaxMs: 3000, bookStaleMs: 2000, warmMs: 60000, skewMs: 1500,
  openFrom: 580, openTo: 605, closeFrom: 1075,    // dakika (İstanbul): 09:40–10:05 yok, 17:55 sonrası yok
  volMult: 3, volScoreMin: 85, idx5mMin: -0.7,
  spreadHardT: 2, spreadHardPct: 0.25, minAdv: 50e6, tavanNear: 1, tabanNear: 1,
  coolMs: 600000, coolStopMs: 1800000, maxHour: 6, maxDay: 20, brakeStops: 2,
  baseWinMs: 1200000, baseSliceMs: 3000, baseFloorTL: 20000,   // normal hız: son 20 dk, 3 sn dilimler (taban 20 bin TL/3 sn)
  tgScore: 70, shadow: true, blokThrottleMs: 60000,
};
// Sunucudan gelen ayarı yalnız bilinen ve sayısal/mantıksal alanlarla birleştir.
export function cfgMerge(o) {
  const c = { ...MIKRO_DEF };
  if (o && typeof o === 'object') for (const k of Object.keys(MIKRO_DEF)) {
    const v = o[k], d = MIKRO_DEF[k];
    if (typeof d === 'number' && typeof v === 'number' && isFinite(v)) c[k] = v;
    else if (typeof d === 'boolean' && typeof v === 'boolean') c[k] = v;
  }
  return c;
}

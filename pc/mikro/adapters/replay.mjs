// Geri oynatma adaptörü: kayıtlı NormalizedMarketEvent satırlarını (JSONL) olduğu gibi verir.
// Eşik ayarı ve testler için. Gerçek sağlayıcı adaptörü (matriks.mjs) aynı arayüzü uygular: toEvents(ham) → NormalizedMarketEvent[]
export const name = 'replay';
export function toEvents(line) {
  if (!line || !String(line).trim()) return [];
  try { const o = typeof line === 'string' ? JSON.parse(line) : line; return Array.isArray(o) ? o : [o]; } catch (e) { return []; }
}
// Bütün bir günü motora sırayla ver; tick'i olay zamanına göre saniyede bir çağır
export function replay(lines, engine) {
  let lastTick = 0;
  for (const l of lines) for (const ev of toEvents(l)) {
    if (ev && typeof ev.rts === 'number') { if (!lastTick) lastTick = ev.rts; while (ev.rts - lastTick >= 1000) { lastTick += 1000; engine.tick(lastTick); } }
    engine.onEvent(ev);
  }
}

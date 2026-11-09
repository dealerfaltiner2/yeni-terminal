// Pusula Derinlik — MatriksIQ robotu (09.11)
// Ne yapar: Seçilen hisselerin derinlik (kademe) verisini dakikada bir okur, Pusula sunucusuna (/derin) yollar.
// Emir GÖNDERMEZ. Sunucu adresi ve sahip kodu bilgisayardaki BistMotor\ayar.json'dan okunur (kodda sır yok).
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Net;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Matriks;
using Matriks.Data.Symbol;
using Matriks.Engines;
using Matriks.Symbols;
using Matriks.AlgoTrader;
using Matriks.Lean.Algotrader.AlgoBase;
using Matriks.Lean.Algotrader.Models;
using Matriks.Lean.Algotrader.Trading;

namespace Matriks.Lean.Algotrader
{
    public class PusulaDerinlik : MatriksAlgo
    {
        [Parameter("AKBNK,ALARK,ASELS,ASTOR,BIMAS,DOAS,EKGYO,ENKAI,EREGL,FROTO,GARAN,GUBRF,HEKTS,ISCTR,KCHOL,KONTR,KOZAL,KRDMD,MGROS,OYAKC,PETKM,PGSUS,SAHOL,SASA,SISE,TAVHL,TCELL,THYAO,TOASO,TUPRS,YKBNK")]
        public string Semboller;

        [Parameter(10)]
        public int Kademe;

        [Parameter(60)]
        public int Saniye;

        List<string> syms = new List<string>();
        string url = null;
        int hata = 0, gonderilen = 0;

        public override void OnInit()
        {
            syms = Semboller.Split(new[] { ',', ';', ' ' }, StringSplitOptions.RemoveEmptyEntries)
                            .Select(x => x.Trim().ToUpperInvariant()).Distinct().ToList();
            foreach (var s in syms)
            {
                AddSymbol(s, SymbolPeriod.Min);
                AddSymbolMarketDepth(s);
            }
            SetTimerInterval(Saniye);
            url = AdresOku();
            Debug("Pusula Derinlik: " + syms.Count + " hisse, " + Kademe + " kademe, " + Saniye + " sn. Sunucu: " + (url == null ? "BULUNAMADI" : "hazır"));
        }

        public override void OnDataUpdate(BarDataEventArgs barData) { }

        // BistMotor\ayar.json → "tvproxy": "wss://alan/ANAHTAR", "ownTok": "KOD"
        string AdresOku()
        {
            try
            {
                var yol = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "BistMotor", "ayar.json");
                var t = File.ReadAllText(yol).Replace("\\\"", "\"");
                var p = Regex.Match(t, "\"tvproxy\"\\s*:\\s*\"+(wss?://[^\"]+)\"");
                var o = Regex.Match(t, "\"ownTok\"\\s*:\\s*\"+([A-Za-z0-9_\\-]+)\"");
                if (!p.Success || !o.Success) { Debug("ayar.json okunamadı (tvproxy/ownTok yok)"); return null; }
                var b = p.Groups[1].Value.Replace("wss://", "https://").Replace("ws://", "http://").TrimEnd('/');
                return b + "/derin?own=" + Uri.EscapeDataString(o.Groups[1].Value);
            }
            catch (Exception e) { Debug("ayar.json hatası: " + e.Message); return null; }
        }

        static string N(object v)
        {
            return Convert.ToDouble(v, CultureInfo.InvariantCulture).ToString("0.####", CultureInfo.InvariantCulture);
        }

        public override void OnTimer()
        {
            try
            {
                var tr = DateTime.UtcNow.AddHours(3);
                int m = tr.Hour * 60 + tr.Minute;
                if (tr.DayOfWeek == DayOfWeek.Saturday || tr.DayOfWeek == DayOfWeek.Sunday || m < 600 || m > 1090) return;
                if (url == null) { url = AdresOku(); if (url == null) return; }

                var sb = new StringBuilder();
                sb.Append("{\"v\":1,\"src\":\"matriks\",\"t\":").Append(DateTimeOffset.UtcNow.ToUnixTimeSeconds()).Append(",\"s\":{");
                int n = 0;
                foreach (var s in syms)
                {
                    var d = GetMarketDepth(s);
                    if (d == null || d.BidRows == null || d.AskRows == null) continue;
                    if (n > 0) sb.Append(',');
                    sb.Append('"').Append(s).Append("\":{\"b\":[");
                    int k = 0;
                    foreach (var r in d.BidRows) { if (k >= Kademe) break; if (k > 0) sb.Append(','); sb.Append('[').Append(N(r.Price)).Append(',').Append(N(r.Size)).Append(']'); k++; }
                    sb.Append("],\"a\":[");
                    k = 0;
                    foreach (var r in d.AskRows) { if (k >= Kademe) break; if (k > 0) sb.Append(','); sb.Append('[').Append(N(r.Price)).Append(',').Append(N(r.Size)).Append(']'); k++; }
                    sb.Append("]}");
                    n++;
                }
                sb.Append("}}");
                if (n == 0) { Debug("Derinlik verisi gelmedi (paket derinlik içeriyor mu?)"); return; }

                var hedef = url + "&d=" + tr.ToString("yyyy-MM-dd") + "&m=" + m + "&n=" + n;
                var govde = sb.ToString();
                Task.Run(() =>
                {
                    try
                    {
                        using (var wc = new WebClient())
                        {
                            wc.Encoding = Encoding.UTF8;
                            wc.Headers[HttpRequestHeader.ContentType] = "application/json";
                            wc.UploadString(hedef, "POST", govde);
                        }
                        gonderilen++;
                        if (gonderilen == 1 || gonderilen % 30 == 0) Debug("Gönderildi: " + n + " hisse (" + gonderilen + ". kez)");
                    }
                    catch (Exception e) { hata++; if (hata <= 3 || hata % 20 == 0) Debug("Gönderim hatası: " + e.Message); }
                });
            }
            catch (Exception e) { Debug("Derinlik okuma hatası: " + e.Message); }
        }

        public override void OnStopped() { Debug("Pusula Derinlik durdu. Gönderilen: " + gonderilen + ", hata: " + hata); }
    }
}

using System;
using System.Collections.Generic;
using System.Linq;
using Matriks.Data.Symbol;
using System.Windows.Media;
using Matriks.Engines;
using Matriks.Indicators;
using Matriks.Symbols;
using Matriks.AlgoTrader;
using Matriks.Trader.Core;
using Matriks.Trader.Core.Fields;
using Matriks.Trader.Core.TraderModels;
using Matriks.Lean.Algotrader.AlgoBase;
using Matriks.Lean.Algotrader.Models;
using Matriks.Lean.Algotrader.Trading;
using Matriks.Data.Tick;
using Matriks.Enumeration;
using Matriks.IntermediaryInstitutionAnalysis.Enums;
using Newtonsoft.Json;

// Pusula Derinlik — seçilen hisselerin ilk 10 kademesini dakikada bir Pusula sunucusuna yollar. Emir GÖNDERMEZ.
namespace Matriks.Lean.Algotrader
{
    public class PusulaDerinlik : MatriksAlgo
    {
        // MatriksIQ sonuç ekranı ana sembol ister (yoksa NullReferenceException)
        [SymbolParameter("GARAN")]
        public string Symbol;

        [Parameter("AKBNK,ALARK,ASELS,ASTOR,BIMAS,DOAS,EKGYO,ENKAI,EREGL,FROTO,GARAN,GUBRF,HEKTS,ISCTR,KCHOL,KONTR,KOZAL,KRDMD,MGROS,OYAKC,PETKM,PGSUS,SAHOL,SASA,SISE,TAVHL,TCELL,THYAO,TOASO,TUPRS,YKBNK")]
        public string Semboller;

        [Parameter(10)]
        public int Kademe;

        [Parameter(60)]
        public int Saniye;

        System.Collections.Generic.List<string> syms = new System.Collections.Generic.List<string>();
        string url = null;
        int hata = 0, gonderilen = 0;

        public override void OnInit()
        {
            AddSymbol(Symbol, SymbolPeriod.Min);
            foreach (var x in Semboller.Split(new[] { ',', ';', ' ' }, System.StringSplitOptions.RemoveEmptyEntries))
            {
                var s = x.Trim().ToUpperInvariant();
                if (s.Length > 0 && !syms.Contains(s)) syms.Add(s);
            }
            foreach (var s in syms)
            {
                if (s != Symbol) AddSymbol(s, SymbolPeriod.Min);
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
                var yol = System.IO.Path.Combine(System.Environment.GetFolderPath(System.Environment.SpecialFolder.LocalApplicationData), "BistMotor", "ayar.json");
                var t = System.IO.File.ReadAllText(yol).Replace("\\\"", "\"");
                var p = System.Text.RegularExpressions.Regex.Match(t, "\"tvproxy\"\\s*:\\s*\"+(wss?://[^\"]+)\"");
                var o = System.Text.RegularExpressions.Regex.Match(t, "\"ownTok\"\\s*:\\s*\"+([A-Za-z0-9_\\-]+)\"");
                if (!p.Success || !o.Success) { Debug("ayar.json okunamadı (tvproxy/ownTok yok)"); return null; }
                var b = p.Groups[1].Value.Replace("wss://", "https://").Replace("ws://", "http://").TrimEnd('/');
                return b + "/derin?own=" + System.Uri.EscapeDataString(o.Groups[1].Value);
            }
            catch (System.Exception e) { Debug("ayar.json hatası: " + e.Message); return null; }
        }

        static string N(object v)
        {
            var ci = System.Globalization.CultureInfo.InvariantCulture;
            return System.Convert.ToDouble(v, ci).ToString("0.####", ci);
        }

        public override void OnTimer()
        {
            try
            {
                var tr = System.DateTime.UtcNow.AddHours(3);
                int m = tr.Hour * 60 + tr.Minute;
                if (tr.DayOfWeek == System.DayOfWeek.Saturday || tr.DayOfWeek == System.DayOfWeek.Sunday || m < 600 || m > 1090) return;
                if (url == null) { url = AdresOku(); if (url == null) return; }

                var sb = new System.Text.StringBuilder();
                sb.Append("{\"v\":1,\"src\":\"matriks\",\"t\":").Append(System.DateTimeOffset.UtcNow.ToUnixTimeSeconds()).Append(",\"s\":{");
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
                System.Threading.Tasks.Task.Run(() =>
                {
                    try
                    {
                        using (var wc = new System.Net.WebClient())
                        {
                            wc.Encoding = System.Text.Encoding.UTF8;
                            wc.Headers[System.Net.HttpRequestHeader.ContentType] = "application/json";
                            wc.UploadString(hedef, "POST", govde);
                        }
                        gonderilen++;
                        if (gonderilen == 1 || gonderilen % 30 == 0) Debug("Gönderildi: " + n + " hisse (" + gonderilen + ". kez)");
                    }
                    catch (System.Exception e) { hata++; if (hata <= 3 || hata % 20 == 0) Debug("Gönderim hatası: " + e.Message); }
                });
            }
            catch (System.Exception e) { Debug("Derinlik okuma hatası: " + e.Message); }
        }

        public override void OnStopped() { Debug("Pusula Derinlik durdu. Gönderilen: " + gonderilen + ", hata: " + hata); }
    }
}

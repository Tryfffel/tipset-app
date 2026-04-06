import { useState, useMemo, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell
} from "recharts";

// ── Config ────────────────────────────────────────────────────────────────────
//
// Peka BOT_URL mot din bots JSON-endpoint när den är klar.
// Lämna som null för att använda fallback-data nedan.
//
const BOT_URL = null; // ex: "https://raw.githubusercontent.com/ditt-repo/bot/main/coupon.json"

// ── Fallback-data (används när BOT_URL är null) ───────────────────────────────

const FALLBACK_COUPON = {
  product: "europatipset",
  draw_number: 2564,
  matches: [
    { nr:1,  home:"Real Madrid",          away:"Bayern München",   folk:"31/25/44", model:"42/22/35", value:1.17, recommendation:"12",  type:"half"  },
    { nr:2,  home:"Sporting",             away:"Arsenal",          folk:"19/26/55", model:"19/26/55", value:1.00, recommendation:"2",   type:"spike" },
    { nr:3,  home:"PSG",                  away:"Liverpool",        folk:"56/23/21", model:"26/21/53", value:1.99, recommendation:"1X2", type:"full"  },
    { nr:4,  home:"Barcelona",            away:"Atlético Madrid",  folk:"63/19/18", model:"51/23/26", value:1.36, recommendation:"1X2", type:"full"  },
    { nr:5,  home:"Braga",                away:"Real Betis",       folk:"37/29/34", model:"37/29/34", value:1.00, recommendation:"1X",  type:"half"  },
    { nr:6,  home:"Wrexham",              away:"Southampton",      folk:"35/28/37", model:"35/28/37", value:1.00, recommendation:"12",  type:"half"  },
    { nr:7,  home:"Port Vale",            away:"Rotherham",        folk:"38/29/33", model:"38/29/33", value:1.00, recommendation:"1",   type:"spike" },
    { nr:8,  home:"Bromley",              away:"Shrewsbury",       folk:"55/27/18", model:"55/27/18", value:1.00, recommendation:"1",   type:"spike" },
    { nr:9,  home:"Ayr United",           away:"Dunfermline",      folk:"33/33/33", model:"33/33/33", value:1.00, recommendation:"1X",  type:"half"  },
    { nr:10, home:"Montrose",             away:"Cove Rangers",     folk:"33/33/33", model:"33/33/33", value:1.00, recommendation:"1X",  type:"half"  },
    { nr:11, home:"Always Ready",         away:"LDU Quito",        folk:"37/28/35", model:"37/28/35", value:1.00, recommendation:"1",   type:"spike" },
    { nr:12, home:"Deportivo La Guaira",  away:"Fluminense",       folk:"19/26/56", model:"19/26/56", value:1.00, recommendation:"2",   type:"spike" },
    { nr:13, home:"Universidad Católica", away:"Boca Juniors",     folk:"26/30/44", model:"26/30/44", value:1.00, recommendation:"2",   type:"spike" },
  ],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const SIGN_ORDER = ["1", "X", "2"];

function parseRec(rec) {
  return SIGN_ORDER.filter(s => rec.includes(s));
}

function valueColor(v) {
  if (v > 1.2) return "#22c55e";
  if (v > 1.0) return "#eab308";
  return "#4b5563";
}

function typeMeta(type) {
  if (type === "spike") return { icon: "🔒", label: "Spik" };
  if (type === "half")  return { icon: "🔀", label: "Halv" };
  return                       { icon: "🔥", label: "Hel"  };
}

function computeSystem(matches) {
  const c = { S: 0, H: 0, HG: 0 };
  matches.forEach(m => {
    if (m.sel.length === 1) c.S++;
    else if (m.sel.length === 2) c.H++;
    else c.HG++;
  });
  return [c.S && `${c.S}S`, c.H && `${c.H}H`, c.HG && `${c.HG}HG`].filter(Boolean).join("+");
}

function roiPct(cost, win) {
  return Math.round(((win - cost) / cost) * 100);
}

function fmtSEK(n) {
  return new Intl.NumberFormat("sv-SE").format(n) + " kr";
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// ── Tooltip ───────────────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div style={{
      background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 8,
      padding: "10px 14px", fontSize: 12, color: "#e5e7eb",
    }}>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>{label} · {d.product}</div>
      <div style={{ color: "#6b7280" }}>Insats: <span style={{ color: "#e5e7eb" }}>{fmtSEK(d.cost)}</span></div>
      <div style={{ color: "#6b7280" }}>Vinst:  <span style={{ color: "#e5e7eb" }}>{fmtSEK(d.winnings)}</span></div>
      <div style={{ marginTop: 6, fontWeight: 700, color: d.roi >= 0 ? "#22c55e" : "#ef4444" }}>
        ROI {d.roi >= 0 ? "+" : ""}{d.roi}%
      </div>
    </div>
  );
};

// ── PctBar ────────────────────────────────────────────────────────────────────

function PctBar({ str }) {
  const [a, b, c] = str.split("/").map(Number);
  const max = Math.max(a, b, c);
  return (
    <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
      {[a, b, c].map((v, i) => (
        <div key={i} style={{ textAlign: "center", minWidth: 28 }}>
          <div style={{
            height: 3, borderRadius: 2, marginBottom: 3,
            background: v === max ? "#3b82f6" : "#2a2a2a",
            width: `${v}%`, maxWidth: 28,
            opacity: v === max ? 1 : 0.5,
          }} />
          <span style={{ fontSize: 11, color: v === max ? "#e5e7eb" : "#4b5563", fontVariantNumeric: "tabular-nums" }}>
            {v}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────

export default function App() {
  const [view, setView]       = useState("coupon");
  const [coupon, setCoupon]   = useState(null);
  const [loading, setLoading] = useState(!!BOT_URL);
  const [error, setError]     = useState(null);
  const [matches, setMatches] = useState([]);
  const [history, setHistory] = useState([]);
  const [toast, setToast]     = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editVal, setEditVal]     = useState("");
  const [histFilter, setHistFilter] = useState("all");

  // ── Fetch coupon from bot or use fallback
  useEffect(() => {
    if (!BOT_URL) {
      initCoupon(FALLBACK_COUPON);
      return;
    }
    setLoading(true);
    fetch(BOT_URL)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(data => { initCoupon(data); setLoading(false); })
      .catch(err => { setError(err.message); initCoupon(FALLBACK_COUPON); setLoading(false); });
  }, []);

  function initCoupon(data) {
    setCoupon(data);
    setMatches(data.matches.map(m => ({ ...m, sel: parseRec(m.recommendation) })));
  }

  // ── Coupon
  const totalRows = useMemo(() => matches.reduce((a, m) => a * m.sel.length, 1), [matches]);
  const systemStr = useMemo(() => computeSystem(matches), [matches]);

  const toggleSign = (nr, sign) => {
    setMatches(prev => prev.map(m => {
      if (m.nr !== nr) return m;
      const has = m.sel.includes(sign);
      if (has && m.sel.length === 1) return m;
      const next = has
        ? m.sel.filter(s => s !== sign)
        : [...m.sel, sign].sort((a, b) => SIGN_ORDER.indexOf(a) - SIGN_ORDER.indexOf(b));
      return { ...m, sel: next };
    }));
  };

  const resetMatch = (nr) =>
    setMatches(prev => prev.map(m => m.nr === nr ? { ...m, sel: parseRec(m.recommendation) } : m));

  // ── Toast
  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2800);
  };

  // ── Save round
  const saveRound = () => {
    if (!coupon) return;
    const alreadySaved = history.some(h => h.round === coupon.draw_number);
    if (alreadySaved) {
      showToast(`Omgång #${coupon.draw_number} är redan sparad`, "warning");
      return;
    }
    const entry = {
      id: Date.now(),
      round: coupon.draw_number,
      product: coupon.product,
      date: todayStr(),
      cost: totalRows,
      system: systemStr,
      winnings: 0,
      signs: matches.map(m => ({ nr: m.nr, sel: [...m.sel] })),
    };
    setHistory(prev => [entry, ...prev]);
    showToast(`Omgång #${coupon.draw_number} sparad — ${totalRows} rader · ${fmtSEK(totalRows)}`);
  };

  // ── Edit winnings
  const startEdit = (id, currentVal) => { setEditingId(id); setEditVal(String(currentVal)); };
  const commitEdit = (id) => {
    const val = parseInt(editVal, 10);
    if (!isNaN(val) && val >= 0) {
      setHistory(prev => prev.map(h => h.id === id ? { ...h, winnings: val } : h));
      showToast("Vinst uppdaterad");
    }
    setEditingId(null);
    setEditVal("");
  };
  const deleteRound = (id) => { setHistory(prev => prev.filter(h => h.id !== id)); showToast("Omgång borttagen", "warning"); };

  // ── History calcs
  const filtered = histFilter === "all" ? history : history.filter(h => h.product === histFilter);
  const chartData = [...filtered].reverse().map(h => ({
    round: `#${h.round}`, product: h.product,
    cost: h.cost, winnings: h.winnings, roi: roiPct(h.cost, h.winnings),
  }));
  const totalIn  = filtered.reduce((a, h) => a + h.cost, 0);
  const totalOut = filtered.reduce((a, h) => a + h.winnings, 0);
  const overROI  = totalIn > 0 ? roiPct(totalIn, totalOut) : null;

  // ── Styles
  const S = {
    root: { background: "#0d0d0d", minHeight: "100vh", color: "#e5e7eb", fontFamily: "'Inter', system-ui, -apple-system, sans-serif" },
    header: { padding: "16px 24px", borderBottom: "1px solid #1c1c1c", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 },
    tag: { fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#3b82f6", background: "rgba(59,130,246,0.12)", padding: "3px 8px", borderRadius: 4 },
    tabBar: { display: "flex", gap: 2, background: "#161616", borderRadius: 8, padding: 3 },
    tab: (active) => ({ padding: "7px 16px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500, transition: "all 0.15s", background: active ? "#252525" : "transparent", color: active ? "#f1f5f9" : "#4b5563" }),
    body: { padding: "0 24px 40px" },
    td: { padding: "10px 6px", verticalAlign: "middle" },
    tHead: { fontSize: 10, textTransform: "uppercase", letterSpacing: 1.2, color: "#3b3b3b", fontWeight: 600 },
    signBtn: (active, sign) => {
      const colors = { "1": "#3b82f6", "X": "#8b5cf6", "2": "#ec4899" };
      return { width: 30, height: 30, borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, transition: "all 0.15s", background: active ? colors[sign] : "#1c1c1c", color: active ? "#fff" : "#3b3b3b", boxShadow: active ? `0 0 8px ${colors[sign]}44` : "none" };
    },
    footer: { margin: "16px 0 0", background: "#111", border: "1px solid #1c1c1c", borderRadius: 12, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" },
    saveBtn: { padding: "12px 24px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 700, background: "linear-gradient(135deg, #3b82f6, #6366f1)", color: "#fff", boxShadow: "0 0 20px rgba(59,130,246,0.3)", whiteSpace: "nowrap" },
    statCard: { background: "#111", border: "1px solid #1c1c1c", borderRadius: 10, padding: "14px 18px", flex: 1 },
    pill: (color) => ({ display: "inline-block", padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 600, background: color + "22", color }),
  };

  // ── Loading / error banner
  const renderBanner = () => {
    if (loading) return (
      <div style={{ padding: "12px 24px", background: "#1c1c1c", fontSize: 12, color: "#6b7280" }}>
        Hämtar kupong från bot…
      </div>
    );
    if (error) return (
      <div style={{ padding: "10px 24px", background: "#1c0a0a", borderBottom: "1px solid #3b1a1a", fontSize: 12, color: "#f87171" }}>
        ⚠ Kunde inte nå boten ({error}) — visar fallback-data
      </div>
    );
    if (BOT_URL) return (
      <div style={{ padding: "8px 24px", background: "#0a1a0a", borderBottom: "1px solid #14532d", fontSize: 11, color: "#4ade80" }}>
        ✓ Kupong hämtad från bot
      </div>
    );
    return null;
  };

  // ── Coupon view
  const renderCoupon = () => {
    if (!coupon) return null;
    return (
      <div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={S.tHead}>
              <th style={{ ...S.td, width: 28 }}>#</th>
              <th style={{ ...S.td, textAlign: "left" }}>Match</th>
              <th style={{ ...S.td, textAlign: "center" }}>Folk %</th>
              <th style={{ ...S.td, textAlign: "center" }}>Modell %</th>
              <th style={{ ...S.td, textAlign: "center" }}>Value</th>
              <th style={{ ...S.td, textAlign: "center" }}>Typ</th>
              <th style={{ ...S.td, textAlign: "center" }}>Tecken</th>
            </tr>
          </thead>
          <tbody>
            {matches.map((m) => {
              const changed = m.sel.join("") !== parseRec(m.recommendation).join("");
              const meta = typeMeta(m.type);
              return (
                <tr key={m.nr} style={{ borderTop: "1px solid #161616", background: changed ? "rgba(59,130,246,0.04)" : "transparent" }}>
                  <td style={{ ...S.td, color: "#3b3b3b", fontSize: 12, width: 28 }}>{m.nr}</td>
                  <td style={{ ...S.td, minWidth: 140 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{m.home}</div>
                    <div style={{ fontSize: 11, color: "#4b5563", marginTop: 1 }}>vs {m.away}</div>
                  </td>
                  <td style={{ ...S.td, textAlign: "center" }}><PctBar str={m.folk} /></td>
                  <td style={{ ...S.td, textAlign: "center" }}><PctBar str={m.model} /></td>
                  <td style={{ ...S.td, textAlign: "center" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: valueColor(m.value) }}>{m.value.toFixed(2)}</span>
                  </td>
                  <td style={{ ...S.td, textAlign: "center" }}>
                    <span title={meta.label} style={{ fontSize: 15 }}>{meta.icon}</span>
                  </td>
                  <td style={{ ...S.td, textAlign: "center" }}>
                    <div style={{ display: "flex", gap: 4, justifyContent: "center", alignItems: "center" }}>
                      {SIGN_ORDER.map(s => (
                        <button key={s} onClick={() => toggleSign(m.nr, s)} style={S.signBtn(m.sel.includes(s), s)}>{s}</button>
                      ))}
                      {changed && (
                        <button onClick={() => resetMatch(m.nr)} title="Återställ" style={{ marginLeft: 4, width: 20, height: 20, borderRadius: 4, border: "none", cursor: "pointer", fontSize: 11, background: "#1c1c1c", color: "#4b5563", display: "flex", alignItems: "center", justifyContent: "center" }}>↺</button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div style={S.footer}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 10, color: "#3b3b3b", textTransform: "uppercase", letterSpacing: 1 }}>System</span>
            <span style={{ fontSize: 14, fontWeight: 600, fontFamily: "monospace", color: "#6b7280" }}>{systemStr}</span>
          </div>
          <div style={{ display: "flex", gap: 32, alignItems: "center" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 10, color: "#3b3b3b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 }}>Rader</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#f1f5f9", lineHeight: 1 }}>{totalRows.toLocaleString("sv-SE")}</div>
            </div>
            <div style={{ width: 1, background: "#1c1c1c", height: 32 }} />
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 10, color: "#3b3b3b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 }}>Kostnad</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#3b82f6", lineHeight: 1 }}>{totalRows.toLocaleString("sv-SE")} <span style={{ fontSize: 12, fontWeight: 400, color: "#4b5563" }}>kr</span></div>
            </div>
            <div style={{ width: 1, background: "#1c1c1c", height: 32 }} />
            <button style={S.saveBtn} onClick={saveRound}>Spara och logga omgång</button>
          </div>
        </div>
      </div>
    );
  };

  // ── History view
  const renderHistory = () => (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 0 16px" }}>
        <div style={{ display: "flex", gap: 4 }}>
          {["all", "europatipset", "stryktipset"].map(f => (
            <button key={f} onClick={() => setHistFilter(f)} style={{ padding: "6px 14px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 500, background: histFilter === f ? "#252525" : "transparent", color: histFilter === f ? "#f1f5f9" : "#4b5563" }}>
              {f === "all" ? "Alla" : f === "europatipset" ? "Europatipset" : "Stryktipset"}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 11, color: "#3b3b3b" }}>{filtered.length} omgångar</span>
      </div>

      {history.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "#3b3b3b", fontSize: 13 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
          <div style={{ fontWeight: 500, marginBottom: 6, color: "#4b5563" }}>Inga omgångar loggade än</div>
          <div>Spela en kupong och klicka på <strong style={{ color: "#3b82f6" }}>Spara och logga omgång</strong></div>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
            {[
              { label: "Total insats", val: fmtSEK(totalIn), color: null },
              { label: "Total vinst",  val: fmtSEK(totalOut), color: totalOut > totalIn ? "#22c55e" : totalOut > 0 ? "#eab308" : "#6b7280" },
              { label: "ROI totalt",   val: overROI !== null ? `${overROI >= 0 ? "+" : ""}${overROI}%` : "—", color: overROI !== null ? (overROI >= 0 ? "#22c55e" : "#ef4444") : "#6b7280" },
              { label: "Nettovinst",   val: fmtSEK(totalOut - totalIn), color: (totalOut - totalIn) >= 0 ? "#22c55e" : "#ef4444" },
            ].map(({ label, val, color }) => (
              <div key={label} style={S.statCard}>
                <div style={{ fontSize: 10, color: "#4b5563", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>{label}</div>
                <div style={{ fontSize: 19, fontWeight: 700, color: color || "#e5e7eb" }}>{val}</div>
              </div>
            ))}
          </div>

          {chartData.length > 1 && (
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 10, color: "#3b3b3b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>ROI per omgång</div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={chartData} barSize={20} margin={{ top: 0, right: 0, bottom: 0, left: -10 }}>
                  <CartesianGrid vertical={false} stroke="#1a1a1a" />
                  <XAxis dataKey="round" tick={{ fill: "#3b3b3b", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={v => `${v}%`} tick={{ fill: "#3b3b3b", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                  <ReferenceLine y={0} stroke="#2a2a2a" />
                  <Bar dataKey="roi" radius={[3, 3, 0, 0]}>
                    {chartData.map((d, i) => <Cell key={i} fill={d.roi >= 0 ? "#22c55e" : "#ef4444"} opacity={0.85} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 1.2, color: "#3b3b3b", fontWeight: 600 }}>
                <th style={{ ...S.td, textAlign: "left" }}>Omgång</th>
                <th style={{ ...S.td, textAlign: "left" }}>Produkt</th>
                <th style={{ ...S.td, textAlign: "left" }}>Datum</th>
                <th style={{ ...S.td, textAlign: "left" }}>System</th>
                <th style={{ ...S.td, textAlign: "right" }}>Insats</th>
                <th style={{ ...S.td, textAlign: "right" }}>Vinst</th>
                <th style={{ ...S.td, textAlign: "right" }}>ROI</th>
                <th style={{ ...S.td, width: 32 }} />
              </tr>
            </thead>
            <tbody>
              {filtered.map((h) => {
                const roi = roiPct(h.cost, h.winnings);
                const isEditing = editingId === h.id;
                return (
                  <tr key={h.id} style={{ borderTop: "1px solid #161616" }}>
                    <td style={{ ...S.td, fontSize: 13, fontWeight: 600 }}>#{h.round}</td>
                    <td style={S.td}><span style={S.pill(h.product === "europatipset" ? "#3b82f6" : "#8b5cf6")}>{h.product === "europatipset" ? "Europa" : "Stryk"}</span></td>
                    <td style={{ ...S.td, fontSize: 12, color: "#4b5563" }}>{h.date}</td>
                    <td style={{ ...S.td, fontSize: 11, fontFamily: "monospace", color: "#4b5563" }}>{h.system}</td>
                    <td style={{ ...S.td, textAlign: "right", fontSize: 12, color: "#6b7280" }}>{fmtSEK(h.cost)}</td>
                    <td style={{ ...S.td, textAlign: "right" }}>
                      {isEditing ? (
                        <div style={{ display: "flex", gap: 4, justifyContent: "flex-end", alignItems: "center" }}>
                          <input autoFocus value={editVal} onChange={e => setEditVal(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter") commitEdit(h.id); if (e.key === "Escape") setEditingId(null); }}
                            style={{ width: 80, padding: "3px 6px", fontSize: 12, textAlign: "right", background: "#1c1c1c", border: "1px solid #3b82f6", borderRadius: 4, color: "#f1f5f9", outline: "none" }}
                          />
                          <button onClick={() => commitEdit(h.id)} style={{ padding: "3px 8px", fontSize: 11, borderRadius: 4, background: "#22c55e22", color: "#22c55e", border: "none", cursor: "pointer" }}>✓</button>
                        </div>
                      ) : (
                        <span onClick={() => startEdit(h.id, h.winnings)} title="Klicka för att ange vinst"
                          style={{ fontSize: 12, cursor: "pointer", color: h.winnings > 0 ? "#22c55e" : "#3b3b3b", borderBottom: "1px dashed #2a2a2a" }}>
                          {h.winnings > 0 ? fmtSEK(h.winnings) : "Ange vinst"}
                        </span>
                      )}
                    </td>
                    <td style={{ ...S.td, textAlign: "right" }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: roi > 0 ? "#22c55e" : roi < 0 ? "#ef4444" : "#4b5563" }}>
                        {roi > 0 ? "+" : ""}{roi}%
                      </span>
                    </td>
                    <td style={{ ...S.td, textAlign: "right" }}>
                      <button onClick={() => deleteRound(h.id)} title="Ta bort"
                        style={{ width: 24, height: 24, borderRadius: 4, border: "none", cursor: "pointer", fontSize: 13, background: "transparent", color: "#2a2a2a", display: "flex", alignItems: "center", justifyContent: "center" }}
                        onMouseEnter={e => e.currentTarget.style.color = "#ef4444"}
                        onMouseLeave={e => e.currentTarget.style.color = "#2a2a2a"}
                      >×</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </div>
  );

  return (
    <div style={S.root}>
      {toast && (
        <div style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", background: toast.type === "warning" ? "#78350f" : "#14532d", border: `1px solid ${toast.type === "warning" ? "#d97706" : "#22c55e"}`, color: "#f1f5f9", padding: "10px 20px", borderRadius: 8, fontSize: 13, fontWeight: 500, zIndex: 1000, boxShadow: "0 4px 20px rgba(0,0,0,0.4)" }}>
          {toast.type === "warning" ? "⚠️" : "✓"} {toast.msg}
        </div>
      )}

      <div style={S.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={S.tag}>{coupon?.product ?? "tipset"}</span>
          <div>
            <span style={{ fontSize: 11, color: "#3b3b3b" }}>Omgång </span>
            <span style={{ fontSize: 15, fontWeight: 700 }}>#{coupon?.draw_number ?? "—"}</span>
          </div>
        </div>
        <div style={S.tabBar}>
          <button style={S.tab(view === "coupon")}  onClick={() => setView("coupon")}>Aktuell kupong</button>
          <button style={S.tab(view === "history")} onClick={() => setView("history")}>
            Historik {history.length > 0 && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, background: "#3b82f622", color: "#3b82f6", padding: "1px 5px", borderRadius: 10 }}>{history.length}</span>}
          </button>
        </div>
      </div>

      {renderBanner()}

      {view === "coupon" && (
        <div style={{ padding: "8px 24px", borderBottom: "1px solid #161616", display: "flex", gap: 20, alignItems: "center" }}>
          {[{ color: "#22c55e", label: "Value > 1.20" }, { color: "#eab308", label: "Value > 1.00" }, { color: "#4b5563", label: "Value = 1.00" }].map(({ color, label }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
              <span style={{ fontSize: 11, color: "#3b3b3b" }}>{label}</span>
            </div>
          ))}
          <div style={{ marginLeft: "auto", display: "flex", gap: 14 }}>
            {[{ icon: "🔒", l: "Spik" }, { icon: "🔀", l: "Halv" }, { icon: "🔥", l: "Hel" }].map(({ icon, l }) => (
              <span key={l} style={{ fontSize: 11, color: "#3b3b3b" }}>{icon} {l}</span>
            ))}
          </div>
        </div>
      )}

      <div style={S.body}>
        {view === "coupon" ? renderCoupon() : renderHistory()}
      </div>
    </div>
  );
}

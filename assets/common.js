(function () {
  // Lock only within this tab: the default cross-tab lock can get stuck when the
  // admin page is open in several tabs, and then uploads/saves wait forever.
  const tabLocks = {};
  const tabLock = (name, _timeout, fn) => {
    const prev = tabLocks[name] || Promise.resolve();
    const run = prev.catch(() => {}).then(() => fn());
    tabLocks[name] = run.catch(() => {});
    return run;
  };
  const sb = window.supabase.createClient(window.EP_CONFIG.supabaseUrl, window.EP_CONFIG.supabaseKey, {
    auth: { lock: tabLock },
  });

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const dateFmt = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Rome" });
  const timeFmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" });
  const shortFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" });
  const priceFmt = new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR" });

  function dinnerDate(ts) {
    if (!ts) return "Date to be confirmed";
    const d = new Date(ts);
    const t = timeFmt.format(d);
    const out = dateFmt.format(d) + (t !== "00:00" ? " · " + t : "");
    return out.charAt(0).toUpperCase() + out.slice(1);
  }

  const STATUS = {
    in_attesa: "Pending",
    disponibile: "Available",
    non_disponibile: "Not available",
  };

  let toastTimer;
  function toast(msg, isErr) {
    let el = document.querySelector(".toast");
    if (!el) {
      el = document.createElement("div");
      el.className = "toast";
      el.setAttribute("role", "status");
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.toggle("err", !!isErr);
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 3200);
  }

  const store = {
    get(k, fallback) {
      try { const v = localStorage.getItem(k); return v == null ? fallback : JSON.parse(v); } catch { return fallback; }
    },
    set(k, v) {
      try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ }
    },
  };

  // One colour per chef, stable across pages: chefs are numbered in dinner order.
  const PALETTE = [
    ["#e8f0fe", "#2f6fd6"], ["#e6f6ec", "#1f8a4c"], ["#fdeee0", "#c25e0a"], ["#f1ebfd", "#7a45d6"],
    ["#fde8f1", "#c22f74"], ["#e2f5f4", "#0f7f7a"], ["#fdeaea", "#c2352d"], ["#fbf3d9", "#946600"],
    ["#e9ebfc", "#4146c9"], ["#eef6dd", "#557a0c"], ["#e3f3fb", "#0f72a0"], ["#f4ece4", "#8a5a2b"],
    ["#fbe8fb", "#a8329f"], ["#eceff3", "#4a5566"], ["#fff0e6", "#b34700"], ["#e8f7ef", "#2a7a52"],
  ];
  const chefIndex = {};
  const key = (n) => String(n || "").trim().toLowerCase();
  function setChefColors(dinners) {
    let i = 0;
    (dinners || []).forEach((d) => String(d.chefs || "").split(",").map(key).filter(Boolean).forEach((c) => {
      if (!(c in chefIndex)) chefIndex[c] = i++;
    }));
  }
  function chefStyle(name) {
    const k = key(name);
    let i = chefIndex[k];
    if (i == null) { i = 0; for (const ch of k) i = (i * 31 + ch.charCodeAt(0)) >>> 0; }
    const [bg, fg] = PALETTE[i % PALETTE.length];
    return `--tag-bg:${bg};--tag-fg:${fg}`;
  }

  const photoUrl = (path) =>
    path ? `${window.EP_CONFIG.supabaseUrl}/storage/v1/object/public/product-photos/${String(path).split("/").map(encodeURIComponent).join("/")}` : "";

  // ----- units: same maths as public.offer_line_total in the database -----
  const UNIT = { kg: ["mass", 1000], g: ["mass", 1], l: ["vol", 1000], ml: ["vol", 1], pcs: ["pcs", 1] };
  const QTY_UNITS = { kg: "kg", g: "g", pcs: "pcs", l: "l", ml: "ml" };
  const PRICE_UNITS = { total: "total", kg: "per kg", g: "per g", pcs: "per piece", l: "per l", ml: "per ml" };
  const PRICE_SUFFIX = { total: "", kg: "/kg", g: "/g", pcs: "/piece", l: "/l", ml: "/ml" };
  const numFmt = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 3, useGrouping: false });
  const toNum = (v) => {
    if (v == null || v === "") return null;
    const n = Number(String(v).replace(/\s|€/g, "").replace(",", "."));
    return isNaN(n) ? NaN : n;
  };
  function lineTotal(price, priceUnit, qty, qtyUnit) {
    if (price == null || isNaN(price)) return null;
    if (!priceUnit || priceUnit === "total") return Math.round(price * 100) / 100;
    if (qty == null || isNaN(qty) || !UNIT[qtyUnit] || !UNIT[priceUnit]) return null;
    const [qd, qb] = UNIT[qtyUnit], [pd, pb] = UNIT[priceUnit];
    if (qd !== pd) return null;
    return Math.round(price * qty * qb / pb * 100) / 100;
  }
  // Minimum order: bill the larger of what was asked and the minimum (in the asked unit)
  function billedQty(qty, qtyUnit, min, minUnit) {
    if (min == null || isNaN(min) || !minUnit) return { qty, unit: qtyUnit, raised: false };
    if (qty == null || isNaN(qty) || !qtyUnit) return { qty: min, unit: minUnit, raised: true };
    if (!UNIT[qtyUnit] || !UNIT[minUnit] || UNIT[qtyUnit][0] !== UNIT[minUnit][0]) return { qty: null, unit: qtyUnit, raised: false, mismatch: true };
    const minInQty = min * UNIT[minUnit][1] / UNIT[qtyUnit][1];
    return minInQty > qty ? { qty: minInQty, unit: qtyUnit, raised: true } : { qty, unit: qtyUnit, raised: false };
  }
  function lineTotalMin(price, priceUnit, qty, qtyUnit, min, minUnit) {
    const b = billedQty(qty, qtyUnit, min, minUnit);
    if (b.mismatch && priceUnit !== "total") return null;
    return lineTotal(price, priceUnit, b.qty, b.unit);
  }

  // "3 kg", "250g", "12 pieces", "1,5 l" -> { amount, unit }
  function parseQty(text) {
    const m = String(text || "").toLowerCase().match(/(\d+(?:[.,]\d+)?)\s*(kg|kilo\w*|g|gr|gram\w*|ml|l|lt|lit\w*|pcs?|pz|pezz\w*|piece\w*|x)?/);
    if (!m) return { amount: null, unit: "kg" };
    const u = m[2] || "";
    const unit = /^k/.test(u) ? "kg" : /^(g|gr|gram)/.test(u) ? "g" : u === "ml" ? "ml" : /^(l|lt|lit)/.test(u) ? "l" : u ? "pcs" : "pcs";
    return { amount: toNum(m[1]), unit };
  }

  window.EP = {
    QTY_UNITS, PRICE_UNITS, PRICE_SUFFIX, lineTotal, billedQty, lineTotalMin, parseQty, toNum, fmtNum: (n) => (n == null ? "" : numFmt.format(Number(n))),
    setChefColors, chefStyle, photoUrl,
    sb, esc, dinnerDate, STATUS, toast, store,
    shortDate: (ts) => (ts ? shortFmt.format(new Date(ts)) : ""),
    price: (n) => (n == null ? "" : priceFmt.format(Number(n))),
  };
})();

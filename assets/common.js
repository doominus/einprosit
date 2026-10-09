(function () {
  const sb = window.supabase.createClient(window.EP_CONFIG.supabaseUrl, window.EP_CONFIG.supabaseKey);

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
  const numFmt = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 3 });
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
  // "3 kg", "250g", "12 pieces", "1,5 l" -> { amount, unit }
  function parseQty(text) {
    const m = String(text || "").toLowerCase().match(/(\d+(?:[.,]\d+)?)\s*(kg|kilo\w*|g|gr|gram\w*|ml|l|lt|lit\w*|pcs?|pz|pezz\w*|piece\w*|x)?/);
    if (!m) return { amount: null, unit: "kg" };
    const u = m[2] || "";
    const unit = /^k/.test(u) ? "kg" : /^(g|gr|gram)/.test(u) ? "g" : u === "ml" ? "ml" : /^(l|lt|lit)/.test(u) ? "l" : u ? "pcs" : "pcs";
    return { amount: toNum(m[1]), unit };
  }

  // Per-chef accounting: each chef is responsible for their own confirmed items.
  function chefSplit(rows, chefList, active) {
    const names = [...chefList];
    rows.forEach((r) => { if (!names.some((n) => key(n) === key(r.chef_name))) names.push(r.chef_name); });
    if (!names.length) return "";
    const priceFmtL = (n) => priceFmt.format(n);
    return names.map((n) => {
      const mine = rows.filter((r) => key(r.chef_name) === key(n));
      const conf = mine.filter((r) => r.status === "disponibile");
      const total = conf.reduce((a, r) => a + (r.price != null ? Number(r.price) : 0), 0);
      const pending = mine.filter((r) => r.status === "in_attesa").length;
      const missing = conf.filter((r) => r.price == null).length;
      return `<button type="button" class="chef-card ${key(active) === key(n) ? "on" : ""}" data-chef="${esc(n)}" style="${chefStyle(n)}">
        <span class="cc-name">${esc(n)}</span>
        <span class="cc-total">${priceFmtL(total)}</span>
        <span class="cc-meta">${mine.length} request${mine.length === 1 ? "" : "s"} · ${conf.length} confirmed${pending ? ` · ${pending} pending` : ""}${missing ? ` · ${missing} without price` : ""}</span>
      </button>`;
    }).join("");
  }

  window.EP = {
    chefSplit,
    QTY_UNITS, PRICE_UNITS, PRICE_SUFFIX, lineTotal, parseQty, toNum, fmtNum: (n) => (n == null ? "" : numFmt.format(Number(n))),
    setChefColors, chefStyle, photoUrl,
    sb, esc, dinnerDate, STATUS, toast, store,
    shortDate: (ts) => (ts ? shortFmt.format(new Date(ts)) : ""),
    price: (n) => (n == null ? "" : priceFmt.format(Number(n))),
  };
})();

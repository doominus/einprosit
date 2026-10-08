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

  window.EP = {
    setChefColors, chefStyle,
    sb, esc, dinnerDate, STATUS, toast, store,
    shortDate: (ts) => (ts ? shortFmt.format(new Date(ts)) : ""),
    price: (n) => (n == null ? "" : priceFmt.format(Number(n))),
  };
})();

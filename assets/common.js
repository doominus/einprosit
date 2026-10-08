(function () {
  const sb = window.supabase.createClient(window.EP_CONFIG.supabaseUrl, window.EP_CONFIG.supabaseKey);

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const dateFmt = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Rome" });
  const timeFmt = new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" });
  const shortFmt = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" });
  const priceFmt = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });

  function dinnerDate(ts) {
    if (!ts) return "Data da definire";
    const d = new Date(ts);
    const t = timeFmt.format(d);
    return dateFmt.format(d) + (t !== "00:00" ? " · " + t : "");
  }

  const STATUS = {
    in_attesa: "In attesa",
    disponibile: "Disponibile",
    non_disponibile: "Non disponibile",
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

  window.EP = {
    sb, esc, dinnerDate, STATUS, toast, store,
    shortDate: (ts) => (ts ? shortFmt.format(new Date(ts)) : ""),
    price: (n) => (n == null ? "" : priceFmt.format(Number(n))),
  };
})();

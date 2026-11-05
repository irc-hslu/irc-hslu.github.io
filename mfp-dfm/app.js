"use strict";
/* Shared helpers for index.html and queues.html (Alpine components registered at the bottom). */
const RB = (() => {
  const HOSTS = {  // the single place for host display names
    local: {name: "IR-Hermes", gpu: "RTX 4090"}, iradonis: {name: "IR-Adonis", gpu: "RTX 4080"},
    desktop: {name: "charisoudisDesktop", gpu: "RTX 3090"},
  };
  const gpuKey = (k) => /^(.+)\.gpu(\d+)$/.exec(k || "");  // one queue per GPU on multi-GPU machines: '<host>.gpu<i>'
  const hostName = (k) => { const m = gpuKey(k); return m ? `${m[1]} \u00b7 GPU ${m[2]}` : HOSTS[k] ? HOSTS[k].name : k || "-"; };
  const hostTip = (k) => (HOSTS[k] ? `${HOSTS[k].name} ${HOSTS[k].gpu}` : "");
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  /** Relative ('3 h ago', '2 d ago') when younger than 6 days, else 'DD Mon' (e.g. '28 Oct'). */
  function relTime(iso, now = Date.now()) {
    if (!iso) return "";
    const t = new Date(iso), m = (now - t) / 60000;
    if (m < 0) return "soon";
    if (m < 1) return "just now";
    if (m < 60) return Math.round(m) + " min ago";
    if (m < 1440) return Math.floor(m / 60) + " h ago";
    if (m < 6 * 1440) return Math.floor(m / 1440) + " d ago";
    return String(t.getDate()).padStart(2, "0") + " " + MON[t.getMonth()];
  }
  const clock = (iso) => iso ? new Date(iso).toLocaleString([], {day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"}) : "-";
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]));
  const PATHY = /^(\/|~|[A-Za-z]:\\|[0-9a-f]{40,}$|.*\.(ckpt|json|jsonl|job|sh|py|pt)$)/;
  const cp = (v) => `<button class="cp" data-copy="${esc(v)}" type="button">copy</button>`;
  /** Nested object -> key/value markup (never raw JSON). Paths/shas are monospace with a copy button. */
  function kv(o, depth = 0) {
    const rows = Object.entries(o).filter(([, v]) => v != null && v !== "" && !(typeof v === "object" && !Object.keys(v).length));
    if (!rows.length) return "";
    return `<dl class="kv">` + rows.map(([k, v]) => {
      let body;
      if (Array.isArray(v)) body = v.map((x) => (typeof x === "object" ? kv(x, depth + 1) : val(String(x)))).join("<br>");
      else if (typeof v === "object") body = kv(v, depth + 1);
      else body = val(String(v), k);
      return `<dt>${esc(k.replace(/_/g, " "))}</dt><dd>${body}</dd>`;
    }).join("") + `</dl>`;
  }
  function val(s, k = "") {
    return PATHY.test(s) || /sha|commit|checkpoint|dir|file|path/.test(k) ? `<span class="mono">${esc(s)}</span>${cp(s)}` : esc(s);
  }
  async function decrypt(blob, pw) {
    const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
    const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveKey"]);
    const key = await crypto.subtle.deriveKey({name: "PBKDF2", salt: b64(blob.salt), iterations: blob.iter, hash: "SHA-256"}, base,
      {name: "AES-GCM", length: 256}, false, ["decrypt"]);
    return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name: "AES-GCM", iv: b64(blob.iv)}, key, b64(blob.ct))));
  }
  async function load(askPassword) {
    if (window.RUNBOARD_DATA) return window.RUNBOARD_DATA;
    if (new URLSearchParams(location.search).has("local")) return (await fetch("../../specs/runboard/runs.json", {cache: "no-store"})).json();
    const blob = await (await fetch("./runs.enc.json", {cache: "no-store"})).json();
    const ok = async (pw) => { const d = await decrypt(blob, pw); try { sessionStorage.setItem("runboard_pw", pw); } catch (e) {} return d; };
    let saved = null; try { saved = sessionStorage.getItem("runboard_pw"); } catch (e) {}
    if (saved) { try { return await ok(saved); } catch (e) {} }
    return askPassword(ok);
  }
  const theme = {
    get() { const q = new URLSearchParams(location.search).get("theme"); if (q) return q; try { return localStorage.getItem("rb-theme"); } catch (e) { return null; } },
    apply(t) { // 'system' (null) resolves to the OS preference so our palette and Pico's always agree
      const dark = typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.dataset.theme = t || (dark ? "dark" : "light"); },
    isDark() { return document.documentElement.dataset.theme === "dark"; },
    toggle() { // explicit light <-> dark; the choice is remembered, until then the system preference applies
      const n = this.isDark() ? "light" : "dark";
      try { localStorage.setItem("rb-theme", n); } catch (e) {}
      this.apply(n); return n === "dark";
    },
  };
  theme.apply(theme.get());
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-copy]"); if (!b) return;
    e.stopPropagation(); navigator.clipboard?.writeText(b.dataset.copy); b.textContent = "copied"; setTimeout(() => (b.textContent = "copy"), 1200);
  });
  /** Per-tab UI state (search, filters, sort), kept in sessionStorage so each tab restores its own. */
  // search + Dataset/Noise/Status filters are ONE state shared by all run tabs; only the sort is per tab
  const TAB_DEFAULT = () => ({q: "", f: {dataset: "", noise: "", status: ""}, sort: "modified_at", dir: -1});
  const tabStore = {
    read() { try { return JSON.parse(sessionStorage.getItem("rb-tabs")) || {}; } catch (e) { return {}; } },
    write(o) { try { sessionStorage.setItem("rb-tabs", JSON.stringify(o)); } catch (e) {} },
    get(tab, store = this.read()) {
      const d = TAB_DEFAULT(), sh = store.shared || {}, t = (store.tabs || {})[tab] || {};
      return {q: sh.q ?? d.q, f: {...d.f, ...(sh.f || {})}, sort: t.sort ?? d.sort, dir: t.dir ?? d.dir};
    },
    put(tab, state, store = this.read()) {
      store.shared = {q: state.q, f: {...state.f}};
      (store.tabs ||= {})[tab] = {sort: state.sort, dir: state.dir};
      return store;
    },
  };
  /** Inline Lucide icon (vendor/lucide-*-icons.js); '' if the icon set is missing. */
  const ic = (name, cls = "") => {
    const L = (typeof window !== "undefined" && window.LUCIDE) || {};
    return L[name] ? `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${L[name]}</svg>` : "";
  };
  /** Icon per run status / queue stage / matrix word. */
  const ICON = {succeeded: "circle-check", running: "activity", queued: "hourglass", planned: "clock", failed: "circle-x", cancelled: "ban",
    smoke: "flask-conical", stale: "clock", superseded: "archive", reviewed: "check", "host-tested": "flask-conical", built: "package",
    Done: "circle-check", "In progress": "activity", Planned: "clock"};
  return {tabStore, HOSTS, hostName, hostTip, relTime, clock, kv, esc, decrypt, load, theme, ic, ICON};
})();
if (typeof module !== "undefined") module.exports = RB;

/* Common page state: data, password gate, header. */
function base(page) {
  return {
    page, D: null, gate: false, err: "", pw: "", ok: null, dark: RB.theme.isDark(), now: Date.now(), RB, loading: false,
    ic: RB.ic, badgeHtml: (st, label) => RB.ic(RB.ICON[st] || "") + RB.esc(label ?? st),
    /** Keep --hdr-h = height of the sticky top bar, so sticky table headers sit right below it. */
    watchHeader() {
      const h = document.querySelector(".wrap:not(.skel) header.top"); if (!h || typeof ResizeObserver === "undefined") return;
      new ResizeObserver(() => document.documentElement.style.setProperty("--hdr-h", h.offsetHeight + "px")).observe(h);
    },
    /** Header reload: fetch and decrypt the data again (saved password), with a visible spinner for at least ~0.5 s. */
    async reload() {
      if (this.loading) return;
      this.loading = true; const t0 = Date.now();
      try { this.D = await RB.load(() => Promise.reject(new Error("locked"))); this.now = Date.now(); if (this.onReload) this.onReload(); }
      catch (e) { /* keep the data we have */ }
      finally { setTimeout(() => (this.loading = false), Math.max(0, 500 - (Date.now() - t0))); }
    },
    async init() {
      this.D = await RB.load((ok) => new Promise((res) => { this.gate = true; this.ok = async () => {
        try { const d = await ok(this.pw); this.gate = false; res(d); } catch (e) { this.err = "Wrong password."; } }; }));
      setInterval(() => (this.now = Date.now()), 30000);
      this.$nextTick(() => this.watchHeader());
      if (this.afterLoad) this.afterLoad();
    },
    toggleTheme() { this.dark = RB.theme.toggle(); },
    // methods, not getters: object spread would freeze getter values at init (D still null)
    updated() { return this.D ? new Date(this.D.last_updated).toLocaleString([], {dateStyle: "medium", timeStyle: "short"}) : ""; },
    stale() { return !!this.D && this.now - new Date(this.D.last_updated) > 3 * 3600e3; },
    ago() { return this.D ? RB.relTime(this.D.last_updated, this.now) : ""; },
  };
}

const STATUS_ORDER = ["running", "queued", "planned", "failed", "succeeded", "cancelled", "stale", "superseded"];
const TABS = ["PromptDA", "Ours_SV", "Ours_MV", "Other", "Scratch"];
const rmse = (r) => { const m = r.summary_metrics || {}; return m.test_rmse != null ? [m.test_rmse, "test"] : m.dev_best_rmse != null ? [m.dev_best_rmse, "dev"] : [null, ""]; };
let RUNS_TABLE = null;  // the Tabulator instance (kept out of Alpine's reactive state)
const hostOf = (r) => { const a = [...(r.attempts || [])].reverse().find((x) => x.host); return a ? a.host : ""; };

document.addEventListener("alpine:init", () => {
  Alpine.data("runs", () => ({
    ...base("runs"),
    onReload() { if (RUNS_TABLE) RUNS_TABLE.replaceData(this.tabRows()); }, tab: decodeURIComponent(location.hash.slice(1)) || "PromptDA", q: "", f: {dataset: "", noise: "", status: ""},
    sort: "modified_at", dir: -1, open: new URLSearchParams(location.search).getAll("open"), tabs: TABS, n: 0,
    afterLoad() {
      for (const r of this.D.runs) if (this.open.includes(r.id)) { this.tab = this.tabOf(r); break; }
      Object.assign(this, RB.tabStore.get(this.tab));
      for (const k of ["q", "f", "sort", "dir"]) this.$watch(k, () => RB.tabStore.write(RB.tabStore.put(this.tab, this)));
      this.$watch("q", () => RUNS_TABLE && RUNS_TABLE.replaceData(this.tabRows()));
      this.$nextTick(() => this.mkTable());
    },
    tabOf(r) { return r.kind === "scratch" ? "Scratch" : r.tab; },
    count(t) { return this.D ? this.D.runs.filter((r) => this.tabOf(r) === t).length : 0; },
    setTab(t) {
      const store = RB.tabStore.put(this.tab, this); RB.tabStore.write(store);  // save the tab we leave
      this.tab = t; location.hash = t; Object.assign(this, RB.tabStore.get(t, store));  // restore the one we enter
      if (RUNS_TABLE) { RUNS_TABLE.replaceData(this.tabRows()); this.applySort(); }
    },
    opts(k) { const v = [...new Set(this.D.runs.filter((r) => this.tabOf(r) === this.tab).map((r) => r[k]))].filter((x) => x && x !== "-");
      return k === "status" ? v.sort((a, b) => STATUS_ORDER.indexOf(a) - STATUS_ORDER.indexOf(b)) : v.sort(); },
    /** Rows of the current tab matching the search; the Dataset / Noise / Status filters and sorting live in the table. */
    tabRows() {
      const words = this.q.toLowerCase().split(/\s+/).filter(Boolean);
      return this.D.runs.filter((r) => this.tabOf(r) === this.tab && words.every((w) => (r._s ??= JSON.stringify(r).toLowerCase()).includes(w)))
        .map((r) => ({id: r.id, title: r.display_name || r.title, dataset: r.dataset, noise: r.noise, status: r.status, rmse: rmse(r)[0], rsrc: rmse(r)[1],
          host: RB.hostName(hostOf(r)), hostTip: RB.hostTip(hostOf(r)), modified_at: r.modified_at || null, _r: r}));
    },
    applySort() { const f = {title: "title", rmse: "rmse", host: "host"}[this.sort] || this.sort; RUNS_TABLE.setSort(f, this.dir > 0 ? "asc" : "desc"); },
    /** Tabulator table: same columns, names, badges and density as before; narrow screens fold the minor columns under the row. */
    mkTable() {
      const self = this, esc = RB.esc, miss = (x) => x == null || x === "" || x === "-";
      const lastMissing = (a, b, ar, br, c, dir) => (miss(a) || miss(b) ? (miss(a) === miss(b) ? 0 : (miss(a) ? 1 : -1) * (dir === "asc" ? 1 : -1)) : a < b ? -1 : a > b ? 1 : 0);
      const list = (k) => ({headerFilter: "list", headerFilterFunc: "=", headerFilterPlaceholder: "All",
        headerFilterParams: {valuesLookup: () => [{label: "All", value: ""}, ...self.opts(k).map((v) => ({label: v, value: v}))]}});
      const col = (o) => ({headerSortStartingDir: "asc", resizable: false, vertAlign: "top", ...o});
      RUNS_TABLE = new Tabulator(this.$refs.tbl, {
        data: this.tabRows(), index: "id", layout: "fitColumns", renderVertical: "basic", placeholder: "",
        responsiveLayout: "collapse", responsiveLayoutCollapseStartOpen: true,
        responsiveLayoutCollapseFormatter: (items) => {
          const el = document.createElement("div"); el.className = "rb-collapse";
          for (const it of items) { const s = document.createElement("span"); s.innerHTML = `<small>${esc(it.title)}</small> `;
            s.append(typeof it.value === "string" ? Object.assign(document.createElement("span"), {innerHTML: it.value}) : it.value); el.append(s); }
          return items.length ? el : "";
        },
        initialSort: [{column: {title: "title", rmse: "rmse", host: "host"}[this.sort] || this.sort, dir: this.dir > 0 ? "asc" : "desc"}],
        initialHeaderFilter: Object.entries(this.f).filter(([, v]) => v).map(([field, value]) => ({field, value})),
        columns: [
          col({title: "Run", field: "title", minWidth: 230, widthGrow: 3, responsive: 0, sorter: lastMissing,
            formatter: (c) => { const d = c.getData();
              return `<div class="rb-run"><div class="rb-name" title="${esc(d._r.title)}"><span class="car">${self.isOpen(d._r) ? "\u25be" : "\u25b8"}</span>${esc(d.title).replace(/_/g, "_<wbr>")}</div><div class="rb-id" title="${esc(d.id)}">${esc(d.id)}</div></div>`; }}),
          col({title: "Dataset", field: "dataset", width: 140, responsive: 4, sorter: lastMissing, ...list("dataset")}),
          col({title: "Noise", field: "noise", width: 118, responsive: 5, sorter: lastMissing, ...list("noise")}),
          col({title: "Status", field: "status", width: 150, responsive: 1, ...list("status"),
            sorter: (a, b) => STATUS_ORDER.indexOf(a) - STATUS_ORDER.indexOf(b),
            formatter: (c) => `<span class="badge has-i s-${esc(c.getValue())}">${RB.ic(RB.ICON[c.getValue()] || "")}${esc(c.getValue())}</span>`}),
          col({title: "RMSE", field: "rmse", width: 112, hozAlign: "right", headerHozAlign: "right", responsive: 2, sorter: lastMissing, headerSortStartingDir: "desc",
            formatter: (c) => (c.getValue() == null ? `<span class="muted">-</span>` : `<span class="num">${c.getValue().toFixed(3)}</span><span class="tag">${esc(c.getData().rsrc)}</span>`)}),
          col({title: "Host", field: "host", width: 190, responsive: 6, sorter: lastMissing,
            formatter: (c) => `<span title="${esc(c.getData().hostTip)}">${esc(c.getValue())}</span>`}),
          col({title: "Modified", field: "modified_at", width: 142, responsive: 3, headerSortStartingDir: "desc",
            sorter: (a, b) => (miss(a) || miss(b) ? (miss(a) === miss(b) ? 0 : miss(a) ? -1 : 1) : a < b ? -1 : a > b ? 1 : 0),  // not started = oldest
            formatter: (c) => `<span class="num" title="${esc(self.abs(c.getValue()))}">${esc(self.when(c.getData()._r) || "not started")}</span>`}),
        ],
        rowFormatter: (row) => self.renderDetails(row),
      });
      RUNS_TABLE.on("dataSorted", (sorters) => { if (sorters[0]) { this.sort = sorters[0].field; this.dir = sorters[0].dir === "asc" ? 1 : -1; } });
      RUNS_TABLE.on("dataFiltered", (filters, rows) => {
        this.n = rows.length;
        const hf = Object.fromEntries(RUNS_TABLE.getHeaderFilters().map((x) => [x.field, x.value]));
        this.f = {dataset: hf.dataset || "", noise: hf.noise || "", status: hf.status || ""};
      });
      RUNS_TABLE.on("dataProcessed", () => (this.n = RUNS_TABLE.getDataCount("active")));
      RUNS_TABLE.on("rowClick", (e, row) => { if (e.target.closest("a, button, .rb-det")) return; this.flip(row.getData()._r); row.reformat(); });
      RUNS_TABLE.on("tableBuilt", () => { this.n = RUNS_TABLE.getDataCount("active"); const id = this.open[0]; if (id && RUNS_TABLE.getRow(id)) RUNS_TABLE.scrollToRow(id, "top", false); });
    },
    /** Phone filter bar (the filter columns are folded away there): same shared state as the header filters. */
    setFilter(k, v) { if (RUNS_TABLE) RUNS_TABLE.setHeaderFilterValue(k, v); },
    /** Attempt details below an open row: the Alpine template #det-tpl, scoped to the run. */
    renderDetails(row) {
      const el = row.getElement(), r = row.getData()._r, old = el.querySelector(":scope > .rb-det");
      if (old) { Alpine.destroyTree(old); old.remove(); }
      el.classList.toggle("open", this.isOpen(r));
      if (!this.isOpen(r)) return;
      const node = document.getElementById("det-tpl").content.firstElementChild.cloneNode(true);
      Alpine.mutateDom(() => el.appendChild(node));
      // Tabulator may format a row before attaching it to the page, so anchor the scope on the component root explicitly
      Alpine.addScopeToNode(node, {r}, document.querySelector("[x-data]")); Alpine.initTree(node);
    },
    isOpen(r) { return this.open.includes(r.id); },
    flip(r) { const i = this.open.indexOf(r.id); i < 0 ? this.open.push(r.id) : this.open.splice(i, 1); },
    rmse, hostOf, host: (r) => RB.hostName(hostOf(r)), tip: (r) => RB.hostTip(hostOf(r)),
    when(r) { return RB.relTime(r.modified_at, this.now); },
    abs: (iso) => (iso ? new Date(iso).toLocaleString([], {dateStyle: "medium", timeStyle: "short"}) : ""),
    metrics(g) { // g = metrics_best | metrics_last -> [[label, value]] with em dash for missing
      const f = (v, d = 3) => (typeof v === "number" ? v.toFixed(d) : "\u2014");
      return g ? [["RMSE", f(g.rmse)], ["MAE", f(g.mae)], ["AbsRel", f(g.absrel)], ["F1", typeof g.f1 === "number" ? g.f1.toFixed(1) : "\u2014"]] : [];
    },
    attempts(r) { return [...(r.attempts || [])].reverse(); },  // latest first
    dur(a) {
      if (!a.started_at) return "not started";
      if (a.status === "running") return "still running";
      if (!a.ended_at) return "\u2014";
      const m = Math.round((new Date(a.ended_at) - new Date(a.started_at)) / 60000);
      return m >= 60 ? (m / 60).toFixed(1) + " h" : m + " min";
    },
    sha: (c) => (c ? c.slice(0, 7) : ""),
    commitUrl: (c) => "https://github.com/irc-hslu/metricsplat/commit/" + c,
  }));
  Alpine.data("queues", () => ({
    ...base("queues"), cur: 0, atStart: true, atEnd: false,
    /** Lane carousel: CSS scroll-snap does the snapping; these only drive the arrows and dots. */
    laneEls() { return this.$refs.lanes ? [...this.$refs.lanes.querySelectorAll(".hlane")] : []; },
    onScroll() {
      const el = this.$refs.lanes, ls = this.laneEls(); if (!el || !ls.length) return;
      const x = el.scrollLeft, w = ls.length > 1 ? ls[1].offsetLeft - ls[0].offsetLeft : el.clientWidth;
      this.cur = Math.min(ls.length - 1, Math.round(x / w));
      this.atStart = x < 4; this.atEnd = x + el.clientWidth >= el.scrollWidth - 4;
      // phone: one lane per screen, so the strip takes the height of the lane in view (no gap under a short lane)
      el.style.height = matchMedia("(max-width: 720px)").matches ? ls[this.cur].offsetHeight + 16 + "px" : "";
    },
    go(i) { const el = this.$refs.lanes, ls = this.laneEls(); if (ls[i]) el.scrollTo({left: ls[i].offsetLeft - ls[0].offsetLeft, behavior: "smooth"}); },
    step(d) { const ls = this.laneEls(), w = ls.length > 1 ? ls[1].offsetLeft - ls[0].offsetLeft : 380; this.$refs.lanes.scrollBy({left: d * w, behavior: "smooth"}); },
    STAGE: {running: "Running", queued: "Queued", reviewed: "Ready", "host-tested": "Tested", built: "Built", planned: "Planned"},
    afterLoad() { this.onReload(); addEventListener("resize", () => this.onScroll()); },
    onReload() {
      this.runById = Object.fromEntries(this.D.runs.map((r) => [r.id, r])); this.planById = Object.fromEntries((this.D.plan || []).map((p) => [p.id, p]));
      this.$nextTick(() => this.onScroll());
    },
    /** Lanes in a fixed order: own hosts, then rented ones. */
    hosts() {
      if (!this.D) return [];
      const order = ["local", "iradonis", "desktop"], q = this.D.queues || {};
      const gone = (k) => (q[k].status === "destroyed" ? 1 : 0);  // destroyed rented machines last, newest destruction first
      return Object.keys(q).filter((k) => !q[k].excluded).sort((a, b) => gone(a) - gone(b) ||
          (gone(a) ? (q[b].destroyed_at || "").localeCompare(q[a].destroyed_at || "") : ((order.indexOf(a) + 1) || 99) - ((order.indexOf(b) + 1) || 99)) || a.localeCompare(b))
        .map((k) => ({k, ...q[k], name: RB.hostName(k), gpuName: this.gpuOf(k), rented: k.startsWith("vastai_"), multi: !!/\.gpu\d+$/.exec(k), gone: q[k].status === "destroyed"}));
    },
    gpuOf(k) { const q = (this.D.queues || {})[k] || {}; return (q.gpu_label || (RB.HOSTS[k] || {}).gpu || "").replace(/\s*\(.*\)$/, ""); },
    /** Name with a break opportunity after every underscore only (never ellipsized). */
    nameHtml: (s) => RB.esc(s || "").replace(/_/g, "_<wbr>"),
    /** model · dataset · noise, model in the main-table form (PromptDA-B, SV-B, MV(3)-B); noise always shown ('noise ?' when unknown). */
    chips(model, dataset, noise) {
      const ok = (x) => x && !["none", "-", "\u2014", "all", "n.a."].includes(x);
      const m = ok(model) ? ({promptda: "PromptDA-B", sv: "SV-B", mv: "MV(3)-B"}[String(model).toLowerCase()] || model) : "";
      return [m, ok(dataset) ? dataset : "", ok(noise) ? noise : "noise ?"].filter(Boolean);
    },
    runAttempt(r) { const a = [...((r && r.attempts) || [])].reverse(); return a.find((x) => x.status === "running") || a[0] || {}; },
    /** One card model for queue jobs, lane plan entries and backlog items. */
    card(src, kind, i) {
      const jr = kind === "running" || kind === "queued" ? this.jobRun(src).r : null;
      const id = kind === "backlog" || kind === "plan" ? src.id : jr ? jr.id : src.run_id, r = id && this.runById[id], p = id && this.planById[id];
      const att = this.runAttempt(r), m = att.metrics || {}, fam = r && {PromptDA: "PromptDA", Ours_SV: "SV", Ours_MV: "MV"}[r.tab];
      const stage = kind === "running" ? "running" : kind === "queued" ? "queued" : (src.stage_effective || src.stage || "planned");
      const name = kind === "backlog" ? src.name : (p && p.display_name) || (r && (r.display_name || r.title)) || (src.name || "").replace(/\.job$/, "");
      const si = ["planned", "built", "reviewed", "host-tested", "queued"].indexOf(p ? p.stage_effective : "");
      const det = [["Run id", id || "not mapped to a run"], ["Parent", (p && p.parent) || (r && r.parent_id) || src.parent],
        ["Lineage", r && r.lineage !== "n.a." ? r.lineage : ""], ["Owner", (p && p.owner) || src.owner],
        ["Unlock event", p && p.unlock_event !== p.waits_for ? p.unlock_event : ""],
        ["Next command", (p && p.next_command) || src.next_command], ["Job file", kind === "running" || kind === "queued" ? src.name : ""],
        ["Job sha", ((p && p.job_sha256) || src.sha256 || "").slice(0, 12)],
        ["Receipts", p ? `review ${si >= 2 ? "yes" : "no"} · preflight ${si >= 3 ? "yes" : "no"}` : ""],
        ["Last update", RB.relTime((p && p.updated) || att.heartbeat_at || (r && r.modified_at) || src.updated, this.now)]].filter(([, v]) => v);
      return {key: kind + ":" + (id || src.name) + ":" + (i || 0), kind, id, stage, label: this.STAGE[stage] || stage, pos: kind === "queued" ? i + 1 : 0,
        name, unmapped: (kind === "running" || kind === "queued") && !r,
        chips: this.chips((r && r.variant !== "\u2014" && r.variant) || (kind === "backlog" ? src.model : p && p.model) || fam,
          (kind === "backlog" ? src.dataset : p && p.dataset) || (r && r.dataset), (kind === "backlog" ? src.noise : p && p.noise) || (r && r.noise)),
        waits: kind === "plan" ? src.waits_for || src.unlock_event || "" : kind === "backlog" ? src.waits_for : "",
        step: m.step, budget: src.budget || {}, started: src.started,
        wandb: att.wandb_url || "", hosts: kind === "backlog" ? src.candidate_hosts || [] : [], det};
    },
    lane(h) {
      if (h.gone) return [];  // a destroyed machine has no queue or plan, only its finished jobs
      return [...(h.running || []).map((j, i) => this.card(j, "running", i)), ...(h.queued || []).map((j, i) => this.card(j, "queued", i)),
        ...(this.D.plan || []).filter((p) => p.host_key === h.k && p.run_status === "planned" && p.stage_effective !== "queued").map((p, i) => this.card(p, "plan", i))];
    },
    backlog() { return this.D ? (this.D.backlog || []).map((b, i) => this.card(b, "backlog", i)) : []; },
    num: (n) => (n == null ? "" : Number(n).toLocaleString("en-US")),
    /** Completion against the run's step budget (recipe cap, e.g. 200K for P2 SFT): '45,400 / 200,000 steps (23 %)'. */
    pct(c) { return c.step && c.budget.steps ? Math.min(100, Math.round(100 * c.step / c.budget.steps)) : 0; },
    progressText(c) { return c.budget.steps ? `${c.step ? this.num(c.step) : "\u2014"} / ${this.num(c.budget.steps)} steps` + (c.step ? ` (${this.pct(c)} %)` : "") : c.step ? `step ${this.num(c.step)}` : ""; },
    kfmt: (n) => (n % 1000 ? n.toLocaleString("en-US") : n / 1000 + "K"),
    rel(iso) { return RB.relTime(iso, this.now); },
    abs: (iso) => (iso ? new Date(iso).toLocaleString([], {dateStyle: "medium", timeStyle: "short"}) : ""),
    recent(h) { return [...(h.failed_recent || []), ...(h.done_recent || [])].sort((a, b) => (b.finished || "").localeCompare(a.finished || "")).slice(0, 6); },
    /** Run of a queue job: its mapped run, else its run-id hint (exact, then the longest run id the hint starts with,
     *  e.g. an eval job 'P2-SVp-SPP-ALL3-test96-…' belongs to P2-SVp-SPP). A mapped W&B-only run may since have been folded into its registry run. */
    jobRun(j) {
      const h = j.run_id_hint || "", ev = /(^|[_-])eval/i.test(j.name || "");  // an eval job is shown as '<run> · eval'
      if (j.run_id && this.runById[j.run_id]) return {r: this.runById[j.run_id], eval: ev};
      if (h && this.runById[h]) return {r: this.runById[h], eval: ev};
      const id = h && Object.keys(this.runById).filter((k) => h.startsWith(k + "-")).sort((a, b) => b.length - a.length)[0];
      return id ? {r: this.runById[id], eval: ev || /ALL3|test\d/i.test(h)} : {r: null, eval: false};
    },
    jobName(j) { const {r, eval: ev} = this.jobRun(j); return r ? (r.display_name || r.title) + (ev ? " \u00b7 eval" : "") : (j.name || "").replace(/\.job$/, ""); },
    destroyedOn: (iso) => (iso ? new Date(iso).toLocaleString([], {day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"}) : ""),
    seen(h) { return h.reachable ? "" : "offline · last seen " + RB.relTime(h.checked_at, this.now); },
    hostName: RB.hostName,
  }));
  Alpine.data("matrix", () => ({
    ...base("matrix"),
    WORDS: ["Done", "In progress", "Planned", "Not planned"], NOISES: ["lidar_low", "lower", "low"],
    slug: (w) => w.toLowerCase().replace(/\s+/g, "-"),
    dsName: (d) => ({THuman: "THuman-in-a-Box"}[d] || d),
    cells() { return (this.D && this.D.matrix) || []; },
    datasets() { return [...new Set(this.cells().map((c) => c.dataset))]; },
    total(w) { return this.cells().filter((c) => c.status === w).length; },
    /** Rows = model x chaining (PromptDA has no chaining), columns = noise; the model name is shown on its first row only. */
    rows(ds) {
      const out = [], cs = this.cells().filter((c) => c.dataset === ds);
      for (const c of cs) {
        const key = c.model + "|" + c.chain;
        let row = out.find((r) => r.key === key);
        if (!row) { row = {key, model: c.model, chain: c.chain, first: !out.some((r) => r.model === c.model), cells: []}; out.push(row); }
        row.cells.push(c);
      }
      return out;
    },
  }));
});

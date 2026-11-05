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
    "not planned": ""};
  /** Canonical value order per key (unknown values follow, alphabetically). */
  const ORDER = {dataset: ["Hypersim", "ScanNet++", "ARKitScenes", "THuman"], noise: ["lidar_low", "lower", "low", "none"],
    model: ["PromptDA-B", "PromptDA-L", "PromptDA-S", "Ours_SV", "Ours_MV2", "Ours_MV3"],
    status: ["running", "queued", "planned", "failed", "succeeded", "cancelled", "stale", "superseded", "not planned"]};
  const initRank = (v) => { if (!v || v === "clean") return "0"; const [f, d, par] = String(v).split("_");
    return `${"psm".indexOf(f[0]) + 1}${["hs", "spp", "as", "th"].indexOf(d) + 1 || 9}${par ? 1 : 0}${v}`; };
  const rank = (k, v) => { if (k === "init") return initRank(v); const o = ORDER[k] || [], i = o.indexOf(v);
    return i >= 0 ? String(i).padStart(3, "0") : "999" + String(v ?? "").toLowerCase(); };
  /** Every combination of the keys' domains in nested order (first key slowest, last fastest), minus those in `have`. */
  function combos(keys, domains, have) {
    let out = [[]];
    for (const k of keys) out = out.flatMap((c) => domains[k].map((v) => [...c, v]));
    return out.filter((c) => !have.has(c.join("\u0001")));
  }
  /** 'Ours_MV3' -> Ours<sub>MV3</sub> (escaped). */
  const modelHtml = (v) => { const m = /^Ours_([A-Za-z0-9]+)(.*)$/.exec(v || ""); return `<span class="mdl">${m ? `Ours<sub>${esc(m[1])}</sub>${esc(m[2])}` : esc(v || "\u2014")}</span>`; };
  /** Same labels as the runs table's Model column: 'MV(3)-B' / 'mv' -> Ours_MV3, 'SV-B' -> Ours_SV, 'promptda' -> PromptDA-B. */
  const canonModel = (v) => { const x = String(v || ""), m = /^MV\((\d+)\)-([BLS])$/.exec(x), l = x.toLowerCase();
    if (m) return m[2] === "B" ? `Ours_MV${m[1]}` : `Ours_MV${m[1]}-${m[2]}`;
    if (/^SV-([BLS])$/.test(x)) return x === "SV-B" ? "Ours_SV" : `Ours_SV-${x.slice(-1)}`;
    return {promptda: "PromptDA-B", pda: "PromptDA-B", sv: "Ours_SV", mv: "Ours_MV3"}[l] || x; };
  return {tabStore, HOSTS, hostName, hostTip, relTime, clock, kv, esc, decrypt, load, theme, ic, ICON, ORDER, rank, combos, modelHtml, canonModel};
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

const STATUS_ORDER = RB.ORDER.status;
const TABS = ["PromptDA", "Ours_SV", "Ours_MV", "Other", "Scratch"];
const rmse = (r) => { const m = r.summary_metrics || {}; return m.test_rmse != null ? [m.test_rmse, "test"] : m.dev_best_rmse != null ? [m.dev_best_rmse, "dev"] : [null, ""]; };
let RUNS_TABLE = null;  // the Tabulator instance (kept out of Alpine's reactive state)
const hostOf = (r) => { const a = [...(r.attempts || [])].reverse().find((x) => x.host); return a ? a.host : ""; };

document.addEventListener("alpine:init", () => {
  Alpine.data("runs", () => ({
    ...base("runs"),
    onReload() { if (RUNS_TABLE) RUNS_TABLE.replaceData(this.rows()); },
    q: "", f: {model: "", init: "", dataset: "", noise: "", status: ""}, sort: "modified_at", dir: -1, scratch: false,
    open: new URLSearchParams(location.search).getAll("open"), n: 0, dragK: null,
    FILTER_KEYS: ["model", "init", "dataset", "noise", "status"],
    KEY_LABEL: {model: "Model", init: "Init", dataset: "Dataset", noise: "Noise", status: "Status"},
    exh: {on: false, all: false, keys: [{k: "dataset", on: true}, {k: "noise", on: true}, {k: "model", on: true}, {k: "init", on: false}, {k: "status", on: true}]},
    NAME_PARTS: [
      {part: "mv3", label: "model", help: "promptda, sv, mv2, mv3 (MV with N views), dformer; misc_* = tools without a model family"},
      {part: "B", label: "size", help: "ViT encoder: B base, S small, L large"},
      {part: "svhs", label: "init", help: "what the weights start from: clean, pdahs, svhs, svhspar, mvhs, pdaspp, svspp, svas ... = Init column without '_'"},
      {part: "to", label: "", help: "separates the start from the training target"},
      {part: "scannetpp", label: "dataset", help: "training data of this run: hypersim, scannetpp, arkit, thuman"},
      {part: "lidarlow", label: "noise", help: "prompt noise preset: lidarlow, lower, low, none"},
      {part: "dpt01", label: "tag", help: "optional variant: dpt01, shuf, null, 24k, offset, fivebin, smoke, eval; _2, _3 for twins"}],
    afterLoad() {
      try { Object.assign(this, JSON.parse(sessionStorage.getItem("rb-runs") || "{}")); } catch (e) {}
      try { const x = JSON.parse(localStorage.getItem("rb-exh") || "null"); if (x && Array.isArray(x.keys) && x.keys.length === 5) this.exh = x; } catch (e) {}
      const want = this.open[0] && this.D.runs.find((r) => r.id === this.open[0]);
      if (want && want.kind === "scratch") this.scratch = true;
      const save = () => { try { sessionStorage.setItem("rb-runs", JSON.stringify({q: this.q, f: this.f, sort: this.sort, dir: this.dir, scratch: this.scratch})); } catch (e) {} };
      for (const k of ["q", "f", "sort", "dir", "scratch"]) this.$watch(k, save);
      this.$watch("q", () => this.refresh()); this.$watch("scratch", () => this.refresh());
      this.$watch("exh", () => { try { localStorage.setItem("rb-exh", JSON.stringify(this.exh)); } catch (e) {} this.refresh(); this.applySort(); }, {deep: true});
      this.$nextTick(() => this.mkTable());
    },
    refresh() { if (RUNS_TABLE) RUNS_TABLE.replaceData(this.rows()); },
    tabOf(r) { return r.kind === "scratch" ? "Scratch" : r.tab; },
    exhKeys() { return this.exh.keys.filter((k) => k.on).map((k) => k.k); },
    exhHint() { const ks = this.exhKeys(); return ks.length ? `${ks.map((k) => this.KEY_LABEL[k]).join(" › ")} — the last key changes fastest` : "pick at least one key"; },
    moveKey(i, d) { const ks = this.exh.keys, j = i + d; if (j < 0 || j >= ks.length) return; [ks[i], ks[j]] = [ks[j], ks[i]]; },
    dropKey(target) { const ks = this.exh.keys, i = ks.findIndex((k) => k.k === this.dragK), j = ks.findIndex((k) => k.k === target);
      if (i < 0 || j < 0 || i === j) return; const [x] = ks.splice(i, 1); ks.splice(j, 0, x); this.dragK = null; },
    base() { const words = this.q.toLowerCase().split(/\s+/).filter(Boolean);
      return this.D.runs.filter((r) => (this.scratch || r.kind !== "scratch") && words.every((w) => (r._s ??= JSON.stringify(r).toLowerCase()).includes(w))); },
    opts(k) { const v = [...new Set(this.base().map((r) => (k === "model" ? r.model : r[k])))].filter((x) => x && x !== "-" && x !== "all");
      if (this.exh.on && this.exh.all && k === "status") v.push("not planned");
      return v.sort((a, b) => RB.rank(k, a).localeCompare(RB.rank(k, b))); },
    /** Table rows: real runs, plus (exhaustive + all combinations) a muted 'not planned' row per missing key combination. */
    rows() {
      const real = this.base().map((r) => ({id: r.id, title: r.display_name || r.title, model: r.model || r.variant, init: r.init || "", dataset: r.dataset,
        noise: r.noise, status: r.status, rmse: rmse(r)[0], rsrc: rmse(r)[1], host: RB.hostName(hostOf(r)), hostTip: RB.hostTip(hostOf(r)),
        modified_at: r.modified_at || null, _r: r}));
      const keys = this.exhKeys().filter((k) => k !== "status");
      if (!(this.exh.on && this.exh.all && keys.length)) return real;
      const dflt = {dataset: ["Hypersim", "ScanNet++", "ARKitScenes", "THuman"], noise: ["lidar_low", "lower", "low"], model: ["PromptDA-B", "Ours_SV", "Ours_MV2", "Ours_MV3"], init: []};
      const dom = Object.fromEntries(keys.map((k) => [k, this.f[k] ? [this.f[k]] :
        [...new Set([...dflt[k], ...real.map((x) => x[k])])].filter((x) => x && x !== "all" && !(k === "model" && x === "Other")).sort((a, b) => RB.rank(k, a).localeCompare(RB.rank(k, b)))]));
      const have = new Set(real.map((x) => keys.map((k) => x[k]).join("\u0001")));
      return real.concat(RB.combos(keys, dom, have).map((c) => ({id: "~" + c.join("|"), title: "", status: "not planned", _virtual: true,
        model: "", init: "", dataset: "", noise: "", ...Object.fromEntries(keys.map((k, i) => [k, c[i]])), rmse: null, host: "", modified_at: null})));
    },
    applySort() {
      if (!RUNS_TABLE) return;
      const ks = this.exhKeys();
      // Tabulator applies the LAST sorter as the primary one, so the list runs from the fastest key to the slowest
      if (this.exh.on && ks.length) RUNS_TABLE.setSort([{column: "modified_at", dir: "desc"}, ...[...ks].reverse().map((k) => ({column: k, dir: "asc"}))]);
      else RUNS_TABLE.setSort(this.sort, this.dir > 0 ? "asc" : "desc");
    },
    /** One Tabulator table for all runs: 50 rows per page, sticky column titles, filterable Model / Init / Dataset / Noise / Status. */
    mkTable() {
      const self = this, esc = RB.esc, miss = (x) => x == null || x === "" || x === "-";
      const lastMissing = (a, b, ar, br, c, dir) => (miss(a) || miss(b) ? (miss(a) === miss(b) ? 0 : (miss(a) ? 1 : -1) * (dir === "asc" ? 1 : -1)) : a < b ? -1 : a > b ? 1 : 0);
      const ranked = (k) => (a, b, ar, br, c, dir) => (miss(a) || miss(b) ? lastMissing(a, b, ar, br, c, dir) : RB.rank(k, a).localeCompare(RB.rank(k, b)));
      const list = (k, fmt) => ({headerFilter: "list", headerFilterFunc: "=", headerFilterPlaceholder: "All",
        headerFilterParams: {valuesLookup: () => [{label: "All", value: ""}, ...self.opts(k).map((v) => ({label: v, value: v}))],
          ...(fmt ? {itemFormatter: (label, value) => (value ? fmt(value) : "All")} : {})}});
      const col = (o) => ({headerSortStartingDir: "asc", resizable: false, vertAlign: "top", ...o});
      const vMuted = (fn) => (c) => (c.getData()._virtual ? `<span class="muted">${fn(c) || "—"}</span>` : fn(c));
      RUNS_TABLE = new Tabulator(this.$refs.tbl, {
        data: this.rows(), index: "id", layout: "fitColumns", renderVertical: "basic", placeholder: "",
        pagination: true, paginationSize: 50, paginationCounter: "rows", paginationButtonCount: 5,
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
          col({title: "Run", field: "title", minWidth: 250, widthGrow: 3, responsive: 0, sorter: lastMissing,
            formatter: (c) => { const d = c.getData();
              if (d._virtual) return `<div class="rb-run"><div class="rb-name muted">no run</div><div class="rb-id">this combination has no run</div></div>`;
              return `<div class="rb-run"><div class="rb-name" title="${esc(d._r.title)}"><span class="car">${self.isOpen(d._r) ? "▾" : "▸"}</span>${esc(d.title).replace(/_/g, "_<wbr>")}</div><div class="rb-id" title="${esc(d.id)}">${esc(d.id)}</div></div>`; }}),
          col({title: "Model", field: "model", width: 128, responsive: 2, sorter: ranked("model"), ...list("model", RB.modelHtml), formatter: (c) => RB.modelHtml(c.getValue())}),
          col({title: "Init", field: "init", width: 112, responsive: 5, sorter: ranked("init"), ...list("init"), formatter: (c) => (c.getValue() ? `<code class="init">${esc(c.getValue())}</code>` : "")}),
          col({title: "Dataset", field: "dataset", width: 128, responsive: 6, sorter: ranked("dataset"), ...list("dataset")}),
          col({title: "Noise", field: "noise", width: 108, responsive: 7, sorter: ranked("noise"), ...list("noise")}),
          col({title: "Status", field: "status", width: 148, responsive: 1, ...list("status"), sorter: ranked("status"),
            formatter: (c) => `<span class="badge has-i s-${esc(c.getValue()).replace(" ", "-")}">${RB.ic(RB.ICON[c.getValue()] || "")}${esc(c.getValue())}</span>`}),
          col({title: "RMSE", field: "rmse", width: 118, hozAlign: "right", headerHozAlign: "right", responsive: 3, sorter: lastMissing, headerSortStartingDir: "desc",
            formatter: (c) => (c.getValue() == null ? `<span class="muted">-</span>` : `<span class="num">${c.getValue().toFixed(3)}</span><span class="tag">${esc(c.getData().rsrc)}</span>`)}),
          col({title: "Host", field: "host", width: 168, responsive: 8, sorter: lastMissing, formatter: vMuted((c) => c.getValue() ? `<span title="${esc(c.getData().hostTip)}">${esc(c.getValue())}</span>` : "")}),
          col({title: "Modified", field: "modified_at", width: 132, responsive: 4, headerSortStartingDir: "desc",
            sorter: (a, b) => (miss(a) || miss(b) ? (miss(a) === miss(b) ? 0 : miss(a) ? -1 : 1) : a < b ? -1 : a > b ? 1 : 0),  // not started = oldest
            formatter: (c) => (c.getData()._virtual ? "" : `<span class="num" title="${esc(self.abs(c.getValue()))}">${esc(self.when(c.getData()._r) || "not started")}</span>`)}),
        ],
        rowFormatter: (row) => self.renderDetails(row),
      });
      RUNS_TABLE.on("dataSorted", (sorters) => { if (!this.exh.on && sorters[0]) { this.sort = sorters[0].field; this.dir = sorters[0].dir === "asc" ? 1 : -1; } });
      RUNS_TABLE.on("dataFiltered", (filters, rows) => {
        this.n = rows.filter((r) => !r.getData()._virtual).length;
        const hf = Object.fromEntries(RUNS_TABLE.getHeaderFilters().map((x) => [x.field, x.value]));
        const nf = Object.fromEntries(this.FILTER_KEYS.map((k) => [k, hf[k] || ""]));
        if (JSON.stringify(nf) !== JSON.stringify(this.f)) { this.f = nf; if (this.exh.on && this.exh.all) setTimeout(() => this.refresh()); }
      });
      RUNS_TABLE.on("rowClick", (e, row) => { if (row.getData()._virtual || e.target.closest("a, button, .rb-det")) return; this.flip(row.getData()._r); row.reformat(); });
      RUNS_TABLE.on("tableBuilt", () => {
        this.n = RUNS_TABLE.getDataCount("active"); this.applySort();
        const id = this.open[0]; if (id && RUNS_TABLE.getRow(id)) RUNS_TABLE.setPageToRow(id).then(() => RUNS_TABLE.scrollToRow(id, "top", false)).catch(() => {});
      });
    },
    setFilter(k, v) { if (RUNS_TABLE) RUNS_TABLE.setHeaderFilterValue(k, v); },
    /** Attempt details below an open row: the Alpine template #det-tpl, scoped to the run. */
    renderDetails(row) {
      const el = row.getElement(), d = row.getData(), old = el.querySelector(":scope > .rb-det");
      if (old) { Alpine.destroyTree(old); old.remove(); }
      el.classList.toggle("virtual", !!d._virtual);
      if (d._virtual) return;
      const r = d._r; el.classList.toggle("open", this.isOpen(r));
      if (!this.isOpen(r)) return;
      const node = document.getElementById("det-tpl").content.firstElementChild.cloneNode(true);
      Alpine.mutateDom(() => el.appendChild(node));
      // Tabulator may format a row before attaching it to the page, so anchor the scope on the component root explicitly
      Alpine.addScopeToNode(node, {r}, document.querySelector("[x-data]")); Alpine.initTree(node);
    },
    /** Technical drawing of a run name: the name in monospace, a bracket under each segment and a leader line down to its label. */
    drawNames(svg) {
      if (!svg) return;
      const NS = "http://www.w3.org/2000/svg", mk = (t, a, txt) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); if (txt != null) e.textContent = txt; return e; };
      svg.replaceChildren();
      const parts = this.NAME_PARTS, name = parts.map((p) => p.part).join("_"), x0 = 16, y0 = 34;
      const t = mk("text", {x: x0, y: y0, class: "hn-name"}, name); svg.append(t);
      let i = 0; const segs = parts.map((p) => { const s = {p, a: t.getSubStringLength(0, i) + x0}; s.b = s.a + t.getSubStringLength(i, p.part.length); i += p.part.length + 1; return s; });
      let maxX = t.getComputedTextLength() + x0 * 2, rows = 1;
      const ends = [-1e9, -1e9, -1e9];
      for (const s of segs) {
        if (!s.p.label) continue;
        const mid = (s.a + s.b) / 2, lbl = mk("text", {x: mid, y: 0, class: "hn-label", "text-anchor": "middle"}, s.p.label);
        svg.append(lbl); const w = lbl.getComputedTextLength();
        const row = [0, 1, 2].find((r) => ends[r] < mid - w / 2 - 8) ?? 2; ends[row] = mid + w / 2; rows = Math.max(rows, row + 1);
        const ly = y0 + 40 + row * 24;
        lbl.setAttribute("y", ly);
        svg.append(mk("path", {class: "hn-br", d: `M${s.a + 1} ${y0 + 9} v6 M${s.a + 1} ${y0 + 12} H${s.b - 1} M${s.b - 1} ${y0 + 9} v6`}),
          mk("path", {class: "hn-lead", d: `M${mid} ${y0 + 12} V${ly - 13}`}), mk("circle", {class: "hn-dot", cx: mid, cy: y0 + 12, r: 2.2}));
        maxX = Math.max(maxX, mid + w / 2 + x0);
      }
      const h = y0 + 40 + (rows - 1) * 24 + 10;
      svg.setAttribute("viewBox", `0 0 ${Math.ceil(maxX)} ${h}`); svg.style.width = Math.min(860, Math.ceil(maxX * 1.45)) + "px";
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
      const m = ok(model) ? RB.canonModel(model) : "";
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
        chips: this.chips((r && r.model !== "Other" && r.model) || (kind === "backlog" ? src.model : p && p.model) || fam,
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
});

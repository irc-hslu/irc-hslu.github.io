"use strict";
/* Shared helpers for index.html and queues.html (Alpine components registered at the bottom). */
const RB = (() => {
  const HOSTS = {  // the single place for host display names
    local: {name: "IR-Hermes", gpu: "RTX 4090"}, iradonis: {name: "IR-Adonis", gpu: "RTX 4080"},
    desktop: {name: "charisoudisDesktop", gpu: "RTX 3090"}, ircopernicus: {name: "IR-Copernicus", gpu: "RTX 4090"},
  };
  const hostName = (k) => (HOSTS[k] ? HOSTS[k].name : k || "-");
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
    if (new URLSearchParams(location.search).has("local")) return (await fetch("../../specs/runboard/runs.json")).json();
    const blob = await (await fetch("./runs.enc.json", {cache: "no-store"})).json();
    const ok = async (pw) => { const d = await decrypt(blob, pw); try { sessionStorage.setItem("runboard_pw", pw); } catch (e) {} return d; };
    let saved = null; try { saved = sessionStorage.getItem("runboard_pw"); } catch (e) {}
    if (saved) { try { return await ok(saved); } catch (e) {} }
    return askPassword(ok);
  }
  const theme = {
    get() { const q = new URLSearchParams(location.search).get("theme"); if (q) return q; try { return localStorage.getItem("rb-theme"); } catch (e) { return null; } },
    apply(t) { if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme; },
    cycle() { // system -> light -> dark -> system
      const n = {null: "light", light: "dark", dark: null}[this.get()];
      try { n ? localStorage.setItem("rb-theme", n) : localStorage.removeItem("rb-theme"); } catch (e) {}
      this.apply(n); return n || "system";
    },
  };
  theme.apply(theme.get());
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-copy]"); if (!b) return;
    e.stopPropagation(); navigator.clipboard?.writeText(b.dataset.copy); b.textContent = "copied"; setTimeout(() => (b.textContent = "copy"), 1200);
  });
  return {HOSTS, hostName, hostTip, relTime, clock, kv, esc, decrypt, load, theme};
})();
if (typeof module !== "undefined") module.exports = RB;

/* Common page state: data, password gate, header. */
function base() {
  return {
    D: null, gate: false, err: "", pw: "", ok: null, themeLabel: RB.theme.get() || "system", now: Date.now(), RB,
    async init() {
      this.D = await RB.load((ok) => new Promise((res) => { this.gate = true; this.ok = async () => {
        try { const d = await ok(this.pw); this.gate = false; res(d); } catch (e) { this.err = "Wrong password."; } }; }));
      setInterval(() => (this.now = Date.now()), 30000);
      if (this.afterLoad) this.afterLoad();
    },
    toggleTheme() { this.themeLabel = RB.theme.cycle(); },
    // methods, not getters: object spread would freeze getter values at init (D still null)
    updated() { return this.D ? new Date(this.D.last_updated).toLocaleString([], {dateStyle: "medium", timeStyle: "short"}) : ""; },
    stale() { return !!this.D && this.now - new Date(this.D.last_updated) > 3 * 3600e3; },
    ago() { return this.D ? RB.relTime(this.D.last_updated, this.now) : ""; },
  };
}

const STATUS_ORDER = ["running", "queued", "planned", "failed", "succeeded", "cancelled", "superseded"];
const TABS = ["PromptDA", "Ours_SV", "Ours_MV", "Other", "Scratch"];
const rmse = (r) => { const m = r.summary_metrics || {}; return m.test_rmse != null ? [m.test_rmse, "test"] : m.dev_best_rmse != null ? [m.dev_best_rmse, "dev"] : [null, ""]; };
const hostOf = (r) => { const a = [...(r.attempts || [])].reverse().find((x) => x.host); return a ? a.host : ""; };

document.addEventListener("alpine:init", () => {
  Alpine.data("runs", () => ({
    ...base(), tab: decodeURIComponent(location.hash.slice(1)) || "PromptDA", q: "", f: {status: [], dataset: []},
    sort: "submitted_at", dir: -1, open: new URLSearchParams(location.search).getAll("open"), tabs: TABS,
    cols: [["title", "Run"], ["stage", "Stage", "hide-sm"], ["dataset", "Dataset", "hide-sm"], ["noise", "Noise", "hide-sm"], ["status", "Status"],
           ["rmse", "RMSE"], ["host", "Host", "hide-sm"], ["submitted_at", "Submitted"]],
    afterLoad() { for (const r of this.D.runs) if (this.open.includes(r.id)) { this.tab = this.tabOf(r); break; } },
    tabOf(r) { return r.kind === "scratch" ? "Scratch" : r.tab; },
    count(t) { return this.D ? this.D.runs.filter((r) => this.tabOf(r) === t).length : 0; },
    setTab(t) { this.tab = t; location.hash = t; this.f = {status: [], dataset: []}; },
    opts(k) { const v = [...new Set(this.D.runs.filter((r) => this.tabOf(r) === this.tab).map((r) => r[k]))].filter((x) => x && x !== "-");
      return k === "status" ? v.sort((a, b) => STATUS_ORDER.indexOf(a) - STATUS_ORDER.indexOf(b)) : v.sort(); },
    toggle(k, v) { const a = this.f[k], i = a.indexOf(v); i < 0 ? a.push(v) : a.splice(i, 1); },
    key(r, k) { return k === "rmse" ? rmse(r)[0] : k === "host" ? RB.hostName(hostOf(r)) : k === "status" ? STATUS_ORDER.indexOf(r.status) : r[k]; },
    setSort(k) { this.dir = this.sort === k ? -this.dir : (["title", "stage", "dataset", "noise", "host", "status"].includes(k) ? 1 : -1); this.sort = k; },
    get rows() {
      if (!this.D) return [];
      const words = this.q.toLowerCase().split(/\s+/).filter(Boolean);
      const rows = this.D.runs.filter((r) => this.tabOf(r) === this.tab &&
        Object.entries(this.f).every(([k, a]) => !a.length || a.includes(r[k])) &&
        words.every((w) => (r._s ??= JSON.stringify(r).toLowerCase()).includes(w)));
      const d = this.dir, miss = (x) => x == null || x === "" || x === "-";
      return rows.sort((a, b) => {
        const x = this.key(a, this.sort), y = this.key(b, this.sort);
        if (miss(x) !== miss(y)) return miss(x) ? (this.sort === "submitted_at" ? -d : 1) : (this.sort === "submitted_at" ? d : -1);
        return (x < y ? -1 : x > y ? 1 : 0) * d || a.id.localeCompare(b.id);
      });
    },
    isOpen(r) { return this.open.includes(r.id); },
    flip(r) { const i = this.open.indexOf(r.id); i < 0 ? this.open.push(r.id) : this.open.splice(i, 1); },
    rmse, hostOf, host: (r) => RB.hostName(hostOf(r)), tip: (r) => RB.hostTip(hostOf(r)),
    when(r) { return RB.relTime(r.submitted_at, this.now); },
    facts(r) { return RB.kv({id: r.id, kind: r.kind, lineage: r.lineage, parent: r.parent_id, notes: r.notes, source: r.source, ...Object.fromEntries(Object.entries(r.summary_metrics || {}).filter(([k, v]) => v != null && k !== "protocol").map(([k, v]) => ["metric " + k, typeof v === "number" ? +v.toFixed(4) : v])), protocol: (r.summary_metrics || {}).protocol, registry: r.registry}); },
    attFacts(a) { return RB.kv({"W&B name": a.wandb_name, "commit": a.code_commit, "worktree": a.worktree, "job file": a.job_file, "output dir": a.output_dir,
      "checkpoint": a.checkpoint, "checkpoint sha256": a.checkpoint_sha256, "eval files": a.eval_files, "failure reason": a.failure_reason, "raw status": a.raw_status,
      "metrics": a.metrics, "warm start parent": a.warm_start_parent, "notes": a.notes}); },
    span(a) { if (!a.started_at) return "not started"; const m = a.ended_at ? Math.round((new Date(a.ended_at) - new Date(a.started_at)) / 60000) : null;
      return RB.clock(a.started_at) + (a.ended_at ? " → " + RB.clock(a.ended_at) + (m >= 60 ? ` (${(m / 60).toFixed(1)} h)` : ` (${m} min)`) : ""); },
  }));
  Alpine.data("queues", () => ({
    ...base(),
    hosts() { return this.D ? Object.entries(this.D.queues || {}).map(([k, q]) => ({k, name: RB.hostName(k), tip: RB.hostTip(k), ...q})) : []; },
    runId(j) { return j.run_id; },
    pct(j) { return parseInt((j.progress || "").match(/\((\d+)%/)?.[1] || 0); },
    link(id) { const r = this.D.runs.find((x) => x.id === id); return `index.html?open=${encodeURIComponent(id)}#${r ? (r.kind === "scratch" ? "Scratch" : r.tab) : ""}`; },
    clock: RB.clock,
    seen(h) { return h.reachable ? "checked " + RB.relTime(h.checked_at, this.now) : (h.note || "offline"); },
  }));
});

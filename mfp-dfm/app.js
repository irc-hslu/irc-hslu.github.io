"use strict";
/* Shared helpers for index.html and queues.html (Alpine components registered at the bottom). */
const RB = (() => {
  const HOSTS = {  // the single place for host display names
    local: {name: "IR-Hermes", gpu: "RTX 4090"}, iradonis: {name: "IR-Adonis", gpu: "RTX 4080"},
    desktop: {name: "charisoudisDesktop", gpu: "RTX 3090"}, copernicus: {name: "IR-Copernicus", gpu: "RTX 4090"}, bebop: {name: "IR-Bebop", gpu: "RTX 3080"},
  };
  const gpuKey = (k) => /^(.+)\.gpu(\d+(?:-\d+)?)$/.exec(k || "");  // one queue per GPU on multi-GPU machines: '<host>.gpu<i>'
  const hostName = (k) => { const m = gpuKey(k); return m ? `${m[1]} \u00b7 GPU ${m[2].replace("-", "–")}` : HOSTS[k] ? HOSTS[k].name : k || "-"; };
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
  const ICON = {succeeded: "circle-check", running: "activity", queued: "hourglass", paused: "hourglass", planned: "clock", failed: "circle-x", cancelled: "ban", stopped: "ban",
    smoke: "flask-conical", stale: "clock", superseded: "archive", reviewed: "check", "host-tested": "flask-conical", built: "package",
    "not planned": ""};
  /** Canonical value order per key (unknown values follow, alphabetically). */
  const ORDER = {dataset: ["Hypersim", "ScanNet++", "ARKitScenes", "THuman"], noise: ["lidar_low", "lower", "low", "none"],
    model: ["PromptDA-B", "PromptDA-L", "PromptDA-S", "Ours_SV", "Ours_MV2", "Ours_MV3"],
    status: ["running", "paused", "queued", "planned", "failed", "succeeded", "cancelled", "stopped", "stale", "superseded", "not planned"]};
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
    if (/^MV-([BLS])$/.test(x)) return x === "MV-B" ? "Ours_MV3" : `Ours_MV3-${x.slice(-1)}`;  // MV without a view count = 3 views
    return {promptda: "PromptDA-B", pda: "PromptDA-B", sv: "Ours_SV", mv: "Ours_MV3"}[l] || x; };
  /** 54300 -> '54.3K', 200000 -> '200K', 1300000 -> '1.3M'. */
  const kfmt = (n) => (n == null ? "\u2014" : n < 1000 ? String(n) : n < 1e6 ? +(n / 1e3).toFixed(n < 1e4 ? 1 : 0) + "K" : +(n / 1e6).toFixed(1) + "M");
  return {tabStore, HOSTS, hostName, hostTip, relTime, clock, kv, esc, decrypt, load, theme, ic, ICON, ORDER, rank, combos, modelHtml, canonModel, kfmt};
})();
/** Toast text after a refresh: [message, kind]; same build timestamp = nothing new. */
/** Available GPU lanes of a runs.json: not destroyed, not excluded, reachable now. */
RB.availableGpus = (D) => (D ? Object.values(D.queues || {}).filter((q) => q.status !== "destroyed" && !q.excluded && q.reachable).length : 0);
RB.refreshMsg = (before, after) => (before && after && before === after ? ["Already up to date", "same"] : ["Updated just now", "ok"]);
/** Lanes of one multi-GPU machine (keys host.gpuN, adjacent in display order) -> {key: {pos: first|mid|last, machine, n}};
 *  single-GPU hosts get no entry. */
RB.laneGroups = (keys) => {
  const m = (k) => k.replace(/\.gpu\d+(-\d+)?$/, ""), out = {};
  keys.forEach((k, i) => {
    if (!/\.gpu\d+(-\d+)?$/.test(k)) return;
    const same = keys.filter((x) => /\.gpu\d+(-\d+)?$/.test(x) && m(x) === m(k));
    if (same.length < 2) return;
    const prev = i > 0 && m(keys[i - 1]) === m(k) && /\.gpu\d+(-\d+)?$/.test(keys[i - 1]), next = i < keys.length - 1 && m(keys[i + 1]) === m(k) && /\.gpu\d+(-\d+)?$/.test(keys[i + 1]);
    out[k] = {pos: !prev ? "first" : next ? "mid" : "last", machine: m(k), n: same.length};
  });
  return out;
};
/** GPU memory capacity in GB: an explicit 'NN GB' in the GPU label (e.g. vastai_3 RTX 4080 SUPER 32 GB), else by model. */
RB.vramGb = (gpu) => { const m = /(\d+)\s*GB\b/.exec(gpu || ""); if (m) return +m[1];
  return /4090|3090/.test(gpu || "") ? 24 : /4080/.test(gpu || "") ? 16 : null; };
/** nvidia-smi '92 %, 13029 MiB' -> 'Util: 13/32 GB @ 92%' (memory rounded to whole GB, capacity after the slash). */
/** Text of a lane with no queued run: busy when the live GPU reading shows work (evaluations, renders and other jobs are not registry runs). */
RB.emptyLane = (h) => {
  const m = /(\d+)\s*%\s*,\s*(\d+)\s*MiB/.exec((h && h.gpu_status) || "");
  if (m && (+m[1] >= 10 || +m[2] >= 1024)) return "Busy (job outside the queue)";
  return "IDLE";
};
RB.isIdleLane = (h) => RB.emptyLane(h) === "IDLE";
/** A recently finished job counts as done when its state says so or it reached its planned steps (rental runs carry no exit code). */
RB.jobDone = (j) => !!j && (["done", "finished", "succeeded"].includes(j.state) || (j.step && j.budget && j.budget.steps && j.step >= j.budget.steps - 1));
RB.liveLine = (status, gpu) => {
  const m = /^\s*(\d+)\s*%\s*,\s*(\d+)\s*MiB/.exec(status || ""); if (!m) return status ? "GPU " + status : "";  // no telemetry: '' (the lane shows the run instead)
  const cap = RB.vramGb(gpu);
  return `Util: ${Math.round(+m[2] / 1024)}${cap ? "/" + cap : ""} GB @ ${m[1]}%`;
};
/** Paper cells of a run (all attempts): [{table, row, metric, value, update, receipt, selection_basis}]. */
/** Live state of a running run for its Steps cell: ETA and the STALE flag (from the build's per-run live_state). */
RB.liveBits = (r) => { const l = r && r.live_state; if (!l) return ""; return (l.eta ? `<div class="muted" title="ETA from the run's own rate">ETA ${new Date(l.eta).toLocaleString([], {weekday: "short", hour: "2-digit", minute: "2-digit"})}</div>` : "") + (l.stale ? `<div class="badge st-failed" title="${RB.esc(l.stale)}">STALE</div>` : ""); };
/** Ablation runs: registry ids ABL-* (one variant of the ablation recipe per run). */
RB.isAbl = (r) => /^ABL-/.test((r && (r.run_id || r.id || r.name)) || "");
/** Cited in the paper's ablation table (Table 3) by a registry paper cell. */
RB.inAblTable = (r) => !!r.paper && /(^|; )table_3 \//.test(r.paper_label || "");
RB.paperCells = (r) => (r && r.attempts || []).flatMap((a) => a.paper_cells || []);
/** Tooltip for one paper cell: table, row, value and selection basis. */
RB.paperTip = (c) => `Paper: ${c.table} \u00b7 ${c.row} \u00b7 ${c.metric.toUpperCase()} ${(+c.value).toFixed(4)} \u00b7 ${c.selection_basis} (${c.receipt})`;
/** The cited cell for a shown metric value (same number to 1e-9), else null. */
RB.citedCell = (r, metric, v) => (v == null ? null : RB.paperCells(r).find((c) => c.cited !== false && c.metric === metric && Math.abs(c.value - v) < 1e-9) || null);
/** Supabase run registry: runs.json carries {supabase: {url, anon_key}} (public, read-only key; inside the encrypted data). The page polls
 *  runs + events every 60 s and overlays them on the static build; without the config nothing happens and the static build is shown. */
RB.registry = {
  POLL_MS: 15 * 60 * 1000, FIELDS: "run_id,wandb_id,dataset,model,preset,parent_sha,host,gpu,code_sha,state,step,total,ref_tuples_seen,rate_steps_per_h,eta,heartbeat_at,last_val,best,eval,paper_role,notes,title,kind,updated_at,queue_pos",
  STATUS: {finished: "succeeded"}, ACTIVE: ["running", "paused", "stale"],
  TAB: {promptda: "PromptDA", sv: "Ours_SV", mv: "Ours_MV"}, MODEL: {promptda: "PromptDA-B", sv: "Ours_SV", mv: "Ours_MV3"},
  DATASET: {scannetpp: "ScanNet++", hypersim: "Hypersim", arkitscenes: "ARKitScenes", arkit: "ARKitScenes", thuman: "THuman"},
  async fetch(cfg) {
    const h = {apikey: cfg.anon_key, Authorization: "Bearer " + cfg.anon_key}, get = async (q) => { const r = await fetch(`${cfg.url.replace(/\/$/, "")}/rest/v1/${q}`, {headers: h, cache: "no-store"}); if (!r.ok) throw new Error("registry " + r.status); return r.json(); };
    const opt = (q) => get(q).catch(() => []);  // v2 tables: a registry without them still serves runs + events
    const [runs, events, evals, cells, hosts] = await Promise.all([get(`runs?select=${this.FIELDS}&order=updated_at.desc&limit=1000`), get("events?select=run_id,at,kind,payload&order=at.desc&limit=30"),
      opt("evals?select=id,run_id,protocol,cohort,geometry,frames,metrics&order=created_at.desc&limit=1000"), opt("paper_cells?select=paper_table,row_label,column_label,eval_id&limit=1000"), opt("hosts?select=host,status,kind,gpus,gpu_status,gpu_status_at")]);
    // 'paper' = a number that landed in the main manuscript: supplementary tables do not tag a run
    const main = (cells || []).filter((c) => !/supp/i.test(c.paper_table || ""));
    return {runs, events, evals, cells: main, hosts, at: Date.now()};
  },
  /** Overlay registry rows on D.runs in place: live columns for runs the registry says are active (or the build still shows running); rows without a static run are added. */
  apply(D, live) {
    const byId = new Map(D.runs.map((r) => [r.id, r])), byWb = new Map(D.runs.flatMap((r) => (r.attempts || []).filter((a) => a.wandb_id).map((a) => [a.wandb_id, r])));
    const runOfEval = new Map((live.evals || []).map((e) => [e.id, e.run_id])), cited = new Set((live.cells || []).map((c) => runOfEval.get(c.eval_id)));
    for (const w of live.runs) {
      if (w.kind === "ckpt" && !cited.has(w.run_id)) continue;  // stub run that only anchors evals of a checkpoint no run claims: shown only when a paper cell cites it
      const status = this.STATUS[w.state] || w.state, pct = w.step != null && w.total ? Math.round(1000 * w.step / w.total) / 10 : null;
      const l = w.last_val || {}, b = w.best || {}, row = (l.rmse != null || b.l1 != null) ? {rmse: l.rmse ?? null, mae: b.l1 ?? l.l1 ?? null, src: "dev", tip: "dev: validation reported to the run registry" + (b.step != null ? ` (best at step ${b.step})` : "")} : null;
      const att = {status, host: w.host, gpu: w.gpu, heartbeat_at: w.heartbeat_at, wandb_id: w.wandb_id, code_commit: w.code_sha, metrics: {step: w.step, max_steps: w.total},
        val_last: l.rmse != null ? {rmse: l.rmse, mae: l.l1, absrel: l.abs_rel} : null, source: "registry"};
      const state = {step: w.step, total: w.total, pct, rate_per_h: w.rate_steps_per_h, eta: w.eta, stale: w.state === "stale" ? "STALE: registry heartbeat older than 30 min (state running)" : null};
      let r = byId.get(w.run_id) || byWb.get(w.wandb_id);
      // the static build can group several registry runs under one W&B group row (e.g. 'ABL-AS' holding ABL-AS-REF and ABL-AS-NP):
      // the registry run id wins; its attempt leaves the group row, and an emptied group row is dropped
      if (r && w.run_id && r.id !== w.run_id) {
        r.attempts = (r.attempts || []).filter((x) => x.wandb_id !== w.wandb_id);
        if (!r.attempts.length) { D.runs.splice(D.runs.indexOf(r), 1); byId.delete(r.id); }
        r = null;
      }
      if (!r) {
        r = {id: w.run_id, title: w.run_id, display_name: w.run_id, kind: "main", source: "registry", tab: this.TAB[w.model] || "Other", model: this.MODEL[w.model] || w.model || "Other",
          dataset: this.DATASET[w.dataset] || w.dataset, sft: this.DATASET[w.dataset] || w.dataset, noise: w.preset || "none", attempts: [att], status, notes: w.notes};
        D.runs.push(r); byId.set(r.id, r);
      } else if (!(this.ACTIVE.includes(w.state) || r.status === "running")) continue;
      else {
        const a = [...(r.attempts || [])].reverse().find((x) => w.wandb_id && x.wandb_id === w.wandb_id) || [...(r.attempts || [])].reverse().find((x) => x.status !== "smoke");
        if (a) { Object.assign(a, {status, heartbeat_at: w.heartbeat_at || a.heartbeat_at, metrics: {...a.metrics, step: w.step ?? (a.metrics || {}).step, max_steps: w.total ?? (a.metrics || {}).max_steps}}); }
        else (r.attempts = r.attempts || []).push(att);
        r.status = status;
      }
      r.live_state = state; r.steps = {...r.steps, done: w.step, cap: w.total}; r.modified_at = w.updated_at;
      // a row the static build does not know (runs started on rentals) gets its details from the registry, so its expanded view is complete
      if (r.source === "registry") Object.assign(r, {
        stage: /^ABL-/.test(w.run_id) ? "ablation" : /^P2-|^S2-/.test(w.run_id) ? "fine-tuning" : r.stage || "",
        pretrain: w.parent_sha ? "Hypersim" : r.pretrain, sft: r.dataset, variant: [r.model, w.preset].filter(Boolean).join(" \u00b7 "),
        init: w.parent_sha ? `parent sha ${w.parent_sha.slice(0, 8)}` : r.init, parent_id: r.parent_id,
        steps: (() => { const batch = /^ABL-/.test(w.run_id) ? 16 : /-TH/.test(w.run_id) ? 4 : (r.steps || {}).batch;  // global batch of the ablation / THuman recipes
          return {...r.steps, batch, views: /MV/.test(r.model || "") ? 3 : 1, samples: batch && w.step != null ? batch * w.step : (r.steps || {}).samples}; })(),
        metrics_last: w.last_val ? {rmse: w.last_val.rmse, mae: w.last_val.l1, absrel: w.last_val.abs_rel, src: "dev"} : r.metrics_last,
        metrics_best: w.best ? {rmse: w.best.rmse, mae: w.best.l1, absrel: w.best.abs_rel, src: "dev"} : r.metrics_best,
        notes: w.notes || r.notes});
      if (row && (!r.row || r.source === "registry")) r.row = row;
      if (w.eval && !r.test_full) r.test_full = w.eval;
    }
    D.registry_events = live.events;
    this.applyV2(D, live, byId);
  },
  /** evals -> eval badge (latest eval with MAE/RMSE of a run whose row is not an eval yet), paper_cells -> 'paper' label, hosts -> offline hosts. */
  applyV2(D, live, byId) {
    const byEval = new Map((live.evals || []).map((e) => [e.id, e])), runOf = new Map([...byEval].map(([id, e]) => [id, e.run_id])), pick = new Map();
    for (const c of live.cells || []) { const e = byEval.get(c.eval_id); if (e && !pick.has(e.run_id)) pick.set(e.run_id, e); }  // the eval a paper cell cites wins over the newest one
    for (const e of live.evals || []) if (!pick.has(e.run_id)) { const r = byId.get(e.run_id); if (r && !(r.row && r.row.src === "eval")) pick.set(e.run_id, e); }  // newest first
    for (const [id, e] of pick) {
      const r = byId.get(id), m = e.metrics || {};
      if (!r || m.mae == null || m.rmse == null) continue;
      const evalp = e.protocol === "promptda_reimpl_author_mesh";  // PromptDA evaluation protocol (ScanNet++ default): tagged EVALP
      r.row = {rmse: m.rmse, mae: m.mae, src: "eval", evalp, tip: `eval: ${e.cohort} (${e.geometry}${e.frames ? ", " + e.frames + " frames" : ""}), registry${evalp ? "; EVALP = PromptDA evaluation protocol" : ""}`};
    }
    // the registry's paper_cells are the current paper: they replace the static labels (old receipts cite tables the paper no longer has)
    if ((live.cells || []).length) for (const r of D.runs || []) { r.paper = false; r.paper_label = ""; }
    for (const c of live.cells || []) {
      const r = byId.get(runOf.get(c.eval_id)); if (!r) continue;
      const shown = pick.get(r.id) && pick.get(r.id).id === c.eval_id, e = byEval.get(c.eval_id);  // a cell citing another eval than the badge's says which cohort it is
      r.paper = true; r.paper_label = [...new Set([...(r.paper_label ? r.paper_label.split("; ") : []), `${c.paper_table} / ${c.row_label} / ${c.column_label}${shown ? "" : ` (other eval: ${e.cohort}, ${e.geometry}, eval #${e.id})`}`])].join("; ");
    }
    // the registry's host status (stopped/destroyed/online) applies to the machine and all of its GPU lanes
    for (const h of live.hosts || []) for (const [k, q] of Object.entries(D.queues || {})) if (k === h.host || k.startsWith(h.host + ".gpu")) q.status = h.status;
    // a static 'running' job at its full step budget has finished (the host's queue file is not updated after the end)
    for (const q of Object.values(D.queues || {})) {
      const done = (q.running || []).filter((j) => j.step && j.budget && j.budget.steps && j.step >= j.budget.steps && !(live.runs || []).some((w) => w.run_id === j.run_id && w.state === "running"));
      if (!done.length) continue;
      q.running = q.running.filter((j) => !done.includes(j));
      q.done_recent = [...done.map((j) => ({...j, state: "done", finished: j.heartbeat_at || j.started || ""})), ...(q.done_recent || [])];
    }
    // online rented machines get one lane per GPU ('<host>.gpuN') or one lane; existing lanes are kept as they are
    D.queues = D.queues || {};
    for (const h of live.hosts || []) {
      if (h.kind !== "rental" || h.status !== "online") continue;
      const gpus = h.gpus || [], label = (gpus[0] || {}).gpu || "", per = (h.gpu_status || []).length;  // one lane per GPU: from the row, else its live readings
      const n = Math.max(gpus.reduce((s, g) => s + (g.count || 0), 0), per);
      const keys = n > 1 ? [...Array(n).keys()].map((i) => `${h.host}.gpu${i}`) : Object.keys(D.queues).some((k) => k.startsWith(h.host + ".gpu")) ? [] : [h.host];
      for (const k of keys) D.queues[k] = D.queues[k] || {gpu: "", gpu_label: label, reachable: true, status: "online", running: [], queued: [], paused: [], failed_recent: [], done_recent: []};
      // per-GPU 'util %, MiB' from out/vast_gpu_status.sh (every 10 min); older than 30 min is not shown
      if (h.gpu_status && Date.now() - new Date(h.gpu_status_at) < 30 * 60e3) keys.forEach((k, i) => { if (h.gpu_status[i]) D.queues[k].gpu_status = h.gpu_status[i]; });
    }
    // our machines (single GPU, lane key = host) get the same live 'util %, MiB' line; it replaces the static snapshot's value
    for (const h of live.hosts || []) {
      // a local host without a static lane (e.g. added later) still gets one, so its live load shows
      if (h.kind === "local" && h.gpu_status && h.host !== "cotenants") D.queues[h.host] = D.queues[h.host] || {gpu: "", gpu_label: (RB.HOSTS[h.host] || {}).gpu || "", reachable: true, status: "online", running: [], queued: [], paused: [], failed_recent: [], done_recent: []};
      const q = (D.queues || {})[h.host];
      if (h.kind === "local" && q && h.gpu_status && Date.now() - new Date(h.gpu_status_at) < 30 * 60e3) q.gpu_status = h.gpu_status[0];
    }
    for (const w of live.runs || []) {
      const span = /^(.+)\.gpu(\d+)-(\d+)$/.exec(w.host || "");
      if (!span || !["finished", "failed", "crashed"].includes(w.state)) continue;
      for (let i = +span[2]; i <= +span[3]; i++) {
        const q = D.queues[`${span[1]}.gpu${i}`]; if (!q) continue;
        const f = w.state === "finished" ? (q.done_recent = q.done_recent || []) : (q.failed_recent = q.failed_recent || []);
        if (!f.some((j) => j.run_id === w.run_id || j.name === w.run_id)) f.push({name: w.run_id, run_id: w.run_id, finished: w.heartbeat_at, step: w.step});
      }
    }
    // running/stale registry runs go into their host's lane: the static queue snapshot can be old (its monitor is off)
    const ALIAS = {"IR-Hermes": "local", "IR-Adonis": "iradonis", charisoudisDesktop: "desktop", "IR-Copernicus": "copernicus", "IR-Bebop": "bebop"};  // registry host names of our machines -> lane keys
    for (const w of live.runs || []) if (ALIAS[w.host]) w.host = ALIAS[w.host];
    for (const w of live.runs || []) {
      if (!["running", "stale"].includes(w.state) || !w.host) continue;
      // 'vast_4x.gpu0-1' = one run on GPUs 0 and 1: its card sits in GPU 0's lane and is drawn across GPU 1's lane (like colspan);
      // GPU 1's lane holds an empty placeholder of the same height, and both lanes keep their own queue and finished list
      const span = /^(.+)\.gpu(\d+)-(\d+)$/.exec(w.host);
      const keys = span ? [...Array(+span[3] - +span[2] + 1).keys()].map((i) => `${span[1]}.gpu${+span[2] + i}`)
        : [D.queues[w.host] ? w.host : D.queues[`${w.host}.gpu0`] ? `${w.host}.gpu0` : w.host];  // bare machine name -> its first GPU lane
      keys.forEach((key, i) => {
        const q = D.queues[key] = D.queues[key] || {gpu: "", running: [], queued: [], paused: [], failed_recent: [], done_recent: []};
        if (Date.now() - new Date(w.heartbeat_at) < 30 * 60e3) q.reachable = true;
        q.running = q.running || [];
        // shortcut: a run that leaves running stays in its lane until the page reloads, the static build replaces it then
        if (!q.running.some((j) => j.run_id === w.run_id)) q.running.push({name: w.run_id, run_id: w.run_id, budget: w.total ? {steps: w.total} : {}, step: w.step, heartbeat_at: w.heartbeat_at, span: i ? 0 : keys.length, ghost: i > 0});  // card() reads budget.steps for the bar and total; the lane line reads step, heartbeat_at
      });
    }
    // planned registry runs with a host and queue_pos are the next runs of that GPU (pair), in queue_pos order;
    // a GPU pair ('vast_bg.gpu2-3') spans its columns like a running run; a run already in the static plan is not repeated
    const inPlan = new Set((D.plan || []).filter((p) => p.host_key && p.run_status === "planned" && p.stage_effective !== "queued").map((p) => p.id));  // plan cards already drawn in a lane
    for (const w of [...(live.runs || [])].filter((x) => x.state === "planned" && x.host && x.queue_pos != null && !inPlan.has(x.run_id)).sort((a, b) => a.queue_pos - b.queue_pos)) {
      const span = /^(.+)\.gpu(\d+)-(\d+)$/.exec(w.host);
      const keys = span ? [...Array(+span[3] - +span[2] + 1).keys()].map((i) => `${span[1]}.gpu${+span[2] + i}`) : [D.queues[w.host] ? w.host : `${w.host}.gpu0`];
      keys.forEach((key, i) => {
        const q = D.queues[key]; if (!q) return;
        q.queued = q.queued || [];
        if (!q.queued.some((j) => j.run_id === w.run_id)) q.queued.push({name: w.run_id, run_id: w.run_id, budget: w.total ? {steps: w.total} : {}, span: i ? 0 : keys.length, ghost: i > 0});
      });
    }
  },
};

/** A multi-GPU machine's finished list (first lane, data-gspan = its GPU count): as wide as all of its lanes; the other lanes hold a
 *  placeholder of the same height and the machine's lanes share one height, so the list sits at the bottom across the whole machine. */
RB.spanRecent = () => {
  const phone = matchMedia("(max-width:720px)").matches;
  for (const d of document.querySelectorAll("details.hl-recent[data-gspan]")) {
    const lanes = [d.closest(".hlane")];
    while (lanes.length < +d.dataset.gspan && lanes[lanes.length - 1].nextElementSibling) lanes.push(lanes[lanes.length - 1].nextElementSibling);
    const ghosts = lanes.slice(1).map((l) => l.querySelector(".hl-recent-ghost")).filter(Boolean);
    lanes.forEach((l) => { l.style.minHeight = ""; });
    if (phone || !d.offsetParent) { d.style.width = ""; ghosts.forEach((g) => { g.style.height = "0px"; }); continue; }
    const last = lanes[lanes.length - 1], box = last.querySelector(".hl-cards") || last, w = box.getBoundingClientRect().right - d.getBoundingClientRect().left;
    if (Math.abs(d.offsetWidth - w) > 1) d.style.width = `${w}px`;
    ghosts.forEach((g) => { g.style.height = `${d.offsetHeight}px`; });
    const h = Math.max(...lanes.map((l) => l.offsetHeight));
    lanes.forEach((l) => { l.style.minHeight = `${h}px`; });
  }
};
document.addEventListener("toggle", (e) => { if (e.target.matches && e.target.matches("details.hl-recent, details.qcard")) RB.spanCards(); }, true);
/** A run on n GPUs: widen its card from its own lane to the right edge of the (n-1)-th next lane; its placeholders get the same height. */
RB.spanCards = () => {
  RB.spanRecent();
  for (const c of document.querySelectorAll("details.qcard[data-span]")) {
    let lane = c.closest(".hlane");
    for (let i = 1; i < +c.dataset.span && lane.nextElementSibling; i++) lane = lane.nextElementSibling;
    const box = lane.querySelector(".hl-cards") || lane, w = box.getBoundingClientRect().right - c.getBoundingClientRect().left;
    if (Math.abs(c.offsetWidth - w) > 1) c.style.width = `${w}px`;
    for (const g of document.querySelectorAll(`details.qcard.ghost[data-rid="${CSS.escape(c.dataset.rid)}"]`)) g.style.height = `${c.offsetHeight}px`;
  }
};

if (typeof module !== "undefined") module.exports = RB;

/* Common page state: data, password gate, header. */
function base(page) {
  return {
    page, D: null, gate: false, err: "", pw: "", ok: null, dark: RB.theme.isDark(), now: Date.now(), RB, loading: false, syncing: false, live: null, toast: {msg: "", kind: "", n: 0},
    ic: RB.ic, badgeHtml: (st, label) => RB.ic(RB.ICON[st] || "") + RB.esc(label ?? st),
    /** Keep --hdr-h = height of the sticky top bar, so sticky table headers sit right below it. */
    watchHeader() {
      const h = document.querySelector(".wrap:not(.skel) header.top"); if (!h || typeof ResizeObserver === "undefined") return;
      new ResizeObserver(() => document.documentElement.style.setProperty("--hdr-h", h.offsetHeight + "px")).observe(h);
    },
    /** Header reload: sync W&B -> registry (Edge Function sync-wandb; a failure falls through to a plain reload), then fetch and
     *  decrypt the data again (saved password), with a visible spinner for at least ~0.5 s. */
    async reload() {
      if (this.loading) return;
      this.loading = true; const t0 = Date.now(), before = this.D && this.D.last_updated;
      let msg = ["Refresh failed", "err"];
      try {
        await this.syncWandb();
        this.D = await RB.load(() => Promise.reject(new Error("locked"))); this.now = Date.now(); if (this.onReload) this.onReload(); this.pollLive();
        msg = RB.refreshMsg(before, this.D && this.D.last_updated);
      } catch (e) { /* keep the data we have */ }
      finally { setTimeout(() => { this.loading = false; this.notify(...msg); }, Math.max(0, 500 - (Date.now() - t0))); }
    },
    /** POST /functions/v1/sync-wandb with the anon key (at most 20 s); true when the registry was updated. */
    async syncWandb() {
      const cfg = this.D && this.D.supabase; if (!cfg) return false;
      this.syncing = true;
      try {
        const r = await fetch(`${cfg.url.replace(/\/$/, "")}/functions/v1/sync-wandb`, {method: "POST", headers: {apikey: cfg.anon_key, Authorization: "Bearer " + cfg.anon_key},
          signal: AbortSignal.timeout(20000)});
        return r.ok;
      } catch (e) { return false; } finally { this.syncing = false; }
    },
    /** Registry overlay (Supabase, anon key from the data): fetched once now and every 60 s; a failure keeps the static data and shows no live badge. */
    async pollLive() {
      const cfg = this.D && this.D.supabase; if (!cfg) return;
      try { const live = await RB.registry.fetch(cfg); RB.registry.apply(this.D, live); this.live = live; this.now = Date.now(); if (this.onReload) this.onReload(); }
      catch (e) { this.live = null; }
    },
    /** Bottom-right toast in a persistent role=status region; auto-dismisses after ~3 s (a newer toast restarts the timer). */
    notify(msg, kind) {
      const n = this.toast.n + 1; this.toast = {msg, kind, n};
      setTimeout(() => { if (this.toast.n === n) this.toast = {msg: "", kind, n}; }, 3000);
    },
    async init() {
      this.D = await RB.load((ok) => new Promise((res) => { this.gate = true; this.ok = async () => {
        try { const d = await ok(this.pw); this.gate = false; res(d); } catch (e) { this.err = "Wrong password."; } }; }));
      setInterval(() => (this.now = Date.now()), 30000);
      this.pollLive(); setInterval(() => this.pollLive(), RB.registry.POLL_MS);
      this.$nextTick(() => this.watchHeader());
      if (this.afterLoad) this.afterLoad();
    },
    toggleTheme() { this.dark = RB.theme.toggle(); },
    // methods, not getters: object spread would freeze getter values at init (D still null)
    updated() { return this.D ? new Date(this.D.last_updated).toLocaleString([], {dateStyle: "medium", timeStyle: "short"}) : ""; },
    stale() { return !!this.D && !this.live && this.now - new Date(this.D.last_updated) > 3 * 3600e3; },
    ago() { return this.D ? RB.relTime(this.D.last_updated, this.now) : ""; },
    liveTip() { return this.live ? "Run registry (Supabase), polled every 15 min (use the reload button for an immediate update). Latest events:\n" + (this.live.events || []).slice(0, 8).map((e) => `${RB.relTime(e.at, this.now)} ${e.run_id} ${e.kind}`).join("\n") : ""; },
  };
}

const STATUS_ORDER = RB.ORDER.status;
const TABS = ["PromptDA", "Ours_SV", "Ours_MV", "Other", "Scratch"];
/** [MAE, 'eval'|'dev']: eval l1 when the run has an eval RMSE (same receipt), else the best dev MAE. */
/** Row metrics = the run's current (primary) attempt (build.row_metrics), null when it has none yet; only data built
 *  before r.row existed (schema < 4) falls back to the run summary. */
const mae = (r) => { if (r.row) return [r.row.mae ?? null, r.row.src]; const m = r.summary_metrics || {}; return m.test_rmse != null ? [m.test_mae ?? null, "eval"] : [(r.metrics_best || {}).mae ?? null, "dev"]; };
const rmse = (r) => { if (r.row) return [r.row.rmse ?? null, r.row.src];  // current attempt only: null renders '—', never another attempt's value
   const m = r.summary_metrics || {}; return m.test_rmse != null ? [m.test_rmse, "eval"] : m.dev_best_rmse != null ? [m.dev_best_rmse, "dev"] : [null, ""]; };
/** Tooltip of the badge when the row carries no tip (schema < 4): eval = a finished run's receipt, dev = best W&B validation. */
const SRC_TIP = {eval: "eval = proper evaluation receipt of the finished run", dev: "dev = best W&B validation during training"};
const srcTip = (r) => (r.row && r.row.tip) || SRC_TIP[rmse(r)[1]] || "";
const evalpTag = (r) => (r && r.row && r.row.evalp ? ' <span class="tag" title="PromptDA evaluation protocol (promptda_reimpl_author_mesh)">EVALP</span>' : "");
let RUNS_TABLE = null, RUNS_EL = null;  // the Tabulator instance (kept out of Alpine's reactive state)
const hostOf = (r) => { const a = [...(r.attempts || [])].reverse().find((x) => x.host); return a ? a.host : ""; };

document.addEventListener("alpine:init", () => {
  /** Root component: data (decrypted once), password gate, header, hash routes #/runs and #/queues, run-names modal. */
  Alpine.data("app", () => {
    const b = base("app");
    return {
      ...b, route: "runs", params: new URLSearchParams(), scratch: false, nameModal: false, _lastFocus: null,
      NAME_PARTS: [
        {part: "mv3", label: "model", help: "promptda, sv, mv2, mv3 (MV with N views), dformer; misc_* = tools without a model family"},
        {part: "B", label: "size", help: "ViT encoder: B base, S small, L large"},
        {part: "svhs", label: "init", help: "what the weights start from: clean, pdahs, svhs, svhspar, mvhs, pdaspp, svspp, svas ... = Init column without '_'"},
        {part: "to", label: "", help: "separates the start from the training target"},
        {part: "scannetpp", label: "dataset", help: "training data of this run: hypersim, scannetpp, arkit, thuman"},
        {part: "lidarlow", label: "noise", help: "prompt noise preset: lidarlow, lower, low, none"},
        {part: "dpt01", label: "tag", help: "optional variant: dpt01, shuf, null, 24k, offset, fivebin, abl, smoke, eval; _2, _3 for twins"}],
      async init() {
        const q = new URLSearchParams(location.search);  // old links: index.html?open=<id> / queues.html -> hash routes
        if (q.has("open") && !location.hash) history.replaceState(null, "", location.pathname + "#/runs?" + new URLSearchParams(q.getAll("open").map((o) => ["open", o])));
        try { this.scratch = JSON.parse(sessionStorage.getItem("rb-scratch") || "false"); } catch (e) {}
        this.$watch("scratch", (v) => { try { sessionStorage.setItem("rb-scratch", JSON.stringify(v)); } catch (e) {} });
        this.parseRoute();
        addEventListener("hashchange", () => this.navigate());
        await b.init.call(this);
        dispatchEvent(new CustomEvent("rb-data"));
      },
      parseRoute() {
        const h = location.hash.replace(/^#\/?/, ""), [path, qs] = h.split("?");
        this.route = path === "queues" ? "queues" : "runs"; this.params = new URLSearchParams(qs || "");
        document.title = this.route === "queues" ? "MFP runboard · GPU queues" : "MFP runboard · Runs";
      },
      /** Route change with a View Transition (CSS fade fallback; none with prefers-reduced-motion); back/forward use the same path. */
      navigate() {
        const from = this.route, swap = () => { this.parseRoute(); return this.$nextTick(); }, done = () => dispatchEvent(new CustomEvent("rb-route", {detail: {from, to: this.route}}));
        const calm = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
        const next = (location.hash.replace(/^#\/?/, "").split("?")[0] === "queues") ? "queues" : "runs";
        if (document.startViewTransition && !calm && next !== from) document.startViewTransition(swap).finished.then(done, done);
        else swap().then(done);
      },
      onReload() { dispatchEvent(new CustomEvent("rb-reload")); },
      runCount() { return this.D ? this.D.runs.filter((r) => this.scratch || r.kind !== "scratch").length : 0; },
      activeQueues() { return this.D ? Object.values(this.D.queues || {}).filter((q) => q.status !== "destroyed" && !q.excluded && (q.running || []).length).length : 0; },
      /** GPUs we can schedule on: reachable, non-destroyed, non-excluded lanes (own hosts + live rented GPUs). */
      availGpus() { return RB.availableGpus(this.D); },
      oldData() { return !!this.D && (this.D.schema || 0) < 4; },
      openNames(e) {
        this._lastFocus = (e && e.currentTarget) || document.activeElement; this.nameModal = true; document.documentElement.classList.add("modal-open");
        this.$nextTick(() => { this.drawNames(this.$refs.howsvg); this.$refs.dlgClose.focus(); });
      },
      closeNames() { this.nameModal = false; document.documentElement.classList.remove("modal-open"); if (this._lastFocus) this._lastFocus.focus(); },
      trapTab(e) {
        const f = [...this.$refs.dlg.querySelectorAll("button, [href], input, select, [tabindex]:not([tabindex='-1'])")].filter((x) => !x.disabled);
        if (!f.length) return; const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      },
      /** Technical drawing of a run name: the name in monospace, a bracket under each segment and a leader line down to its label. */
      drawNames(svg) {
        if (!svg || getComputedStyle(svg).display === "none") return;  // phones show the stacked list instead
        const NS = "http://www.w3.org/2000/svg", mk = (t, a, txt) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); if (txt != null) e.textContent = txt; return e; };
        svg.replaceChildren();
        const parts = this.NAME_PARTS, name = parts.map((p) => p.part).join("_"), x0 = 16, y0 = 34;
        const t = mk("text", {x: x0, y: y0, class: "hn-name"}, name); svg.append(t);
        let i = 0; const segs = parts.map((p) => { const s = {p, a: t.getSubStringLength(0, i) + x0}; s.b = s.a + t.getSubStringLength(i, p.part.length); i += p.part.length + 1; return s; });
        let maxX = t.getComputedTextLength() + x0 * 2, rows = 1; const ends = [-1e9, -1e9, -1e9];
        for (const s of segs) {
          if (!s.p.label) continue;
          const mid = (s.a + s.b) / 2, lbl = mk("text", {x: mid, y: 0, class: "hn-label", "text-anchor": "middle"}, s.p.label);
          svg.append(lbl); const w = lbl.getComputedTextLength();
          const row = [0, 1, 2].find((r) => ends[r] < mid - w / 2 - 8) ?? 2; ends[row] = mid + w / 2; rows = Math.max(rows, row + 1);
          const ly = y0 + 40 + row * 24; lbl.setAttribute("y", ly);
          svg.append(mk("path", {class: "hn-br", d: `M${s.a + 1} ${y0 + 9} v6 M${s.a + 1} ${y0 + 12} H${s.b - 1} M${s.b - 1} ${y0 + 9} v6`}),
            mk("path", {class: "hn-lead", d: `M${mid} ${y0 + 12} V${ly - 13}`}), mk("circle", {class: "hn-dot", cx: mid, cy: y0 + 12, r: 2.2}));
          maxX = Math.max(maxX, mid + w / 2 + x0);
        }
        svg.setAttribute("viewBox", `0 0 ${Math.ceil(maxX)} ${y0 + 40 + (rows - 1) * 24 + 10}`); svg.style.width = Math.min(820, Math.ceil(maxX * 1.4)) + "px";
      },
    };
  });
  /** Started once the root has the data; reacts to reloads and to route changes (the table re-measures when it becomes visible). */
  const whenData = (c, start) => { if (c.D) start(); else addEventListener("rb-data", start, {once: true}); };
  Alpine.data("runs", () => ({
    f: {model: "", init: "", pretrain_ds: "", dataset: "", noise: "", status: ""}, sort: "modified_at", dir: -1, all: false, paper: false, abl: false, n: 0, built: false, open: [],
    FILTER_KEYS: ["model", "init", "pretrain_ds", "dataset", "noise", "status"],
    KEY_LABEL: {model: "Model", init: "Init", pretrain_ds: "Pretrain dataset", dataset: "SFT dataset", noise: "Noise", status: "Status"},
    SHORT_LABEL: {model: "Model", init: "Init", pretrain_ds: "Pretrain", dataset: "SFT", noise: "Noise", status: "Status"},
    INIT_FAM: {pda: "PromptDA", sv: "SV", mv: "MV"}, INIT_DS: {hs: "Hypersim P1", spp: "ScanNet++ SFT", as: "ARKitScenes SFT", th: "THuman SFT"},
    init() {
      RUNS_EL = this.$el; this.open = this.openIds();
      whenData(this, () => this.start());
      addEventListener("rb-reload", () => this.refresh());
      addEventListener("rb-route", () => { if (this.route !== "runs") return; if (!this.built) this.start(); else { RUNS_TABLE.redraw(true); this.openFromRoute(); } });
    },
    start() {
      if (this.built || this.route !== "runs") return;
      try { Object.assign(this, JSON.parse(sessionStorage.getItem("rb-runs") || "{}")); } catch (e) {}
      try { this.all = JSON.parse(localStorage.getItem("rb-all") || "false"); } catch (e) {}
      try { this.paper = JSON.parse(localStorage.getItem("rb-paper") || "false"); } catch (e) {}
      try { this.abl = JSON.parse(localStorage.getItem("rb-abl") || "false"); } catch (e) {}
      const want = this.openIds()[0] && this.D.runs.find((r) => r.id === this.openIds()[0]);
      if (want && want.kind === "scratch") this.scratch = true;
      const save = () => { try { sessionStorage.setItem("rb-runs", JSON.stringify({f: this.f, sort: this.sort, dir: this.dir})); } catch (e) {} };
      for (const k of ["f", "sort", "dir"]) this.$watch(k, save);
      this.$watch("scratch", () => this.refresh());
      this.$watch("all", (v) => { try { localStorage.setItem("rb-all", JSON.stringify(v)); } catch (e) {} this.refresh(); });
      this.$watch("paper", (v) => { try { localStorage.setItem("rb-paper", JSON.stringify(v)); } catch (e) {} this.refresh(); });
      this.$watch("abl", (v) => { try { localStorage.setItem("rb-abl", JSON.stringify(v)); } catch (e) {} this.refresh(); });
      this.built = true; this.$nextTick(() => this.mkTable());
    },
    openIds() { return this.params.getAll("open"); },
    openFromRoute() {
      const id = this.openIds()[0]; if (!id || !RUNS_TABLE || !RUNS_TABLE.getRow(id)) return;
      const r = RUNS_TABLE.getRow(id); if (!this.isOpen(r.getData()._r)) { this.flip(r.getData()._r); r.reformat(); }
      RUNS_TABLE.setPageToRow(id).then(() => RUNS_TABLE.scrollToRow(id, "top", false)).catch(() => {});
    },
    refresh() { if (RUNS_TABLE) RUNS_TABLE.replaceData(this.rows()); },
    // 'paper': only runs cited in the paper; 'ablation': only ablation runs; both: the paper's ablation-table runs
    base() { return this.D.runs.filter((r) => (this.abl ? RB.isAbl(r) : true) && (this.paper ? (this.abl ? RB.inAblTable(r) : r.paper) : (this.abl || this.scratch || r.kind !== "scratch"))); },
    canon(r) { return r.model || RB.canonModel(r.variant) || "Other"; },
    opts(k) { const v = [...new Set(this.rows(true).map((r) => r[k]))].filter((x) => x && x !== "-" && x !== "all");
      return v.sort((a, b) => RB.rank(k === "pretrain_ds" ? "dataset" : k, a).localeCompare(RB.rank(k === "pretrain_ds" ? "dataset" : k, b))); },
    initHelp(t) { if (!t || t === "clean") return "no pretrained parent (MetricDA / DFormer weights only)"; const [f, d, par] = t.split("_");
      return `${this.INIT_FAM[f] || f} weights from ${this.INIT_DS[d] || d}${par ? ", parallel lineage" : ""}`; },
    candidates(model) { const pl = this.D.placement || {}; return (/MV/.test(model) ? pl.mv : pl.other) || []; },
    /** Name of a combination that never ran, by the run-name grammar (README 'Run names'). */
    comboName(c) { const mt = {"PromptDA-B": "promptda_B", "PromptDA-L": "promptda_L", Ours_SV: "sv_B"}[c.model] || (/^Ours_MV(\d+)$/.exec(c.model) ? `mv${RegExp.$1}_B` : "x_B");
      const dt = {Hypersim: "hypersim", "ScanNet++": "scannetpp", ARKitScenes: "arkit", THuman: "thuman"}[c.dataset] || "x";
      return [mt, c.init.replace(/_/g, ""), "to", dt, c.noise.replace(/_/g, "")].join("_"); },
    /** The paper grid of full SFT runs: SFT dataset x noise x model x Hypersim-pretrained init (chained / not chained). */
    GRID: {dataset: ["ScanNet++", "ARKitScenes", "THuman"], noise: ["lidar_low", "lower", "low"], model: ["PromptDA-B", "Ours_SV", "Ours_MV2", "Ours_MV3"],
      init: {"PromptDA-B": ["pda_hs"], Ours_SV: ["sv_hs", "sv_hs_par"], Ours_MV2: ["sv_hs", "mv_hs", "sv_hs_par", "mv_hs_par"], Ours_MV3: ["sv_hs", "mv_hs", "sv_hs_par", "mv_hs_par"]}},
    /** A real row belongs to the grid: a full P2 SFT run (200K budget; no P1, ablation, control, smoke or eval) on a grid cell. */
    inGrid(x) { const g = this.GRID, r = x._r || {};
      return /^(P2-|PLAN-)/.test(x.id) && !/^P2-(PDA|SV|MV)c\d*-/.test(x.id) && x.cap === 200000  // P2-PDAc / P2-SVc2 ...: controls and continuations && r.kind !== "scratch" && r.stage !== "Eval" && !/control|abl|smoke|eval/i.test(`${x.id} ${r.title || ""}`)
        && g.dataset.includes(x.dataset) && g.noise.includes(x.noise) && (g.init[x.model] || []).includes(x.init); },
    /** 'Show all combinations': every grid cell without a run becomes a 'not planned' row named by the grammar (narrowed by the filters). */
    combos(real) {
      const g = this.GRID, pick = (k, xs) => (this.f[k] ? xs.filter((x) => x === this.f[k]) : xs), out = [];
      if (this.f.pretrain_ds && this.f.pretrain_ds !== "Hypersim") return out;
      const have = new Set(real.map((r) => [r.model, r.init, r.dataset, r.noise].join("|")));
      for (const d of pick("dataset", g.dataset)) for (const nz of pick("noise", g.noise)) for (const m of pick("model", g.model))
        for (const i of pick("init", g.init[m])) {
          if (have.has([m, i, d, nz].join("|"))) continue;
          const v = {model: m, init: i, dataset: d, noise: nz, pretrain_ds: "Hypersim"};
          out.push({...v, id: "~" + [m, i, d, nz].join("|"), title: this.comboName(v), status: "not planned", _virtual: true, rmse: null, mae: null, steps: null, samples: null, modified_at: null});
        }
      return out;
    },
    rows(realOnly) {
      const real = this.base().map((r) => ({id: r.id, title: r.display_name || r.title, model: this.canon(r), init: r.init || "—",
        pretrain_ds: r.pretrain_ds || (r.init && r.init !== "clean" ? "Hypersim" : "—"), dataset: r.dataset, noise: r.noise, status: r.status,
        rmse: rmse(r)[0], rsrc: rmse(r)[1], rtip: srcTip(r), mae: mae(r)[0], msrc: mae(r)[1], steps: (r.steps || {}).done ?? null, cap: (r.steps || {}).cap ?? null, samples: (r.steps || {}).samples ?? null,
        modified_at: r.modified_at || null, _r: r}));
      if (realOnly || !this.all) return real;
      const grid = real.filter((x) => this.inGrid(x));  // toggle on: exactly the paper grid (other real rows hidden)
      return grid.concat(this.combos(grid));
    },
    /** One Tabulator table for all runs: 50 rows per page, sticky column titles, every dimension filterable. */
    mkTable() {
      const self = this, esc = RB.esc, miss = (x) => x == null || x === "" || x === "-" || x === "—";
      const lastMissing = (a, b, ar, br, c, dir) => (miss(a) || miss(b) ? (miss(a) === miss(b) ? 0 : (miss(a) ? 1 : -1) * (dir === "asc" ? 1 : -1)) : a < b ? -1 : a > b ? 1 : 0);
      const ranked = (k) => (a, b, ar, br, c, dir) => (miss(a) || miss(b) ? lastMissing(a, b, ar, br, c, dir) : RB.rank(k, a).localeCompare(RB.rank(k, b)));
      const list = (k, fmt) => ({headerFilter: "list", headerFilterFunc: "=", headerFilterPlaceholder: "All",
        headerFilterParams: {valuesLookup: () => [{label: "All", value: ""}, ...self.opts(k).map((v) => ({label: v, value: v}))],
          ...(fmt ? {itemFormatter: (label, value) => (value ? fmt(value) : "All")} : {})}});
      const col = (o) => ({headerSortStartingDir: "asc", resizable: false, vertAlign: "top", ...o});
      const two = (a, b) => () => `${a}<br>${b}`;
      RUNS_TABLE = new Tabulator(this.$refs.tbl, {
        data: this.rows(), index: "id", layout: "fitColumns", renderVertical: "basic", placeholder: "",
        pagination: true, paginationSize: 50, paginationCounter: "rows", paginationButtonCount: 5,
        responsiveLayout: "collapse", responsiveLayoutCollapseStartOpen: true,
        responsiveLayoutCollapseFormatter: (items) => {
          const el = document.createElement("div"); el.className = "rb-collapse";
          for (const it of items) { const s = document.createElement("span"); s.innerHTML = `<small>${esc(String(it.title).replace(/<br>/g, " "))}</small> `;
            s.append(typeof it.value === "string" ? Object.assign(document.createElement("span"), {innerHTML: it.value}) : it.value); el.append(s); }
          return items.length ? el : "";
        },
        initialSort: [{column: this.sort, dir: this.dir > 0 ? "asc" : "desc"}],
        initialHeaderFilter: Object.entries(this.f).filter(([, v]) => v).map(([field, value]) => ({field, value})),
        columns: [
          col({title: "Run", field: "title", minWidth: 276, widthGrow: 3,  /* +100 px from the hidden Samples column */ responsive: 0, sorter: lastMissing,
            titleFormatter: () => { const w = document.createElement("span"); w.className = "run-h"; w.append("Run ");
              const bt = Object.assign(document.createElement("button"), {type: "button", className: "col-info", title: "How to read run names", innerHTML: RB.ic("info")});
              bt.setAttribute("aria-label", "How to read run names"); bt.setAttribute("aria-haspopup", "dialog");
              bt.addEventListener("click", (e) => { e.stopPropagation(); e.preventDefault(); Alpine.$data(document.body).openNames(e); });  // no sort on click
              w.append(bt); return w; },
            formatter: (c) => { const d = c.getData(), nm = esc(d.title).replace(/_/g, "_<wbr>"), car = `<span class="car">${self.isOpen(d._r || d) ? "▾" : "▸"}</span>`;
              if (d._virtual) return `<div class="rb-run"><div class="rb-name muted">${car}${nm}</div><div class="rb-id">never ran</div></div>`;
              const r = d._r || {}, pb = (r.paper ? ` <span class="tag paper" title="${esc(r.paper_label || "")}">paper</span>` : "") + (RB.isAbl(r) ? ` <span class="tag abl" title="ablation run">ablation</span>` : "") + (r.superseded_by ? ` <span class="tag" title="a better run now carries the paper label">superseded by ${esc(r.superseded_by)}</span>` : "");
              return `<div class="rb-run"><div class="rb-name" title="${esc(d._r.title)}">${car}${nm}${pb}</div><div class="rb-id" title="${esc(d.id)}">${esc(d.id)}</div></div>`; }}),
          col({title: "Model", field: "model", width: 120, responsive: 2, sorter: ranked("model"), ...list("model", RB.modelHtml), formatter: (c) => RB.modelHtml(c.getValue())}),
          col({title: "Init", field: "init", width: 112, responsive: 5, sorter: ranked("init"), ...list("init"), formatter: (c) => (miss(c.getValue()) ? `<span class="muted">—</span>` : `<code class="init">${esc(c.getValue())}</code>`)}),
          col({title: "Pretrain Dataset", titleFormatter: two("Pretrain", "Dataset"), field: "pretrain_ds", width: 108, responsive: 7, sorter: ranked("dataset"), ...list("pretrain_ds")}),
          col({title: "SFT Dataset", titleFormatter: two("SFT", "Dataset"), field: "dataset", width: 116, responsive: 6, sorter: ranked("dataset"), ...list("dataset")}),
          col({title: "Noise", field: "noise", width: 96, responsive: 8, sorter: ranked("noise"), ...list("noise")}),
          col({title: "Status", field: "status", width: 148, responsive: 1, ...list("status"), sorter: ranked("status"),
            formatter: (c) => `<span class="badge has-i s-${esc(c.getValue()).replace(" ", "-")}">${RB.ic(RB.ICON[c.getValue()] || "")}${esc(c.getValue())}</span>`}),
          col({title: "RMSE", field: "rmse", width: 114, responsive: 3, sorter: lastMissing, headerSortStartingDir: "desc",
            headerTooltip: "RMSE / MAE in metres. Badge: eval = proper evaluation receipt of the finished run (hover: checkpoint, protocol); dev = best W&B validation during training (hover: step)",
            formatter: (c) => { if (c.getValue() == null) return `<span class="muted">-</span>`; const pc = c.getData()._r && RB.citedCell(c.getData()._r, "rmse", c.getValue());
              return `<span class="num${pc ? " cited" : ""}"${pc ? ` title="${esc(RB.paperTip(pc))}"` : ""}>${c.getValue().toFixed(4)}</span>${evalpTag(c.getData()._r)}<span class="tag" title="${esc(c.getData().rtip || "")}">${esc(c.getData().rsrc)}</span>`; }}),
          col({title: "MAE", field: "mae", width: 124, responsive: 3, sorter: lastMissing, headerSortStartingDir: "asc",
            // same receipt as RMSE (its DEV/TEST badge applies), so no second badge
            formatter: (c) => { if (c.getValue() == null) return `<span class="muted">-</span>`; const pc = c.getData()._r && RB.citedCell(c.getData()._r, "mae", c.getValue());
              return `<span class="num${pc ? " cited" : ""}" title="${esc(pc ? RB.paperTip(pc) : c.getData().msrc + " MAE" + (c.getData().rtip ? " (" + c.getData().rtip + ")" : ""))}">${c.getValue().toFixed(4)}</span>${evalpTag(c.getData()._r)}`; }}),
          col({title: "Steps", field: "steps", width: 100, responsive: 9, sorter: lastMissing, headerSortStartingDir: "desc",
            formatter: (c) => { const d = c.getData(); if (d._virtual) return ""; if (d.steps == null) return `<span class="muted">—</span>`;
              return `<span class="num" title="${d.steps.toLocaleString("en-US")}${d.cap ? " of " + d.cap.toLocaleString("en-US") : ""} steps">${RB.kfmt(d.steps)}${d.cap ? `<span class="muted"> / ${RB.kfmt(d.cap)}</span>` : ""}</span>${RB.liveBits(d._r)}`; }}),
          col({title: "Samples", field: "samples", width: 100, visible: false, responsive: 10,  /* hidden: samples stay in the expanded details */ sorter: lastMissing, headerSortStartingDir: "desc",
            formatter: (c) => (c.getData()._virtual ? "" : c.getValue() == null ? `<span class="muted">—</span>` : `<span class="num" title="${c.getValue().toLocaleString("en-US")} images">${RB.kfmt(c.getValue())}</span>`)}),
          col({title: "Modified", field: "modified_at", width: 112, responsive: 4, headerSortStartingDir: "desc",
            sorter: (a, b) => (miss(a) || miss(b) ? (miss(a) === miss(b) ? 0 : miss(a) ? -1 : 1) : a < b ? -1 : a > b ? 1 : 0),  // not started = oldest
            formatter: (c) => (c.getData()._virtual ? "" : `<span class="num" title="${esc(self.abs(c.getValue()))}">${esc(self.when(c.getData()._r) || "not started")}</span>`)}),
        ],
        rowFormatter: (row) => self.renderDetails(row),
      });
      RUNS_TABLE.on("dataSorted", (sorters) => { if (sorters[0]) { this.sort = sorters[0].field; this.dir = sorters[0].dir === "asc" ? 1 : -1; } });
      RUNS_TABLE.on("dataFiltered", (filters, rows) => {
        this.n = rows.filter((r) => !r.getData()._virtual).length;
        const hf = Object.fromEntries(RUNS_TABLE.getHeaderFilters().map((x) => [x.field, x.value]));
        const nf = Object.fromEntries(this.FILTER_KEYS.map((k) => [k, hf[k] || ""]));
        if (JSON.stringify(nf) !== JSON.stringify(this.f)) { this.f = nf; if (this.all) setTimeout(() => this.refresh()); }
      });
      RUNS_TABLE.on("rowClick", (e, row) => { if (e.target.closest("a, button, .rb-det")) return; const d = row.getData(); this.flip(d._r || d); row.reformat(); });
      RUNS_TABLE.on("tableBuilt", () => { this.n = RUNS_TABLE.getDataCount("active"); this.openFromRoute(); });
    },
    setFilter(k, v) { if (RUNS_TABLE) RUNS_TABLE.setHeaderFilterValue(k, v); },
    /** Details below an open row: #det-tpl for a run, #vdet-tpl for a combination that never ran. */
    renderDetails(row) {
      const el = row.getElement(), d = row.getData(), old = el.querySelector(":scope > .rb-det");
      if (old) { Alpine.destroyTree(old); old.remove(); }
      const key = d._r || d; el.classList.toggle("virtual", !!d._virtual); el.classList.toggle("open", this.isOpen(key));
      if (!this.isOpen(key)) return;
      const node = document.getElementById(d._virtual ? "vdet-tpl" : "det-tpl").content.firstElementChild.cloneNode(true);
      Alpine.mutateDom(() => el.appendChild(node));
      // Tabulator may format a row before attaching it to the page, so anchor the scope on the runs section explicitly
      Alpine.addScopeToNode(node, d._virtual ? {v: d} : {r: d._r}, RUNS_EL); Alpine.initTree(node);
    },
    isOpen(r) { return this.open.includes(r.id); },
    flip(r) { const i = this.open.indexOf(r.id); i < 0 ? this.open.push(r.id) : this.open.splice(i, 1); },
    rmse, mae, hostOf, host: (r) => RB.hostName(hostOf(r)), tip: (r) => RB.hostTip(hostOf(r)),
    when(r) { return RB.relTime(r.modified_at, this.now); },
    abs: (iso) => (iso ? new Date(iso).toLocaleString([], {dateStyle: "medium", timeStyle: "short"}) : ""),
    metrics(g) { // g = metrics_best | metrics_last -> [[label, value]] with em dash for missing
      const f = (v, d = 4) => (typeof v === "number" ? v.toFixed(d) : "\u2014");  // 4 decimals: key differences are 1-2 mm
      return g ? [["RMSE", f(g.rmse)], ["MAE", f(g.mae)], ["AbsRel", f(g.absrel)], ["F1", typeof g.f1 === "number" ? g.f1.toFixed(1) : "\u2014"]] : [];
    },
    smk: [],  // run ids whose smoke attempts are expanded
    attempts(r) { const a = [...(r.attempts || [])].reverse(); return this.smk.includes(r.id) ? a : a.filter((x) => x.status !== "smoke"); },  // latest first
    smokes(r) { return (r.attempts || []).filter((x) => x.status === "smoke").length; },
    flipSmokes(r) { const i = this.smk.indexOf(r.id); i < 0 ? this.smk.push(r.id) : this.smk.splice(i, 1); },
    dur(a) {
      if (!a.started_at) return "not started";
      if (a.status === "running") return "still running";
      if (!a.ended_at) return "\u2014";
      const m = Math.round((new Date(a.ended_at) - new Date(a.started_at)) / 60000);
      return m >= 60 ? (m / 60).toFixed(1) + " h" : m + " min";
    },
    stepsText(r) { const t = r.steps || {}; if (t.done == null) return "\u2014";
      return t.done.toLocaleString("en-US") + (t.cap ? " of " + t.cap.toLocaleString("en-US") : "") + (t.best ? ` \u00b7 best dev RMSE at step ${t.best.toLocaleString("en-US")}` : t.best === 0 ? " \u00b7 best dev RMSE at step 0 (no gain over init)" : " \u00b7 best dev step \u2014") + (t.stop ? ` \u00b7 stopped: ${t.stop}` : ""); },
    samplesText(r) { const t = r.steps || {}; if (t.samples == null) return "\u2014";
      return `${RB.kfmt(t.samples)} images (${RB.kfmt(t.done)} steps \u00d7 batch ${t.batch}${t.views > 1 ? ` \u00d7 ${t.views} views` : ""})`; },
    sha: (c) => (c ? c.slice(0, 7) : ""),
    commitUrl: (c) => "https://github.com/irc-hslu/metricsplat/commit/" + c,
  }));
  Alpine.data("queues", () => ({
    cur: 0, atStart: true, atEnd: false, runById: {}, planById: {},
    init() {
      whenData(this, () => this.onReload());
      addEventListener("rb-reload", () => this.onReload());
      addEventListener("rb-route", () => this.route === "queues" && this.$nextTick(() => this.onScroll()));
      addEventListener("resize", () => this.onScroll());
      setInterval(RB.spanCards, 1000);  // cards re-render on live updates; re-measure the wide ones
    },
    /** Lane carousel: CSS scroll-snap does the snapping; these only drive the arrows and dots. */
    laneEls() { return this.$refs.lanes ? [...this.$refs.lanes.querySelectorAll(".hlane")] : []; },
    onScroll() {
      const el = this.$refs.lanes, ls = this.laneEls(); if (!el || !ls.length || !el.offsetParent) return;  // hidden route: measured on rb-route
      const x = el.scrollLeft, w = ls.length > 1 ? ls[1].offsetLeft - ls[0].offsetLeft : el.clientWidth;
      this.cur = Math.min(ls.length - 1, Math.round(x / w));
      this.atStart = x < 4; this.atEnd = x + el.clientWidth >= el.scrollWidth - 4;
      // phone: one lane per screen, so the strip takes the height of the lane in view (no gap under a short lane)
      el.style.height = matchMedia("(max-width: 720px)").matches ? ls[this.cur].offsetHeight + 16 + "px" : "";
    },
    go(i) { const el = this.$refs.lanes, ls = this.laneEls(); if (ls[i]) el.scrollTo({left: ls[i].offsetLeft - ls[0].offsetLeft, behavior: "smooth"}); },
    step(d) { const ls = this.laneEls(), w = ls.length > 1 ? ls[1].offsetLeft - ls[0].offsetLeft : 380; this.$refs.lanes.scrollBy({left: d * w, behavior: "smooth"}); },
    STAGE: {running: "Running", queued: "Queued", paused: "Paused", reviewed: "Ready", "host-tested": "Tested", built: "Built", planned: "Planned"},
    onReload() {
      this.runById = Object.fromEntries(this.D.runs.map((r) => [r.id, r])); this.planById = Object.fromEntries((this.D.plan || []).map((p) => [p.id, p]));
      this.$nextTick(() => this.onScroll());
    },
    /** Lanes in a fixed order: own hosts, then rented ones; offline lanes without jobs or finished runs are left out. */
    hosts() {
      if (!this.D) return [];
      const order = ["local", "iradonis", "desktop", "copernicus"], q = this.D.queues || {};
      // an offline lane (stopped/destroyed or unreachable) with nothing to show (no jobs, no finished runs) is hidden
      const empty = (k) => (["stopped", "destroyed"].includes(q[k].status) || !q[k].reachable) && !this.recent(q[k]).length &&
          !["running", "queued", "paused"].some((f) => (q[k][f] || []).length);
      const shown = Object.keys(q).filter((k) => !q[k].excluded && !q[k].hidden && !empty(k)), mach = (k) => k.replace(/\.gpu\d+(-\d+)?$/, "");
      // machine class: running work, then idle/online, then stopped, then destroyed; never mixed (all GPU lanes of a machine share one class)
      const local = (k) => order.includes(mach(k)) || !/^vast/.test(mach(k));  // our own machines always come first, then active rentals, then stopped/destroyed ones
      const cls = (k) => { if (local(k)) return -1; const ls = shown.filter((x) => mach(x) === mach(k)).map((x) => q[x]);
        return ls.some((x) => x.status === "destroyed") ? 3 : ls.some((x) => x.status === "stopped") ? 2 : 0; };  // active rentals together (running or idle), before stopped and destroyed ones
      const keys = shown.sort((a, b) => cls(a) - cls(b) ||
          (cls(a) === 3 ? (q[b].destroyed_at || "").localeCompare(q[a].destroyed_at || "") : ((order.indexOf(a) + 1) || 99) - ((order.indexOf(b) + 1) || 99)) ||
          mach(a).localeCompare(mach(b)) || a.localeCompare(b));
      const G = RB.laneGroups(keys);  // lanes of one multi-GPU machine are drawn as a group
      // a multi-GPU machine's finished jobs: one list on its first lane, drawn across all of its GPU lanes (RB.spanRecent)
      const mrec = {}; keys.forEach((k) => { if (G[k]) (mrec[G[k].machine] = mrec[G[k].machine] || []).push(...this.recent(q[k])); });
      Object.values(mrec).forEach((l) => l.sort((a, b) => (b.finished || "").localeCompare(a.finished || "")).splice(6));
      return keys.map((k) => { const g = G[k];
          return {k, ...q[k], rec: g ? (g.pos === "first" ? mrec[g.machine] : []) : this.recent(q[k]), gn: g ? g.n : 1, grec: !!(g && mrec[g.machine].length), name: RB.hostName(k), gpuName: this.gpuOf(k), rented: /^vast/.test(k), multi: !!/\.gpu\d+(-\d+)?$/.exec(k), span: (/\.gpu(\d+)-(\d+)$/.exec(k) || [0, 0, 0]).slice(1).reduce((a, b) => +b - +a + 1), gone: q[k].status === "destroyed",
            grp: g ? g.pos : "", machine: g ? g.machine : ""}; });  // glued block: machine name once, no 'GPU N' label
    },
    gpuOf(k) { const q = (this.D.queues || {})[k] || {}; return (q.gpu_label || (RB.HOSTS[k] || {}).gpu || "").replace(/\s*\(.*\)$/, ""); },
    /** Lane status line: the GPU meter when the monitor has telemetry, else the lane's first running run (step, heartbeat age); '' hides it. */
    liveText(h) {
      if (h.gone) return "machine destroyed · not polled";
      if (!h.reachable) return this.seen(h);
      const gpu = RB.liveLine(h.gpu_status, h.gpuName); if (gpu) return gpu;
      const j = (h.running || [])[0]; if (!j) return "";
      return [j.step != null && (j.budget || {}).steps ? `step ${j.step}/${j.budget.steps}` : "", j.heartbeat_at ? "heartbeat " + RB.relTime(j.heartbeat_at, this.now) : ""].filter(Boolean).join(" · ");
    },
    /** Name with a break opportunity after every underscore only (never ellipsized). */
    nameHtml: (s) => RB.esc(s || "").replace(/_/g, "_<wbr>"),
    /** model · dataset · noise, model in the main-table form (PromptDA-B, SV-B, MV(3)-B); noise always shown ('noise ?' when unknown). */
    chips(model, dataset, noise) {
      const ok = (x) => x && !["none", "-", "\u2014", "all", "n.a."].includes(x);
      const m = ok(model) ? RB.canonModel(model) : "";
      return [m || "\u2014", ok(dataset) ? dataset : "\u2014", ok(noise) ? noise : "\u2014"];  // unknown = '—' (and a MISSING_META alert)
    },
    runAttempt(r) { const a = [...((r && r.attempts) || [])].reverse(); return a.find((x) => x.status === "running" && x.wandb_id) || a.find((x) => x.status === "running") || a[0] || {}; },
    /** One card model for queue jobs, lane plan entries and backlog items. */
    card(src, kind, i) {
      const jr = kind === "running" || kind === "queued" || kind === "paused" ? this.jobRun(src).r : null;
      const id = kind === "backlog" || kind === "plan" ? src.id : jr ? jr.id : src.run_id, r = id && this.runById[id], p = id && this.planById[id];
      const att = this.runAttempt(r), m = att.metrics || {}, fam = r && {PromptDA: "PromptDA", Ours_SV: "SV", Ours_MV: "MV"}[r.tab];
      const stage = kind === "running" || kind === "queued" || kind === "paused" ? kind : (src.stage_effective || src.stage || "planned");
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
        name, cotenant: !!src.cotenant, live: !!src.live, unmapped: (kind === "running" || kind === "queued") && !r,
        chips: this.chips((r && r.model !== "Other" && r.model) || (kind === "backlog" ? src.model : p && p.model) || fam,
          (kind === "backlog" ? src.dataset : p && p.dataset) || (r && r.dataset), (kind === "backlog" ? src.noise : p && p.noise) || (r && r.noise)),
        waits: kind === "plan" ? src.waits_for || src.unlock_event || "" : kind === "backlog" ? src.waits_for : "",
        step: kind === "paused" ? src.progress_step : m.step, budget: kind === "paused" ? {steps: src.progress_total} : src.budget || {}, started: src.started,
        best: src.best_dev || "", backup: (src.backup || "").replace(/\/+$/, "").split("/").slice(-2).join("/"), backupFull: src.backup || "",
        wandb: att.wandb_url || "", hosts: kind === "backlog" ? src.candidate_hosts || [] : [], det};
    },
    lane(h) {
      if (h.gone) return [];  // a destroyed machine has no queue or plan, only its finished jobs
      return [...(h.running || []).map((j, i) => ({...this.card(j, "running", i), span: j.span, ghost: j.ghost, rid: j.run_id})), ...(h.queued || []).map((j, i) => ({...this.card(j, "queued", i), span: j.span, ghost: j.ghost, rid: j.run_id})),
        ...(this.D.plan || []).filter((p) => p.host_key === h.k && p.run_status === "planned" && p.stage_effective !== "queued").map((p, i) => this.card(p, "plan", i))];
    },
    /** Paused jobs of every host (interrupted runs that resume from last.ckpt), then the planned backlog. */
    paused() { return this.D ? Object.entries(this.D.queues || {}).flatMap(([k, q]) => (q.paused || []).map((j) => ({...j, host: k}))).map((j, i) => this.card(j, "paused", i)) : []; },
    backlog() { return this.D ? [...this.paused(), ...(this.D.backlog || []).map((b, i) => this.card(b, "backlog", i))] : []; },
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

if (typeof module !== "undefined" && module.exports) Object.assign(module.exports, { rmse, mae });  // node tests (test/test_runboard_app.mjs)

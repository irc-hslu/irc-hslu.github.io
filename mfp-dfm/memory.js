"use strict";
/* Memory page: decrypts memory.enc.json (index + markdown bodies), lists files by group, renders one with marked + DOMPurify. */
(() => {
  const theme = () => { try { return localStorage.getItem("rb-theme"); } catch (e) { return null; } };
  const apply = (t) => { const d = matchMedia("(prefers-color-scheme: dark)").matches; document.documentElement.dataset.theme = t || (d ? "dark" : "light"); };
  apply(theme());
  const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  async function decrypt(blob, pw) {
    const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveKey"]);
    const key = await crypto.subtle.deriveKey({name: "PBKDF2", salt: b64(blob.salt), iterations: blob.iter, hash: "SHA-256"}, base, {name: "AES-GCM", length: 256}, false, ["decrypt"]);
    return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name: "AES-GCM", iv: b64(blob.iv)}, key, b64(blob.ct))));
  }
  const ic = (n) => (window.LUCIDE && LUCIDE[n] ? `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${LUCIDE[n]}</svg>` : "");
  document.addEventListener("alpine:init", () => Alpine.data("memory", () => ({
    D: null, gate: false, err: "", pw: "", cur: null, html: "", dark: document.documentElement.dataset.theme === "dark", ic, blob: null,
    async init() {
      addEventListener("hashchange", () => this.route());
      this.blob = await (await fetch("./memory.enc.json", {cache: "no-store"})).json();
      let saved = null; try { saved = sessionStorage.getItem("runboard_pw"); } catch (e) {}
      if (saved) { try { this.D = await decrypt(this.blob, saved); } catch (e) {} }
      if (this.D) this.route(); else this.gate = true;
    },
    async ok() {
      try { this.D = await decrypt(this.blob, this.pw); try { sessionStorage.setItem("runboard_pw", this.pw); } catch (e) {} this.gate = false; this.route(); }
      catch (e) { this.err = "Wrong password"; }
    },
    groups() {
      if (!this.D) return [];
      const keys = [...new Set(this.D.index.map((e) => e.group))];  // index order = group order from sync_memory.py
      return keys.map((g) => { const items = this.D.index.filter((e) => e.group === g); return {key: g, items, label: items[0].group_label}; });
    },
    route() {
      const p = decodeURIComponent(location.hash.replace(/^#/, "")), e = this.D && this.D.index.find((x) => x.path === p + ".md");
      this.cur = e || null;
      this.html = e ? DOMPurify.sanitize(marked.parse(this.D.files[e.path], {gfm: true})) : "";
      document.title = "MFP runboard · Memory" + (e ? " · " + e.title : "");
      if (e) scrollTo(0, 0);
    },
    toggleTheme() { const n = this.dark ? "light" : "dark"; try { localStorage.setItem("rb-theme", n); } catch (e) {} apply(n); this.dark = !this.dark; },
  })));
})();

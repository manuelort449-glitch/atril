/* Atril — teleprompter para tandas y canciones.
 *
 * Organización del archivo:
 *   1. Utilidades e íconos
 *   2. Datos: estado, guardado y combinación (merge) entre dispositivos
 *   3. Sincronización: WiFi local (server.py), Dropbox y archivo compartido
 *   4. Vistas: Notas, Nota, Canciones, Armar tanda, Ajustes
 *   5. Teleprompter
 *
 * Los datos iniciales vienen de data/datos.js (tools/generar_datos.py).
 * Cada nota y canción guarda "ts" (hora del último cambio). Al sincronizar gana
 * el cambio más reciente de cada elemento, así nunca se pierde lo del otro aparato.
 */
(() => {
  "use strict";

  // ================= 1. utilidades =================
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const plain = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
  const today = () => new Date().toISOString().slice(0, 10);
  const now = () => Date.now();
  const KEY_RE = /\s+((?:DO|RE|MI|FA|SOL|LA|SI)(?:#|B)?M?)\s*$/i;
  const CFG = window.ATRIL_CONFIG || {};

  const ICONS = {
    notes: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>',
    music: '<path d="M9 18V6l11-2v12"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
    build: '<path d="M4 6h11M4 12h11M4 18h7"/><path d="M18 15v6M15 18h6"/>',
    gear: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    chev: '<path d="m9 6 6 6-6 6"/>', back: '<path d="m15 5-7 7 7 7"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>',
    play: '<path class="f" d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/>',
    pause: '<rect class="f" x="6" y="5" width="4" height="14" rx="1.2"/><rect class="f" x="14" y="5" width="4" height="14" rx="1.2"/>',
    prev: '<path d="M6 5v14"/><path class="f" d="M19 6.2v11.6a.8.8 0 0 1-1.2.7l-8.6-5.8a.8.8 0 0 1 0-1.4l8.6-5.8a.8.8 0 0 1 1.2.7z"/>',
    next: '<path d="M18 5v14"/><path class="f" d="M5 6.2v11.6a.8.8 0 0 0 1.2.7l8.6-5.8a.8.8 0 0 0 0-1.4L6.2 5.5A.8.8 0 0 0 5 6.2z"/>',
    aSmall: '<path d="M3 19 8 6l5 13M4.8 15h6.4M16 13h6"/>',
    aBig: '<path d="M3 19 8 6l5 13M4.8 15h6.4M19 10v6M16 13h6"/>',
    mirror: '<path d="M12 3v2M12 9v2M12 15v2M12 21v-1"/><path d="M9 7 3 12l6 5zM15 7l6 5-6 5z"/>',
    top: '<path d="M5 4h14M12 20V9M7 13l5-5 5 5"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    share: '<path d="M12 3v12M8 7l4-4 4 4"/><path d="M6 11v9h12v-9"/>',
    receive: '<path d="M12 3v12M8 11l4 4 4-4"/><path d="M5 15v5h14v-5"/>',
    sync: '<path d="M20 11a8 8 0 0 0-14.3-4.9L4 8M4 4v4h4M4 13a8 8 0 0 0 14.3 4.9L20 16M20 20v-4h-4"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
    wifi: '<path d="M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0"/><path d="M12 19.5h.01"/>',
    cloud: '<path d="M7 18h10a4 4 0 0 0 .5-8 6 6 0 0 0-11.5 1.5A3.3 3.3 0 0 0 7 18z"/>',
    up: '<path d="m6 15 6-6 6 6"/>', down: '<path d="m6 9 6 6 6-6"/>',
    phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
    keys: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
    text: '<path d="M5 6h14M5 12h14M5 18h9"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    handle: '<path d="M5 8h14M5 12h14M5 16h14"/>',
    qr: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h2v2M20 14v6h-4M14 18v2"/>',
    clip: '<path d="m20 11.5-8 8a5 5 0 0 1-7-7l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7L9.7 17.2a1.6 1.6 0 0 1-2.3-2.3L15 7.3"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m3.5 7 8.5 6 8.5-6"/>',
    gauge: '<path d="M4.5 17a8.5 8.5 0 1 1 15 0"/><path d="m12 13 4-4"/><circle cx="12" cy="13" r="1.3"/>',
  };
  const ic = (n, cls = "") => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${(ICONS[n] || "").replace(/class="f"/g, 'fill="currentColor" stroke="none"')}</svg>`;

  // ---- Buscador tolerante ----
  // Ignora acentos/mayúsculas, acepta palabras en cualquier orden, palabras a medias,
  // errores de dedo y confusiones comunes del español (b/v, s/z/c, ll/y, h muda, qu/k).
  const Search = (() => {
    const STOP = new Set(["el", "la", "los", "las", "de", "del", "y", "a", "en", "un", "una", "al", "lo"]);
    const phon = (w) => w
      .replace(/ch/g, "§").replace(/h/g, "").replace(/§/g, "ch")
      .replace(/ll/g, "y").replace(/y\b/g, "i").replace(/v/g, "b").replace(/w/g, "gu")
      .replace(/z/g, "s").replace(/c([ei])/g, "s$1").replace(/qu/g, "k").replace(/c/g, "k").replace(/x/g, "ks")
      .replace(/(.)\1+/g, "$1");
    const words = (s) => plain(s).split(" ").filter(Boolean);
    function lev(a, b, max) {
      if (Math.abs(a.length - b.length) > max) return max + 1;
      // Damerau-Levenshtein (letras cambiadas de lugar cuentan como 1 error)
      let pp = null, prev = Array.from({ length: b.length + 1 }, (_, i) => i);
      for (let i = 1; i <= a.length; i++) {
        const cur = [i]; let best = i;
        for (let j = 1; j <= b.length; j++) {
          cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
          if (pp && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) cur[j] = Math.min(cur[j], pp[j - 2] + 1);
          best = Math.min(best, cur[j]);
        }
        if (best > max) return max + 1;
        pp = prev; prev = cur;
      }
      return prev[b.length];
    }
    const cache = new Map();
    function index(text) {
      let ix = cache.get(text);
      if (!ix) {
        const ws = [...new Set(words(text))];
        ix = { flat: " " + ws.join(" ") + " ", ws: ws.map((w) => ({ w, p: phon(w) })) };
        if (cache.size > 3000) cache.clear();
        cache.set(text, ix);
      }
      return ix;
    }
    function tokScore(q, ix) {
      const qp = phon(q);
      if (ix.flat.includes(" " + q + " ")) return 3;
      let best = 0;
      for (const { w, p } of ix.ws) {
        if (w.startsWith(q)) best = Math.max(best, q.length >= 2 ? 2.6 : 1.5);
        else if (p === qp) best = Math.max(best, 2.4);
        else if (q.length >= 3 && p.startsWith(qp)) best = Math.max(best, 2.1);
        else if (q.length >= 4) {
          const max = q.length >= 7 ? 2 : 1;
          const d = Math.min(lev(qp, p, max), lev(qp, p.slice(0, qp.length), max) + 0.5);
          if (d <= max) best = Math.max(best, 1.8 - d * 0.4);
        }
        if (best >= 2.6) break;
      }
      if (!best && q.length >= 3 && ix.flat.includes(q)) best = 1.6; // dentro de otra palabra
      return best;
    }
    /** Devuelve 0 si no coincide; mientras más alto, más parecido. fields: [[texto, peso], ...] */
    function score(query, fields) {
      let qs = words(query); if (!qs.length) return 1;
      const content = qs.filter((w) => !STOP.has(w)); if (content.length) qs = content;
      const qFlat = plain(query);
      let total = 0;
      for (const q of qs) {
        let best = 0;
        for (const [text, w] of fields) { const s = tokScore(q, index(text)) * w; if (s > best) best = s; }
        if (!best) return 0; // todas las palabras deben aparecer (aunque sea parecidas)
        total += best;
      }
      const head = plain(fields[0][0]);
      if (head.startsWith(qFlat)) total += 4; else if (head.includes(qFlat)) total += 2.5;
      return total;
    }
    /** Filtra y ordena por parecido. Sin búsqueda, deja la lista como está. */
    function rank(items, query, fieldsOf) {
      if (!plain(query)) return items;
      return items.map((it) => ({ it, s: score(query, fieldsOf(it)) })).filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s).map((x) => x.it);
    }
    return { rank, score, phon };
  })();

  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg; t.hidden = false; t.style.animation = "none"; void t.offsetWidth; t.style.animation = "";
    clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), 2400);
  }

  // ================= 2. datos =================
  const STORE = "atril:v2";
  const DEVICE = (() => { try { let d = localStorage.getItem("atril:device"); if (!d) { d = uid(); localStorage.setItem("atril:device", d); } return d; } catch { return uid(); } })();
  const DEFAULT_SETTINGS = { font: 56, speed: 6, lineHeight: 1.35, margin: 8, mirror: false, mirrorV: false, guide: true, guidePos: 35, countdown: 3, upper: false, loop: false, fg: "#ffffff", bg: "#000000", fuente: "sistema", efecto: "ninguno" };
  const DEFAULT_RITMOS = ["Cumbia", "Banda romántica", "Ranchera", "Corrido", "Norteña", "Huapango", "Quebradita", "Tropical", "Balada", "Rock / Pop", "Zapateado"];

  function seed() {
    const d = window.ATRIL_DATA || { canciones: [], notas: [] };
    return {
      version: 2, origen: d.generado || "",
      canciones: d.canciones.map((c) => ({ ...c, ts: 0 })),
      notas: d.notas.map((n) => ({ ...n, ts: 0 })),
      ritmos: DEFAULT_RITMOS.slice(),
      ajustes: { ...DEFAULT_SETTINGS },
    };
  }
  function load() {
    try {
      const raw = localStorage.getItem(STORE) || localStorage.getItem("atril:v1");
      if (raw) {
        const s = JSON.parse(raw);
        s.version = 2;
        s.notas.forEach((n) => { if (n.ts == null) n.ts = n.editada ? now() : 0; delete n.editada; });
        s.canciones.forEach((c) => { if (c.ts == null) c.ts = 0; });
        s.ajustes = { ...DEFAULT_SETTINGS, ...(s.ajustes || {}) };
        s.ritmos = s.ritmos || DEFAULT_RITMOS.slice();
        return s;
      }
    } catch (e) { console.warn("No se pudo leer el almacenamiento", e); }
    return seed();
  }
  let state = load();
  /** Notas, canciones y letras también viajan por el enlace directo iPad ⇄ teléfono (sirve sin internet).
   *  Van en pedazos porque cada mensaje del canal tiene un tamaño máximo. */
  const LinkData = {
    PART: 60000, got: null, t: 0,
    send() {
      if (!Link.ok()) return;
      const j = JSON.stringify(shared()), n = Math.max(1, Math.ceil(j.length / this.PART)), id = Date.now().toString(36);
      for (let i = 0; i < n; i++) Link.send({ t: "datos", id, i, n, s: j.slice(i * this.PART, (i + 1) * this.PART) });
    },
    later() { clearTimeout(this.t); if (Link.ok()) this.t = setTimeout(() => this.send(), 2000); },
    part(m) {
      const n = +m.n, i = +m.i;
      if (!(n >= 1 && n <= 400 && i >= 0 && i < n) || typeof m.s !== "string") return;
      if (!this.got || this.got.id !== m.id) this.got = { id: m.id, n, parts: [], c: 0 };
      const g = this.got;
      if (g.parts[i] == null) { g.parts[i] = m.s; g.c++; }
      if (g.c < g.n) return;
      this.got = null;
      let data; try { data = JSON.parse(g.parts.join("")); } catch { return; }
      const { changed } = mergeIn(data);
      if (!changed) return;
      save({ link: false }); // no se reenvía al otro aparato: ya lo tiene
      toast(`${changed} cambio${changed === 1 ? "" : "s"} recibido${changed === 1 ? "" : "s"} del ${Link.role === "pantalla" ? "teléfono" : "iPad"}`);
      refreshView();
    },
  };
  function save({ sync = true, link = true } = {}) {
    try { localStorage.setItem(STORE, JSON.stringify(state)); }
    catch { toast("No se pudo guardar en este navegador"); }
    if (sync) Sync.schedule();
    if (sync && link) LinkData.later();
  }
  save({ sync: false });
  // Pide al navegador guardar los datos de forma permanente (que Safari no los borre por falta de uso).
  try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch {}

  const touch =(o) => { o.ts = now(); return o; };
  const alive = (arr) => arr.filter((x) => !x.del);
  // orden manual (arrastrando ≡); los que nunca se movieron van por fecha
  const ordered = (arr) => arr.slice().sort((a, b) => (a.orden ?? 1e9) - (b.orden ?? 1e9) || (b.modificado || "").localeCompare(a.modificado || "") || a.titulo.localeCompare(b.titulo));
  const topOrder = () => Math.min(0, ...alive(state.notas).map((n) => n.orden ?? 0)) - 1;
  const songById = (id) => state.canciones.find((c) => c.id === id && !c.del);
  const noteById = (id) => state.notas.find((n) => n.id === id && !n.del);
  const normName = (s) => plain(s).replace(/^(el|la|los|las) /, "");
  const songIdFromName = (name) => (alive(state.canciones).find((c) => normName(c.nombre) === normName(name)) || {}).id;
  function addRitmo(r) { if (r && !state.ritmos.some((x) => plain(x) === plain(r))) state.ritmos.push(r); }

  // Lo que se comparte entre dispositivos (los ajustes del prompter son de cada aparato).
  const shared = () => ({ app: "atril", version: 2, notas: state.notas, canciones: state.canciones, ritmos: state.ritmos });

  /** Combina datos de otro dispositivo: por cada elemento gana el cambio más reciente. */
  function mergeIn(remote) {
    if (!remote || !Array.isArray(remote.notas) || !Array.isArray(remote.canciones)) return { changed: 0 };
    let changed = 0;
    const mergeList = (local, incoming) => {
      const map = new Map(local.map((x) => [x.id, x]));
      incoming.forEach((r) => {
        const l = map.get(r.id);
        if (!l) { local.push({ ...r }); changed++; }
        else if ((r.ts || 0) > (l.ts || 0)) { Object.assign(l, r); Object.keys(l).forEach((k) => { if (!(k in r)) delete l[k]; }); changed++; }
      });
    };
    mergeList(state.notas, remote.notas);
    mergeList(state.canciones, remote.canciones);
    (remote.ritmos || []).forEach((r) => { if (!state.ritmos.includes(r)) { state.ritmos.push(r); changed++; } });
    return { changed };
  }

  // ================= 3. sincronización =================
  const Sync = {
    lan: null,          // info de server.py si la app se abrió desde la PC
    status: "local",
    timer: 0, busy: false, again: false,

    setStatus(s, label) {
      this.status = s;
      const d = $("#syncDot"); if (!d) return;
      d.className = "sync-dot " + ({ ok: "ok", busy: "busy", err: "err" }[s] || "");
      d.textContent = label || ({ ok: "Sincronizado", busy: "Sincronizando…", err: "Sin conexión", local: "" }[s] || "");
      d.hidden = s === "local";
    },
    schedule(delay = 1200) { clearTimeout(this.timer); this.timer = setTimeout(() => this.run(), delay); },
    async run() {
      if (this.busy) { this.again = true; return; }
      if (!this.lan && !Dropbox.connected()) { this.setStatus("local"); return; }
      this.busy = true; this.setStatus("busy");
      let ok = true, changed = 0;
      try {
        if (this.lan) changed += await Lan.push();
      } catch (e) { ok = false; console.warn("WiFi local", e); }
      try {
        if (Dropbox.connected()) {
          if (navigator.onLine === false) ok = ok && !!this.lan;
          else changed += await Dropbox.sync();
        }
      } catch (e) { ok = false; console.warn("Dropbox", e); }
      this.busy = false;
      this.setStatus(ok ? "ok" : "err");
      if (changed) { save({ sync: false }); refreshView(); }
      if (this.again) { this.again = false; this.schedule(300); }
    },
  };

  // ---- WiFi local: server.py en una PC (no necesita internet, solo la misma red) ----
  const Lan = {
    async detect() {
      if (!/^https?:$/.test(location.protocol)) return null;
      try {
        const r = await fetch("api/ping", { cache: "no-store" });
        return r.ok ? await r.json() : null;
      } catch { return null; }
    },
    async push() {
      const r = await fetch("api/state", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: DEVICE, data: shared() }),
      });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const { data } = await r.json();
      return mergeIn(data).changed;
    },
    // Conexión en vivo (EventSource) + respaldo (preguntar cada 1.5 s a api/poll).
    // El iPad corta la conexión al bloquearse o al pasar Safari a segundo plano, y no
    // siempre la recupera solo: aquí se vigila con la señal de vida que manda la PC
    // cada 10 s y, mientras no hay conexión en vivo, los comandos llegan por el respaldo.
    es: null, seq: 0, rev: null, lastSeen: 0, lastTry: 0, fails: 0, down: false, timer: 0, polling: false,
    start(info) {
      this.seq = (info && info.seq) || 0;
      this.rev = info ? info.rev : null;
      this.connect();
      clearInterval(this.timer);
      this.timer = setInterval(() => this.tick(), 1500);
    },
    connect() {
      if (!window.EventSource) return;
      this.lastTry = Date.now();
      if (this.es) { try { this.es.close(); } catch {} }
      const es = (this.es = new EventSource("api/events"));
      es.onmessage = (ev) => { let m; try { m = JSON.parse(ev.data); } catch { return; } this.onMsg(m); };
      es.onopen = () => { this.lastSeen = Date.now(); };
    },
    live() { return !!this.es && this.es.readyState === 1 && Date.now() - this.lastSeen < 25000; },
    up() { this.fails = 0; if (this.down) { this.down = false; Sync.setStatus("ok"); Sync.schedule(100); } },
    onMsg(m) {
      this.lastSeen = Date.now(); this.up();
      if (m.type === "hello") {
        if (m.seq < this.seq) this.seq = m.seq;      // la PC se reinició
        else if (m.seq > this.seq) this.poll();      // hubo comandos mientras estaba desconectado
        this.checkRev(m.rev);
      } else if (m.type === "ping") {
        this.checkRev(m.rev);
      } else if (m.type === "rev") {
        if (m.from !== DEVICE) Sync.schedule(100);
        this.rev = m.rev;
      } else if (m.type === "cmd") {
        this.runCmd(m);
      }
    },
    checkRev(r) { if (this.rev !== null && r !== this.rev) Sync.schedule(100); this.rev = r; },
    runCmd(m) {
      if (m.seq) { if (m.seq <= this.seq) return; this.seq = m.seq; }   // nunca repetir un comando
      remoteCmd(m.cmd, m.nota);
    },
    async poll() {
      if (this.polling) return; this.polling = true;
      try {
        const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 4000);
        const r = await fetch("api/poll?since=" + this.seq, { cache: "no-store", signal: ctl.signal });
        clearTimeout(to);
        const d = await r.json();
        if (d.seq < this.seq) this.seq = d.seq;
        // los comandos viejos (de cuando el iPad estaba bloqueado) se saltan, no se ejecutan de golpe
        (d.cmds || []).forEach((c) => { if (d.now - c.t < 8) this.runCmd(c); else this.seq = Math.max(this.seq, c.seq); });
        this.checkRev(d.rev);
        this.up();
      } catch {
        if (++this.fails >= 2 && !this.down) { this.down = true; Sync.setStatus("err", "Sin PC"); }
      } finally { this.polling = false; }
    },
    tick() {
      if (document.visibilityState !== "visible") return;
      if (this.live()) return this.up();
      this.poll();
      if (Date.now() - this.lastTry > 6000) this.connect();
    },
    wake() { if (!this.timer) return; this.lastTry = 0; this.tick(); },
  };

  /** Lo que hace un comando del control remoto (venga por la PC o por la conexión directa). */
  function remoteCmd(cmd, nota) {
    if (cmd === "open" && nota) {
      const h = "#/prompter/" + encodeURIComponent(nota);
      if (location.hash !== h) location.hash = h;
      return;
    }
    if (P.open) command(cmd);
    else if (cmd && !/^(drag|line):/.test(cmd)) toast("Abre un guion para usar el control");
  }

  // ---- Control directo por QR: sin PC y sin internet ----
  // El iPad y el teléfono solo necesitan estar en la misma red; el hotspot del teléfono
  // sirve aunque no tenga datos. Se intercambian dos códigos QR (la "oferta" del iPad y la
  // "respuesta" del teléfono) y desde ahí se hablan directo con WebRTC, sin servidor.
  const QR_PREFIX = "AT1";   // formato anterior: la descripción completa comprimida (QR grande)
  const QR_PREFIX2 = "AT2";  // formato compacto: solo los datos que cambian (QR chico, fácil de leer)
  const isAtrilCode = (s) => /^AT[12]/.test(s || "");
  const loadScript = (src, global) => new Promise((ok, no) => {
    if (window[global]) return ok();
    const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => no(new Error("No se pudo cargar " + src));
    document.head.appendChild(s);
  });
  const b64urlDecode = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
  const streamBytes = async (bytes, stream) => new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
  const hex = (bytes) => [...bytes].map((x) => x.toString(16).padStart(2, "0")).join("");

  /** Deja solo lo necesario de la descripción de conexión para que el QR sea chico. */
  function slimSdp(sdp) {
    const lines = sdp.split(/\r?\n/).filter(Boolean);
    const cands = lines.filter((l) => l.startsWith("a=candidate:"));
    const udp = cands.filter((l) => /^udp$/i.test(l.split(" ")[2] || ""));
    const v4 = udp.filter((l) => !(l.split(" ")[4] || "").includes(":"));
    const keep = new Set(v4.length ? v4 : udp.length ? udp : cands);
    return lines.filter((l) => !l.startsWith("a=candidate:") || keep.has(l)).join("\r\n") + "\r\n";
  }

  // Formato compacto (≈110 letras en vez de ≈570): tipo, rol, usuario y clave de conexión,
  // huella del certificado y las direcciones del aparato. El resto de la descripción es igual
  // en todos los aparatos y se vuelve a armar del otro lado (expandSdp).
  const SETUPS = ["actpass", "active", "passive"];
  function compactSdp(desc, extra = []) {
    const sdp = desc.sdp;
    const get = (k) => { const m = sdp.match(new RegExp("^a=" + k + ":(.*)$", "m")); return m ? m[1].trim() : ""; };
    const ufrag = get("ice-ufrag"), pwd = get("ice-pwd"), mid = get("mid"), setup = SETUPS.indexOf(get("setup"));
    const fp = get("fingerprint").match(/^sha-256 ((?:[0-9A-F]{2}:){31}[0-9A-F]{2})$/i);
    const ascii = (s) => /^[\x21-\x7e]{1,64}$/.test(s);
    if ((sdp.match(/^m=/gm) || []).length !== 1 || !/^m=application \S+ UDP\/DTLS\/SCTP webrtc-datachannel/m.test(sdp)) return null;
    if (!ascii(ufrag) || !ascii(pwd) || !ascii(mid) || setup < 0 || !fp) return null;
    const v4 = [], mdns = [], seen = new Set();
    for (const l of sdp.split(/\r?\n/)) {
      const p = l.split(" ");
      if (!l.startsWith("a=candidate:") || p[1] !== "1" || !/^udp$/i.test(p[2]) || p[7] !== "host") continue;
      const ip = p[4], port = +p[5];
      if (seen.has(ip + ":" + port) || !(port > 0 && port < 65536)) continue;
      seen.add(ip + ":" + port);
      const a = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
      const u = ip.match(/^([0-9a-f]{8})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{12})\.local$/i);
      if (a) v4.push([0, ...a.slice(1).map(Number), port >> 8, port & 255]);
      else if (u) mdns.push([1, ...u.slice(1).join("").match(/../g).map((h) => parseInt(h, 16)), port >> 8, port & 255]);
    }
    const cands = [...v4, ...mdns].slice(0, 5);
    if (!cands.length) return null;
    const str = (s) => [s.length, ...[...s].map((c) => c.charCodeAt(0))];
    const bytes = [desc.type === "offer" ? 1 : 2, setup, ...str(ufrag), ...str(pwd), ...str(mid),
      ...fp[1].split(":").map((h) => parseInt(h, 16)), cands.length, ...cands.flat(), ...extra];
    return QR_PREFIX2 + b64url(Uint8Array.from(bytes));
  }
  function expandSdp(b) {
    let i = 0;
    const take = (n) => { if (i + n > b.length) throw new Error("código incompleto"); return b.slice(i, (i += n)); };
    const str = () => String.fromCharCode(...take(take(1)[0]));
    const type = take(1)[0] === 1 ? "offer" : "answer", setup = SETUPS[take(1)[0]];
    const ufrag = str(), pwd = str(), mid = str();
    const fp = hex(take(32)).toUpperCase().match(/../g).join(":");
    const n = take(1)[0], cands = [];
    for (let k = 0; k < n; k++) {
      const kind = take(1)[0];
      let ip;
      if (kind === 0) ip = [...take(4)].join(".");
      else { const h = hex(take(16)); ip = `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}.local`; }
      const pb = take(2);
      cands.push(`a=candidate:${k + 1} 1 udp ${2122260223 - k} ${ip} ${(pb[0] << 8) | pb[1]} typ host generation 0`);
    }
    if (!setup) throw new Error("código dañado");
    return { type, sdp: buildSdp({ setup, ufrag, pwd, mid, fp, cands }), extra: [...b.slice(i)] };
  }
  /** Arma una descripción de conexión completa (solo canal de datos) a partir de sus partes. */
  function buildSdp({ setup, ufrag, pwd, mid, fp, cands }) {
    return ["v=0", `o=- ${Date.now()} 2 IN IP4 127.0.0.1`, "s=-", "t=0 0", `a=group:BUNDLE ${mid}`, "a=msid-semantic: WMS",
      "m=application 9 UDP/DTLS/SCTP webrtc-datachannel", "c=IN IP4 0.0.0.0", ...cands,
      `a=ice-ufrag:${ufrag}`, `a=ice-pwd:${pwd}`, "a=ice-options:trickle", `a=fingerprint:sha-256 ${fp}`,
      `a=setup:${setup}`, `a=mid:${mid}`, "a=sctp-port:5000", "a=max-message-size:262144"].join("\r\n") + "\r\n";
  }

  async function packSdp(desc) {
    const small = compactSdp(desc);
    if (small) return small;
    let bytes = new TextEncoder().encode(desc.type[0] + slimSdp(desc.sdp)), mode = "p";
    if (window.CompressionStream) { try { bytes = await streamBytes(bytes, new CompressionStream("deflate-raw")); mode = "z"; } catch {} }
    return QR_PREFIX + mode + b64url(bytes);
  }
  async function unpackSdp(code) {
    code = String(code || "").replace(/\s+/g, "");
    if (code.startsWith(QR_PREFIX2)) return expandSdp(b64urlDecode(code.slice(QR_PREFIX2.length)));
    if (!code.startsWith(QR_PREFIX)) throw new Error("Ese código no es de Atril");
    let bytes = b64urlDecode(code.slice(QR_PREFIX.length + 1));
    if (code[QR_PREFIX.length] === "z") bytes = await streamBytes(bytes, new DecompressionStream("deflate-raw"));
    const text = new TextDecoder().decode(bytes);
    return { type: text[0] === "o" ? "offer" : "answer", sdp: text.slice(1) };
  }
  async function qrSvg(text) {
    await loadScript("vendor/qrcode.js", "qrcode");
    // Con el código corto alcanza para más corrección de errores (se lee mejor con reflejos).
    const q = window.qrcode(0, text.length <= 200 ? "M" : "L"); q.addData(text, "Byte"); q.make();
    return q.createSvgTag({ cellSize: 4, margin: 4, scalable: true });
  }
  /** Espera a que el aparato termine de juntar sus direcciones de red (máx. 4 s). */
  const gathered = (pc) => pc.iceGatheringState === "complete" ? Promise.resolve() : new Promise((res) => {
    const t = setTimeout(res, 4000);
    pc.addEventListener("icegatheringstatechange", () => { if (pc.iceGatheringState === "complete") { clearTimeout(t); res(); } });
  });

  // ---- Teléfono recordado: después del primer enlace basta con escanear el código del iPad ----
  // El teléfono usa siempre el mismo certificado (guardado en el aparato) y el iPad recuerda su
  // huella. Con eso el iPad arma solo la respuesta del teléfono, y el teléfono ya no tiene que
  // mostrar su código. El usuario y la clave de conexión del teléfono se calculan igual en los dos
  // lados a partir de los del iPad (derivedIce); la seguridad la da la huella del certificado.
  const QUICK = 9; // marca en el código del iPad: "espero al teléfono que ya conozco"
  const sdpGet = (sdp, k) => { const m = sdp.match(new RegExp("^a=" + k + ":(.*)$", "m")); return m ? m[1].trim() : ""; };
  const fpOf = (sdp) => { const m = sdpGet(sdp, "fingerprint").match(/^sha-256 (\S+)$/i); return m ? m[1].toUpperCase() : ""; };
  const fpHint = (fp) => fp.split(":").slice(0, 2).map((h) => parseInt(h, 16));
  const flip = (s) => [...s].reverse().join("");
  const derivedIce = (sdp) => ({ ufrag: ("q" + flip(sdpGet(sdp, "ice-ufrag"))).slice(0, 64), pwd: (flip(sdpGet(sdp, "ice-pwd")) + "qq").slice(0, 64) });
  const Known = {
    K: "atril:telefono",
    get() { try { const k = JSON.parse(localStorage.getItem(this.K) || "null"); return k && k.fp ? k : null; } catch { return null; } },
    set(fp) { try { localStorage.setItem(this.K, JSON.stringify({ fp, t: now() })); } catch {} },
  };
  const PhoneCert = {
    async get() {
      if (!window.indexedDB || !window.RTCPeerConnection || !RTCPeerConnection.generateCertificate) return null;
      try {
        const db = await new Promise((ok, no) => {
          const r = indexedDB.open("atril-rtc", 1);
          r.onupgradeneeded = () => r.result.createObjectStore("c");
          r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error);
        });
        const io = (mode, fn) => new Promise((ok, no) => {
          const tx = db.transaction("c", mode), q = fn(tx.objectStore("c"));
          tx.oncomplete = () => ok(q.result); tx.onerror = () => no(tx.error);
        });
        let cert = await io("readonly", (st) => st.get("cert"));
        // dura un año; unos días antes de vencer se hace uno nuevo (y hay que enlazar otra vez con los dos códigos)
        if (!(cert instanceof RTCCertificate) || cert.expires - Date.now() < 20 * 864e5) {
          cert = await RTCPeerConnection.generateCertificate({ name: "ECDSA", namedCurve: "P-256", expires: 365 * 864e5 });
          await io("readwrite", (st) => st.put(cert, "cert"));
        }
        return cert;
      } catch { return null; }
    },
    fp(cert) { const f = cert && cert.getFingerprints().find((x) => x.algorithm === "sha-256"); return f ? f.value.toUpperCase() : ""; },
  };

  /** Cámara + lector de QR. Usa el lector del sistema si existe (Android) y si no jsQR,
   *  incluido en la app para funcionar sin internet. onCode devuelve true si el código sirvió;
   *  si no, la cámara sigue buscando. */
  const Cam = {
    stream: null, timer: 0,
    async start(video, facing, onCode) {
      this.stop();
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error("Este navegador no permite usar la cámara aquí (necesita https)");
      let det = null;
      if ("BarcodeDetector" in window) {
        try { if ((await window.BarcodeDetector.getSupportedFormats()).includes("qr_code")) det = new window.BarcodeDetector({ formats: ["qr_code"] }); } catch {}
      }
      const useJsQR = () => loadScript("vendor/jsQR.js", "jsQR");
      if (!det) await useJsQR();
      let stream;
      try {
        stream = this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
      } catch (e) {
        throw new Error(e.name === "NotAllowedError" ? "Permite el uso de la cámara para leer el código"
          : e.name === "NotFoundError" ? "No se encontró una cámara" : "No se pudo abrir la cámara");
      }
      video.srcObject = stream; video.setAttribute("playsinline", ""); video.muted = true;
      await video.play().catch(() => {});
      const cv = document.createElement("canvas"), cx = cv.getContext("2d", { willReadFrequently: true });
      let last = "", lastT = 0, crop = false;
      const read = async () => {
        if (det) {
          try { const r = await det.detect(video); const hit = r.find((x) => isAtrilCode(x.rawValue)); return hit ? hit.rawValue : ""; }
          catch { det = null; await useJsQR().catch(() => {}); return ""; }
        }
        if (!window.jsQR) return "";
        // una vez el cuadro completo y otra solo el centro con más detalle (ayuda con QR chicos o lejanos)
        crop = !crop;
        const vw = video.videoWidth, vh = video.videoHeight, f = crop ? 0.6 : 1;
        const sw = vw * f, sh = vh * f, s = Math.min(1, 1280 / sw);
        cv.width = (sw * s) | 0; cv.height = (sh * s) | 0;
        cx.drawImage(video, (vw - sw) / 2, (vh - sh) / 2, sw, sh, 0, 0, cv.width, cv.height);
        const r = window.jsQR(cx.getImageData(0, 0, cv.width, cv.height).data, cv.width, cv.height, { inversionAttempts: "attemptBoth" });
        return r && isAtrilCode(r.data) ? r.data : "";
      };
      const tick = async () => {
        if (this.stream !== stream) return;
        const data = video.videoWidth ? await read() : "";
        if (this.stream !== stream) return;
        // el mismo código que ya falló no se vuelve a probar enseguida
        if (data && (data !== last || Date.now() - lastT > 3000)) {
          last = data; lastT = Date.now();
          let ok = false; try { ok = await onCode(data); } catch {}
          if (ok) return;
        }
        if (this.stream === stream) this.timer = setTimeout(tick, det ? 120 : 160);
      };
      tick();
    },
    stop() { clearTimeout(this.timer); if (this.stream) this.stream.getTracks().forEach((t) => t.stop()); this.stream = null; },
  };

  const Link = {
    pc: null, dc: null, role: null, last: "", statusT: 0, onChange: null, onMsg: null,
    ok() { return !!this.dc && this.dc.readyState === "open"; },
    reset() {
      clearInterval(this.statusT);
      const dc = this.dc, pc = this.pc; this.dc = this.pc = null;
      try { dc && dc.close(); } catch {} try { pc && pc.close(); } catch {}
    },
    newPC(role, certificates) {
      this.reset(); this.role = role; this.last = ""; this.quick = false;
      const pc = (this.pc = new RTCPeerConnection(certificates ? { iceServers: [], certificates } : { iceServers: [] }));
      pc.onconnectionstatechange = () => { if (pc === this.pc && ["failed", "closed"].includes(pc.connectionState)) this.lost(); };
      return pc;
    },
    bind(dc) {
      this.dc = dc;
      dc.onopen = () => this.opened();
      dc.onclose = () => { if (dc === this.dc) this.lost(); };
      dc.binaryType = "arraybuffer";
      dc.onmessage = (e) => {
        if (typeof e.data !== "string") { if (this.role === "pantalla") BgRecv.chunk(e.data); return; }
        let m; try { m = JSON.parse(e.data); } catch { return; } this.handle(m);
      };
    },
    send(m) { if (this.ok()) { try { this.dc.send(JSON.stringify(m)); return true; } catch {} } return false; },
    opened() {
      Cam.stop(); keepAwake(true);
      if (this.role === "pantalla") {
        const fp = this.pc && this.pc.remoteDescription ? fpOf(this.pc.remoteDescription.sdp) : "";
        if (fp) Known.set(fp); // la próxima vez basta con que el teléfono escanee el código del iPad
        toast("Control conectado");
        BgMedia.load().then(() => this.pushStatus());
        this.statusT = setInterval(() => this.pushStatus(), 700); this.pushStatus();
      }
      setTimeout(() => LinkData.send(), 400); // cada uno le pasa al otro lo que tiene
      this.onChange && this.onChange();
      setRemoteBadge();
    },
    lost() {
      const was = !!this.dc; this.reset();
      if (was) toast(this.role === "pantalla" ? "Se desconectó el control" : "Se perdió la conexión con el iPad");
      if (!P.open) keepAwake(false);
      this.onChange && this.onChange();
      setRemoteBadge();
    },
    handle(m) {
      if (m.t === "datos") return LinkData.part(m);
      if (this.role === "pantalla") {
        if (m.t === "cmd") remoteCmd(String(m.cmd || "").slice(0, 24), m.nota);
        else if (m.t === "set") remoteSet(String(m.k || ""), m.v);
        else if (m.t === "bg-start") BgRecv.start(m);
        else if (m.t === "bg-end") BgRecv.end();
        else if (m.t === "bg-clear") BgMedia.clear().then(() => { toast("Fondo quitado"); this.pushStatus(); });
        else if (m.t === "msg") { Msg.show(m.text); this.send({ t: "msg-ok" }); }
      } else if (this.onMsg) this.onMsg(m);
    },
    /** El iPad le cuenta al teléfono qué guiones hay y qué está pasando, para mostrarlo en el control. */
    pushStatus() {
      const n = P.open ? noteById(P.noteId) : null;
      const st = {
        t: "estado", abierto: P.open ? ($("#pTitle").textContent || "Guion") : "", playing: !!P.playing,
        speed: state.ajustes.speed, font: state.ajustes.font,
        notas: ordered(alive(state.notas)).map((x) => [x.id, x.titulo]), nota: n ? n.id : "",
        aj: { margin: state.ajustes.margin, mirror: !!state.ajustes.mirror, guide: !!state.ajustes.guide, loop: !!state.ajustes.loop,
          fg: state.ajustes.fg || "#ffffff", bg: state.ajustes.bg || "#000000", efecto: state.ajustes.efecto || "ninguno" },
        fuente: fontValue(), fuenteN: Fuente.name,
        fondo: BgMedia.url ? BgMedia.name || "Fondo" : "", dim: BgMedia.dim(),
      };
      const j = JSON.stringify(st);
      if (j !== this.last && this.send(st)) this.last = j;
    },
  };
  /** Ajustes que el teléfono puede cambiar en el iPad (con límites, por si llega algo raro). */
  const REMOTE_SET = {
    margin: (v) => Math.min(25, Math.max(0, Math.round(+v))),
    mirror: (v) => !!v, guide: (v) => !!v, loop: (v) => !!v,
    fg: (v) => (/^#[0-9a-f]{6}$/i.test(v) ? v : null), bg: (v) => (/^#[0-9a-f]{6}$/i.test(v) ? v : null),
    fuente: (v) => (v === "web" || DEV_FONTS.some((f) => f[0] === v) ? v : null),
    efecto: (v) => (FX.some((f) => f[0] === v) ? v : null),
  };
  function remoteSet(k, v) {
    if (k === "fuente-g") { // el teléfono no pudo bajarla: que la baje el iPad
      Fuente.google(String(v || "").slice(0, 60)).then(() => { state.ajustes.fuente = "web"; save({ sync: false }); if (P.open) applySettings(); toast("Fuente lista: " + Fuente.name); Link.pushStatus(); })
        .catch(() => Link.send({ t: "bg-error", kind: "fuente", msg: "Ni el teléfono ni el iPad pudieron bajar la fuente: hace falta internet en alguno" }));
      return;
    }
    if (k === "dim") { const d = Math.round(+v); if (d >= 0 && d <= 90) { BgMedia.setDim(d); Link.pushStatus(); } return; }
    const f = REMOTE_SET[k]; if (!f) return;
    const val = f(v); if (val === null || Number.isNaN(val)) return;
    state.ajustes[k] = val; save({ sync: false });
    if (P.open) applySettings();
    if (document.body.classList.contains("drawer-open")) drawDrawer();
    Link.pushStatus();
  }
  /** El teléfono manda la foto/GIF/video en pedazos; aquí se juntan y se guardan como fondo. */
  const BgRecv = {
    meta: null, parts: [], got: 0, MAX: 150 * 1024 * 1024,
    start(m) {
      const size = +m.size || 0, font = m.kind === "fuente", msg = m.kind === "msg";
      this.parts = []; this.got = 0; this.meta = null;
      if (font ? !isFontFile(String(m.name || ""), String(m.type || "")) || size <= 0 || size > Fuente.MAX
        : !/^(image|video)\//.test(String(m.type || "")) || size <= 0 || size > this.MAX) {
        Link.send({ t: "bg-error", kind: m.kind, msg: font ? "Ese archivo no es una fuente o es muy grande" : "Archivo no válido o muy grande (máx. 150 MB)" }); return;
      }
      this.meta = { name: String(m.name || "fondo").slice(0, 80), type: String(m.type || ""), size, font,
        fname: String(m.fname || "").slice(0, 60), src: m.src === "google" ? "google" : "file", msg, text: String(m.text || "").slice(0, 300) };
      if (!msg) toast(font ? "Recibiendo fuente del teléfono…" : "Recibiendo fondo del teléfono…");
    },
    chunk(buf) {
      if (!this.meta) return;
      this.parts.push(buf); this.got += buf.byteLength;
      if (this.got > this.meta.size) { this.meta = null; this.parts = []; }
    },
    async end() {
      const m = this.meta; this.meta = null;
      if (!m || this.got !== m.size) { this.parts = []; Link.send({ t: "bg-error", msg: "El archivo llegó incompleto, envíalo otra vez" }); return; }
      const file = new File(this.parts, m.name, { type: m.type }); this.parts = [];
      if (m.msg) { Msg.show(m.text, file); Link.send({ t: "msg-ok" }); return; }
      if (m.font) {
        try {
          await Fuente.choose(file, m.src, m.fname || undefined);
          state.ajustes.fuente = "web"; save({ sync: false }); if (P.open) applySettings();
          toast("Fuente nueva: " + Fuente.name); Link.send({ t: "bg-ok", kind: "fuente" }); Link.pushStatus();
        } catch (e) { Link.send({ t: "bg-error", kind: "fuente", msg: e.message || "No se pudo usar la fuente" }); }
        return;
      }
      try { await BgMedia.choose(file); toast("Fondo nuevo listo"); Link.send({ t: "bg-ok" }); Link.pushStatus(); }
      catch (e) { Link.send({ t: "bg-error", msg: e.message || "No se pudo guardar el fondo" }); }
    },
  };
  /** Teléfono: manda un archivo al iPad por la conexión directa, sin llenar la memoria de envío. */
  async function sendBgFile(file, onProg, extra = null) {
    const dc = Link.dc;
    if (!Link.ok()) throw new Error("Sin conexión con el iPad");
    if (extra && extra.kind === "fuente") {
      if (!isFontFile(file.name, file.type)) throw new Error("Elige un archivo de fuente (.ttf, .otf o .woff)");
      if (file.size > Fuente.MAX) throw new Error("La fuente es muy grande (máx. 10 MB)");
    } else {
      if (!/^(image|video)\//.test(file.type)) throw new Error("Elige una foto, un GIF o un video");
      if (file.size > BgRecv.MAX) throw new Error("Es muy grande: máximo 150 MB");
    }
    Link.send({ t: "bg-start", name: file.name, type: file.type, size: file.size, ...(extra || {}) });
    const CH = 64 * 1024;
    for (let off = 0; off < file.size; off += CH) {
      while (dc.readyState === "open" && dc.bufferedAmount > 4 * 1024 * 1024) await new Promise((r) => setTimeout(r, 30));
      if (Link.dc !== dc || dc.readyState !== "open") throw new Error("Se perdió la conexión con el iPad");
      dc.send(await file.slice(off, off + CH).arrayBuffer());
      onProg(Math.min(1, (off + CH) / file.size));
    }
    Link.send({ t: "bg-end" });
  }
  // En el teléfono, el gesto "atrás" cerraría la app y cortaría el control. Mientras esté conectado
  // en la pantalla del control, se detiene y se avisa cómo salir.
  let backGuard = false;
  function guardBack() { if (!backGuard) { backGuard = true; history.pushState({ atrilGuard: 1 }, "", location.href); } }
  window.addEventListener("popstate", () => {
    if (backGuard && Link.ok() && Link.role === "control" && location.hash.startsWith("#/control")) {
      history.pushState({ atrilGuard: 1 }, "", location.href);
      toast("Sigues conectado. Para salir del control toca Desconectar");
    } else backGuard = false;
  });

  function setRemoteBadge() {
    const b = $("#pRemote"); if (b) b.classList.toggle("on", Link.ok() && Link.role === "pantalla");
  }

  /** iPad: muestra su código y, la primera vez, lee el del teléfono con la cámara.
   *  Si ya conoce al teléfono, basta con que el teléfono escanee el código del iPad. */
  async function pairScreen() {
    if (!window.RTCPeerConnection) return toast("Este navegador no permite la conexión directa");
    const d = sheet("Conectar control", `<div class="pair" id="pairBox"></div>`);
    let done = false, run = 0;
    d.addEventListener("close", () => { run++; Cam.stop(); if (!done && !Link.ok()) Link.reset(); }, { once: true });
    Link.onChange = () => { if (Link.ok()) { done = true; d.close(); } };

    const start = async (fresh) => {
      const my = ++run, known = fresh ? null : Known.get();
      $("#pairBox", d).innerHTML = `
        <ol class="pair-steps">
          <li>En el teléfono abre Atril → ☰ → <b>Usar como control</b> y escanea este código.</li>
          ${known ? `<li>Listo: este iPad ya conoce tu teléfono y se conecta solo.</li>`
            : `<li>Muestra a esta cámara el código que aparece en el teléfono.</li>`}
        </ol>
        <div class="pair-grid">
          <div class="qr" id="qr"><div class="empty">Preparando código…</div></div>
          <div class="cam"><video id="cam" playsinline muted></video><span class="cam-msg" id="camMsg">Abriendo cámara…</span></div>
        </div>
        <p class="pair-state" id="pst">Los dos aparatos deben estar en la misma red WiFi o en el hotspot del teléfono (no necesita datos).</p>
        ${known ? `<div class="row"><button class="btn sm tint" id="other">Usar otro teléfono</button></div>` : ""}
        <details class="pair-manual"><summary>¿No funciona la cámara?</summary>
          <p class="section-f">Copia este código y pásalo al teléfono${known ? "" : ", luego pega aquí el que te dé"}.</p>
          <textarea class="field-input code" id="myCode" readonly></textarea>
          <div class="row"><button class="btn sm tint" id="cp">Copiar</button></div>
          ${known ? "" : `<textarea class="field-input code" id="theirCode" placeholder="Pega aquí el código del teléfono"></textarea>
          <div class="row"><button class="btn sm fill" id="useCode">Conectar</button></div>`}
        </details>`;
      const pst = (t) => { const e = $("#pst", d); if (e) e.textContent = t; };
      if (known) $("#other", d).onclick = () => start(true);
      const accept = async (code) => {
        if (my !== run) return true;
        try {
          const desc = await unpackSdp(code);
          if (desc.type !== "answer") { pst("Ese es el código del iPad. Muestra el que aparece en el teléfono."); return false; }
          if (known) { pst("Ese es otro teléfono: toca «Usar otro teléfono»."); return false; }
          if (!Link.pc || Link.pc.signalingState !== "have-local-offer") { pst("Espera a que aparezca el código del iPad."); return false; }
          pst("Conectando…");
          await Link.pc.setRemoteDescription(desc);
          Cam.stop();
          return true;
        } catch (e) { pst("No se pudo leer el código: " + e.message); return false; }
      };
      // La cámara se abre antes de crear el código: con la cámara activa el navegador incluye
      // la dirección real del aparato en la red, y la conexión directa es más confiable.
      try { await Cam.start($("#cam", d), "user", accept); $("#camMsg", d).textContent = known ? "Cámara lista" : "Apunta aquí el código del teléfono"; }
      catch (e) { const m = $("#camMsg", d); if (m) m.textContent = e.message || "No se pudo abrir la cámara"; }
      if (my !== run) return;
      const pc = Link.newPC("pantalla");
      Link.bind(pc.createDataChannel("atril", { ordered: true }));
      await pc.setLocalDescription(await pc.createOffer());
      await gathered(pc);
      if (pc !== Link.pc || my !== run) return;
      let code = null;
      if (known) {
        // el iPad arma solo la respuesta del teléfono conocido (sin direcciones: el teléfono llega solo)
        code = compactSdp(pc.localDescription, [QUICK, ...fpHint(known.fp)]);
        if (code) {
          const sdp = pc.localDescription.sdp, ice = derivedIce(sdp);
          try { await pc.setRemoteDescription({ type: "answer", sdp: buildSdp({ setup: "active", ...ice, mid: sdpGet(sdp, "mid"), fp: known.fp, cands: [] }) }); }
          catch { code = null; }
        }
        if (!code) return start(true); // no se pudo: enlace normal con los dos códigos
      } else code = await packSdp(pc.localDescription);
      $("#qr", d).innerHTML = await qrSvg(code);
      $("#myCode", d).value = code;
      $("#cp", d).onclick = async () => { try { await navigator.clipboard.writeText(code); toast("Copiado"); } catch { $("#myCode", d).select(); } };
      if (!known) $("#useCode", d).onclick = () => accept($("#theirCode", d).value);
    };
    start(false);
  }

  // ---- Dropbox: sincroniza un archivo atril-sync.json en tu Dropbox (necesita internet) ----
  const Dropbox = {
    K: "atril:dropbox",
    FILE: "/atril-sync.json",
    get tok() { try { return JSON.parse(localStorage.getItem(this.K) || "null"); } catch { return null; } },
    set tok(v) { v ? localStorage.setItem(this.K, JSON.stringify(v)) : localStorage.removeItem(this.K); },
    available() { return !!CFG.dropboxAppKey && window.isSecureContext && !!(window.crypto && crypto.subtle); },
    connected() { return this.available() && !!(this.tok && this.tok.refresh_token); },
    // siempre la misma dirección (con o sin "index.html"): Dropbox exige que sea idéntica a la registrada
    redirect() { return location.origin + location.pathname.replace(/[^/]*$/, "") + "index.html"; },
    async connect() {
      const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)));
      const challenge = b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
      // localStorage y no sessionStorage: en el iPad, al volver de Dropbox la app puede abrir en otra pestaña
      localStorage.setItem("atril:pkce", JSON.stringify({ v: verifier, t: now() }));
      const q = new URLSearchParams({
        client_id: CFG.dropboxAppKey, response_type: "code", code_challenge: challenge, code_challenge_method: "S256",
        token_access_type: "offline", redirect_uri: this.redirect(),
      });
      location.href = "https://www.dropbox.com/oauth2/authorize?" + q;
    },
    async finishLogin() {
      const p = new URLSearchParams(location.search); const code = p.get("code");
      if (!code) return;
      history.replaceState(null, "", location.pathname + "#/ajustes");
      let verifier = null;
      try { const k = JSON.parse(localStorage.getItem("atril:pkce") || "null"); if (k && now() - k.t < 30 * 60000) verifier = k.v; } catch {}
      localStorage.removeItem("atril:pkce");
      if (!verifier) { toast("Vuelve a tocar Conectar Dropbox"); return; }
      const r = await fetch("https://api.dropboxapi.com/oauth2/token", {
        method: "POST",
        body: new URLSearchParams({ grant_type: "authorization_code", code, client_id: CFG.dropboxAppKey, code_verifier: verifier, redirect_uri: this.redirect() }),
      });
      if (!r.ok) { toast("No se pudo conectar Dropbox (" + r.status + ")"); return; }
      const t = await r.json();
      this.tok = { refresh_token: t.refresh_token, access_token: t.access_token, exp: now() + (t.expires_in - 60) * 1000 };
      toast("Dropbox conectado"); Sync.schedule(100);
    },
    disconnect() { this.tok = null; Sync.setStatus("local"); },
    async access() {
      const t = this.tok;
      if (t.access_token && t.exp > now()) return t.access_token;
      const r = await fetch("https://api.dropboxapi.com/oauth2/token", {
        method: "POST", body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: t.refresh_token, client_id: CFG.dropboxAppKey }),
      });
      if (r.status === 400 || r.status === 401) { this.disconnect(); throw new Error("Sesión de Dropbox vencida"); }
      if (!r.ok) throw new Error("token " + r.status);
      const j = await r.json();
      this.tok = { ...t, access_token: j.access_token, exp: now() + (j.expires_in - 60) * 1000 };
      return j.access_token;
    },
    async sync(retry = true) {
      const token = await this.access();
      let remote = null, rev = null;
      const d = await fetch("https://content.dropboxapi.com/2/files/download", {
        method: "POST", headers: { Authorization: "Bearer " + token, "Dropbox-API-Arg": JSON.stringify({ path: this.FILE }) },
      });
      if (d.ok) { rev = JSON.parse(d.headers.get("Dropbox-API-Result") || "{}").rev; remote = await d.json(); }
      else if (d.status !== 409) throw new Error("descarga " + d.status);
      const changed = remote ? mergeIn(remote).changed : 0;
      const body = JSON.stringify(shared());
      if (!remote || body !== JSON.stringify({ app: "atril", version: 2, notas: remote.notas, canciones: remote.canciones, ritmos: remote.ritmos })) {
        const u = await fetch("https://content.dropboxapi.com/2/files/upload", {
          method: "POST",
          headers: {
            Authorization: "Bearer " + token, "Content-Type": "application/octet-stream",
            "Dropbox-API-Arg": JSON.stringify({ path: this.FILE, mode: rev ? { ".tag": "update", update: rev } : { ".tag": "add" }, mute: true }),
          },
          body: new Blob([body], { type: "application/octet-stream" }),
        });
        if (u.status === 409 && retry) return changed + (await this.sync(false)); // otro aparato subió antes: volver a combinar
        if (!u.ok) throw new Error("subida " + u.status);
      }
      return changed;
    },
  };
  function b64url(bytes) { return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }

  // ---- Archivo: enviar por WhatsApp, correo, Drive, etc. y recibir en el otro aparato ----
  async function shareFile() {
    const name = `atril-${today()}.json`;
    const blob = new Blob([JSON.stringify(shared())], { type: "application/json" });
    const file = new File([blob], name, { type: "application/json" });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: "Datos de Atril" }); return; }
    } catch (e) { if (e.name === "AbortError") return; }
    const url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast("Archivo guardado en Descargas");
  }
  async function receiveFile(file) {
    try {
      const data = JSON.parse(await file.text());
      const { changed } = mergeIn(data.data || data);
      save(); toast(changed ? `Listo: ${changed} cambios recibidos` : "Ya tenías todo al día");
      refreshView();
    } catch { toast("Ese archivo no es de Atril"); }
  }

  // ================= 4. vistas =================
  // Como en Parrot: barra superior con ☰ (panel de ajustes) · título · +, y la lista de guiones al centro.
  function setBar({ title, left = "menu", back = "#/notas", right = null }) {
    $("#abTitle").textContent = title;
    const l = $("#abLeft");
    l.innerHTML = ic(left === "back" ? "back" : "menu");
    l.setAttribute("aria-label", left === "back" ? "Regresar" : "Abrir ajustes");
    l.onclick = left === "back" ? () => (location.hash = back) : openDrawer;
    const r = $("#abRight");
    r.hidden = !right;
    if (right) { r.innerHTML = ic(right.icon); r.setAttribute("aria-label", right.label); r.onclick = right.onClick; }
  }
  function openDrawer() { drawDrawer(); document.body.classList.add("drawer-open"); $("#drawer").setAttribute("aria-hidden", "false"); }
  function closeDrawer() { document.body.classList.remove("drawer-open"); $("#drawer").setAttribute("aria-hidden", "true"); }
  $("#scrim").onclick = closeDrawer;
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && document.body.classList.contains("drawer-open")) closeDrawer(); });

  /** Panel lateral de ajustes, con los mismos ajustes que Parrot y los nuestros arriba. */
  function drawDrawer() {
    const a = state.ajustes, dr = $("#drawer");
    const val = (k, v) => (k === "speed" ? fmtSpeed(v) : k === "margin" ? v + " %" : v);
    const slider = (k, label, min, max, step, lo, hi) => `
      <div class="dr-slider"><div class="dr-row plain"><span>${label}</span><b id="dv-${k}">${val(k, a[k])}</b></div>
        <div class="dr-range"><span>${lo}</span><input type="range" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${a[k]}" aria-label="${label}"><span>${hi}</span></div></div>`;
    const sw = (k, label) => `<label class="dr-row"><span>${label}</span><input type="checkbox" class="switch dr-switch" data-c="${k}" ${a[k] ? "checked" : ""}></label>`;
    const col = (k, label) => `<label class="dr-row"><span>${label}</span><input type="color" class="dr-color" data-col="${k}" value="${esc(a[k])}"></label>`;
    const link = (to, icon, label, sub = "") => `<button class="dr-row link" data-to="${to}">${ic(icon)}<span>${label}${sub ? `<small>${sub}</small>` : ""}</span>${ic("chev", "chev")}</button>`;
    const linked = Link.ok();
    dr.innerHTML = `
      <div class="dr-head"><button class="ab-btn" data-to="close" aria-label="Cerrar">${ic("back")}</button><h2>Ajustes</h2></div>
      <div class="dr-scroll">
        ${link("pair", "qr", "Conectar control", linked && Link.role === "pantalla" ? "Conectado ✓" : "En el iPad: muestra el código QR")}
        ${link("#/control", "phone", "Usar como control", linked && Link.role === "control" ? "Conectado ✓" : "En el teléfono: escanea el código")}
        ${link("#/biblioteca", "music", "Canciones y ritmos")}
        ${link("#/tanda", "build", "Armar tanda")}
        ${slider("font", "Tamaño de fuente", 24, 140, 2, '<small class="a-s">A</small>', '<span class="a-b">A</span>')}
        ${slider("speed", "Velocidad", 0.5, 30, 0.5, "Lento", "Rápido")}
        ${slider("margin", "Márgenes", 0, 25, 1, "0", "25")}
        ${sw("mirror", "Modo espejo")}
        ${sw("guide", "Marcador de línea")}
        ${sw("loop", "Guion en bucle")}
        ${col("fg", "Color de fuente")}
        ${col("bg", "Color de fondo")}
        <label class="dr-row"><span>Tipografía<small id="drFontN">${a.fuente === "web" && Fuente.name ? esc(Fuente.name) : "Las de Google Fonts se bajan una vez y quedan guardadas"}</small></span>
          <select class="dr-select" id="drFont" aria-label="Tipografía">${fontOptions()}</select></label>
        <div class="dr-row bgm"><span>Fuente propia<small>Un archivo .ttf u .otf, por ejemplo bajado de DaFont</small></span>
          <span class="dr-bg-btns"><label class="btn sm tint">Elegir<input type="file" id="drFontFile" accept=".ttf,.otf,.woff,.woff2,font/*" hidden></label></span></div>
        <label class="dr-row"><span>Efecto de letra</span><select class="dr-select" id="drFx" aria-label="Efecto de letra">${fxOptions()}</select></label>
        <div class="dr-row bgm"><span>Foto, GIF o video de fondo<small>${BgMedia.url ? esc(BgMedia.name || "Elegido") : "Se ve detrás del texto"}</small></span>
          <span class="dr-bg-btns"><label class="btn sm tint">${BgMedia.url ? "Cambiar" : "Elegir"}<input type="file" id="bgFile" accept="image/*,video/*" hidden></label>
          ${BgMedia.url ? `<button class="btn sm plain danger" id="bgDel">Quitar</button>` : ""}</span></div>
        ${BgMedia.url ? `<div class="dr-slider"><div class="dr-row plain"><span>Oscurecer el fondo</span><b id="dv-dim">${BgMedia.dim()} %</b></div>
          <div class="dr-range"><span>0</span><input type="range" id="bgDim" min="0" max="90" step="5" value="${BgMedia.dim()}" aria-label="Oscurecer el fondo"><span>90</span></div></div>` : ""}
        ${link("#/ajustes", "gear", "Más ajustes y respaldo")}
      </div>`;
    const changed = () => { save({ sync: false }); if (P.open) applySettings(); };
    if (!BgMedia.loaded) BgMedia.load().then(() => { if (document.body.classList.contains("drawer-open") && BgMedia.url) drawDrawer(); });
    const df = $("#drFont", dr);
    const setFontSel = () => {
      const v = fontValue();
      if (![...df.options].some((o) => o.value === v)) df.insertAdjacentHTML("beforeend", `<option value="${esc(v)}">${esc(Fuente.name || v)}</option>`);
      df.value = v;
    };
    setFontSel();
    if (!Fuente.loaded) Fuente.load().then(() => document.body.classList.contains("drawer-open") && setFontSel());
    df.onchange = async () => {
      let v = df.value;
      if (v === "g:?") { const n = askFontName(); if (!n) return setFontSel(); v = "g:" + n; }
      if (v.startsWith("g:")) {
        toast("Bajando la fuente " + v.slice(2) + "…");
        try { await Fuente.google(v.slice(2)); a.fuente = "web"; toast("Fuente lista: " + Fuente.name); }
        catch { toast("No se pudo bajar esa fuente. Revisa el internet o el nombre"); return setFontSel(); }
      } else a.fuente = v === "file" ? "web" : v;
      changed(); Link.pushStatus(); drawDrawer();
    };
    $("#drFontFile", dr).onchange = async (e) => {
      const f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return;
      try { await Fuente.choose(f); a.fuente = "web"; changed(); toast("Fuente lista: " + Fuente.name); Link.pushStatus(); drawDrawer(); }
      catch (err) { toast(err.message); }
    };
    $("#drFx", dr).value = a.efecto || "ninguno";
    $("#drFx", dr).onchange = (e) => { a.efecto = e.target.value; changed(); Link.pushStatus(); };
    const bf = $("#bgFile", dr);
    bf.onchange = async () => {
      const f = bf.files && bf.files[0]; if (!f) return;
      toast("Guardando fondo…");
      try { await BgMedia.choose(f); toast("Fondo listo: abre un guion para verlo"); drawDrawer(); } catch (e) { toast(e.message || "No se pudo guardar el fondo"); }
    };
    if ($("#bgDel", dr)) $("#bgDel", dr).onclick = async () => { await BgMedia.clear(); toast("Fondo quitado"); drawDrawer(); };
    if ($("#bgDim", dr)) $("#bgDim", dr).oninput = (e) => { BgMedia.setDim(+e.target.value); $("#dv-dim", dr).textContent = e.target.value + " %"; };
    $$("input[data-k]", dr).forEach((r) => (r.oninput = () => { a[r.dataset.k] = +r.value; $("#dv-" + r.dataset.k, dr).textContent = val(r.dataset.k, +r.value); changed(); }));
    $$("input[data-c]", dr).forEach((c) => (c.onchange = () => { a[c.dataset.c] = c.checked; changed(); }));
    $$("input[data-col]", dr).forEach((c) => (c.oninput = () => { a[c.dataset.col] = c.value; changed(); }));
    $$("[data-to]", dr).forEach((b) => (b.onclick = () => {
      const to = b.dataset.to; closeDrawer();
      if (to === "pair") pairScreen();
      else if (to !== "close") location.hash = to;
    }));
  }

  const views = { notas: viewNotas, nota: viewNota, biblioteca: viewBiblioteca, tanda: viewTanda, ajustes: viewAjustes, control: viewControl };
  function route() {
    const [, name = "notas", arg] = (location.hash || "#/notas").split("/");
    if (name === "prompter") { openPrompter(decodeURIComponent(arg || "")); return; }
    closePrompter(false); closeDrawer();
    if (name !== "control") Cam.stop();
    (views[name] || viewNotas)($("#view"), arg && decodeURIComponent(arg));
  }
  window.addEventListener("hashchange", () => { route(); window.scrollTo(0, 0); });
  function refreshView() {
    if (P.open || location.hash.startsWith("#/control")) return;
    const a = document.activeElement;
    if (a && a.matches("input, textarea") && $("#view").contains(a)) return; // no interrumpir mientras escribes
    const y = window.scrollY; route(); window.scrollTo(0, y);
  }

  const searchBox = (id, ph, val = "") => `<label class="search">${ic("search")}<input type="search" id="${id}" placeholder="${ph}" value="${esc(val)}" autocomplete="off"></label>`;
  const songCount = (t) => (t.match(/^\s*-.+$/gm) || []).reduce((acc, l) => acc + l.split("/").length, 0);

  // ---------- Guiones (pantalla principal) ----------
  let notesQ = "";
  const preview = (t) => String(t || "").replace(/\s+/g, " ").trim().slice(0, 180);
  function viewNotas(el) {
    setBar({ title: "Guiones", right: { icon: "plus", label: "Nuevo guion", onClick: newNoteSheet } });
    el.innerHTML = `${searchBox("q", "Buscar guion o canción", notesQ)}<div class="cards" id="lst"></div>`;
    const lst = $("#lst", el);
    const draw = () => {
      const items = Search.rank(ordered(alive(state.notas)), notesQ, (n) => [[n.titulo, 1.3], [n.texto, 1]]);
      lst.innerHTML = items.length ? items.map((n) => `
        <div class="card" data-id="${esc(n.id)}">
          <div class="c-body"><h3>${esc(n.titulo)}</h3><p>${esc(preview(n.texto)) || "<i>Vacío</i>"}</p></div>
          ${notesQ ? "" : `<button class="handle" aria-label="Mover ${esc(n.titulo)}">${ic("handle")}</button>`}
        </div>`).join("")
        : alive(state.notas).length ? `<div class="empty">No hay guiones que coincidan.</div>`
        : `<div class="empty">Aún no tienes guiones.<br><br>Toca <b>+</b> para crear uno, o carga tu respaldo en
            <b>☰ → Más ajustes y respaldo → Recibir archivo</b>.</div>`;
    };
    $("#q", el).oninput = (e) => { notesQ = e.target.value; draw(); };
    lst.onclick = (e) => {
      if (e.target.closest(".handle") || lst.dataset.dragged) return;
      const c = e.target.closest("[data-id]"); if (c) location.hash = "#/nota/" + encodeURIComponent(c.dataset.id);
    };
    // Reordenar arrastrando la manija ≡: la tarjeta se mueve entre las otras mientras pasas el dedo
    lst.addEventListener("pointerdown", (e) => {
      const h = e.target.closest(".handle"); if (!h) return;
      const card = h.closest(".card"); e.preventDefault();
      h.setPointerCapture(e.pointerId); card.classList.add("dragging"); lst.dataset.dragged = "";
      let scrollT = 0;
      const move = (ev) => {
        const under = document.elementFromPoint(ev.clientX, ev.clientY);
        const other = under && under.closest(".card");
        if (other && other !== card && other.parentNode === lst) {
          const r = other.getBoundingClientRect();
          lst.insertBefore(card, ev.clientY < r.top + r.height / 2 ? other : other.nextSibling);
        }
        clearInterval(scrollT);
        const edge = ev.clientY < 90 ? -12 : ev.clientY > innerHeight - 90 ? 12 : 0;
        if (edge) scrollT = setInterval(() => window.scrollBy(0, edge), 16);
      };
      const up = () => {
        clearInterval(scrollT); card.classList.remove("dragging");
        h.removeEventListener("pointermove", move); h.removeEventListener("pointerup", up); h.removeEventListener("pointercancel", up);
        let changed = 0;
        $$(".card", lst).forEach((c, i) => { const n = noteById(c.dataset.id); if (n && n.orden !== i) { n.orden = i; touch(n); changed++; } });
        if (changed) save();
        lst.dataset.dragged = "1"; setTimeout(() => delete lst.dataset.dragged, 50);
      };
      h.addEventListener("pointermove", move); h.addEventListener("pointerup", up); h.addEventListener("pointercancel", up);
    });
    draw();
  }

  /** Tres formas de crear una nota. */
  function newNoteSheet() {
    const d = sheet("Nueva nota", `
      <div class="group">
        <button class="cell" data-m="libre"><span class="lead">${ic("edit")}</span>
          <div class="t"><b>En blanco</b><span>Escribe y acomoda el texto como tú quieras</span></div>${ic("chev", "chev")}</button>
        <button class="cell" data-m="orden"><span class="lead">${ic("build")}</span>
          <div class="t"><b>Elegir canciones en mi orden</b><span>De tu lista de canciones, en el orden que las toques</span></div>${ic("chev", "chev")}</button>
        <button class="cell" data-m="ritmo"><span class="lead">${ic("music")}</span>
          <div class="t"><b>Elegir canciones agrupadas por ritmo</b><span>Se acomodan solas: cumbias juntas, rancheras juntas…</span></div>${ic("chev", "chev")}</button>
      </div>
      <p class="section-f">Para reagrupar una nota que ya tienes, ábrela y toca “Agrupar por ritmo”.</p>`);
    $$("[data-m]", d).forEach((b) => (b.onclick = () => {
      d.close();
      if (b.dataset.m === "libre") {
        const n = touch({ id: "n" + uid(), titulo: "Nuevo guion", texto: "", modificado: today(), orden: topOrder() });
        state.notas.push(n); save(); location.hash = "#/nota/" + n.id;
      } else {
        draft = { titulo: "", items: [], letras: draft.letras, noLyr: [], q: "", ritmo: "*", modo: b.dataset.m };
        location.hash = "#/tanda";
      }
    }));
  }

  /** Saca las canciones de una nota (líneas que empiezan con "-") y las reconoce en la lista. */
  function songsInText(texto) {
    const ids = [], unknown = [];
    texto.split("\n").forEach((line) => {
      const t = line.trim(); if (!/^-/.test(t) || /^[—–]|——/.test(t)) return;
      t.replace(/^-+\s*/, "").split("/").forEach((p) => {
        let name = p.replace(/\([^)]*\)?/g, "").replace(/\b(MITADES|MITAD|COMPLETA)\b/gi, "").replace(/✍️?/g, "").trim();
        const m = name.match(KEY_RE); if (m) name = name.slice(0, m.index).trim();
        if (!name || /^popurr/i.test(name)) return;
        const id = songIdFromName(name) || (Search.rank(alive(state.canciones), name, (c) => [[c.nombre, 1]])[0] || {}).id;
        if (id && !ids.includes(id)) ids.push(id); else if (!id) unknown.push(name);
      });
    });
    return { ids, unknown };
  }
  function fmtDate(d) {
    if (!d) return "";
    try { return new Date(d + "T12:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" }); } catch { return d; }
  }

  // ---------- Editar nota ----------
  function viewNota(el, id) {
    setBar({ title: "Guion", left: "back" });
    const n = noteById(id);
    if (!n) { el.innerHTML = `<a class="back" href="#/notas">${ic("back")} Notas</a><div class="empty">Esa nota ya no existe.</div>`; return; }
    el.innerHTML = `
      <div class="row"><span class="spacer"></span>
        <button class="btn plain icon" id="dup" aria-label="Duplicar">${ic("copy")}</button>
        <button class="btn plain icon danger" id="del" aria-label="Borrar">${ic("trash")}</button>
        <button class="btn fill" id="play">${ic("play")} Prompter</button></div>
      <input class="title-input" id="tit" value="${esc(n.titulo)}" aria-label="Título de la nota">
      <div class="row" style="margin:4px 0 12px">
        <button class="btn tint sm" id="ins">${ic("plus")} Insertar canción</button>
        <button class="btn tint sm" id="grp">${ic("music")} Agrupar por ritmo</button>
        <span class="muted small" id="st">Se guarda solo</span>
      </div>
      <textarea class="editor" id="txt" spellcheck="false">${esc(n.texto)}</textarea>
      <p class="section-f">Una línea que empieza con <code>-</code> es un bloque de canciones: sepáralas con <code>/</code> y pon el tono al final, por ejemplo <code>-Eva María LAB/Azúcar DO</code>. Escribe <code>MÚSICA</code> para marcar un instrumental y <code>[vel 8]</code> en una línea para cambiar la velocidad del prompter al llegar ahí.</p>`;
    const tit = $("#tit", el), txt = $("#txt", el);
    let t;
    const persist = () => {
      if (n.titulo === (tit.value.trim() || "Sin título") && n.texto === txt.value) return;
      n.titulo = tit.value.trim() || "Sin título"; n.texto = txt.value; n.modificado = today(); touch(n); save();
      $("#st", el).textContent = "Guardado";
    };
    const later = () => { clearTimeout(t); $("#st", el).textContent = "Guardando…"; t = setTimeout(persist, 500); };
    tit.oninput = later; txt.oninput = later;
    $("#play", el).onclick = () => { persist(); location.hash = "#/prompter/" + encodeURIComponent(n.id); };
    $("#grp", el).onclick = () => {
      persist();
      const { ids, unknown } = songsInText(n.texto);
      if (!ids.length) return toast("Esta nota no tiene canciones en líneas con “-”");
      draft = { titulo: n.titulo + " (por ritmo)", items: ids, letras: draft.letras, noLyr: [], q: "", ritmo: "*", modo: "ritmo" };
      location.hash = "#/tanda";
      toast(`${ids.length} canciones cargadas` + (unknown.length ? ` · ${unknown.length} no están en tu lista` : ""));
    };
    $("#dup", el).onclick = () => {
      persist();
      const c = touch({ id: "n" + uid(), titulo: n.titulo + " (copia)", texto: n.texto, modificado: today(), orden: (n.orden ?? topOrder()) + 0.5 });
      state.notas.push(c); save(); location.hash = "#/nota/" + c.id; toast("Nota duplicada");
    };
    $("#del", el).onclick = () => {
      if (!confirm(`¿Borrar la nota "${n.titulo}"? Se borrará también en tus otros dispositivos.`)) return;
      n.del = true; touch(n); save(); location.hash = "#/notas"; toast("Nota borrada");
    };
    $("#ins", el).onclick = () => pickSong((song, withLyrics) => {
      const block = songBlock(song, withLyrics), pos = txt.selectionStart ?? txt.value.length;
      const before = txt.value.slice(0, pos), after = txt.value.slice(pos);
      const gap = !before ? "" : before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
      txt.value = before + gap + block + "\n\n" + after; later();
    });
  }
  function songBlock(song, withLyrics) {
    let s = "-" + song.nombre + (song.tono ? " " + song.tono : "");
    if (withLyrics && song.letra) s += "\n\n" + song.letra.trim();
    return s;
  }

  // ---------- hojas (sheets) ----------
  function sheet(title, body, { left = "Cerrar", right = "", onRight, el = "#sheet" } = {}) {
    const d = $(el);
    d.innerHTML = `<div class="grabber"></div><div class="sheet-head">
        <button class="btn plain" data-x>${left}</button><h2>${esc(title)}</h2>
        ${right ? `<button class="btn plain" data-ok style="font-weight:700">${right}</button>` : `<span style="min-width:80px"></span>`}
      </div><div class="sheet-body">${body}</div>`;
    $("[data-x]", d).onclick = () => d.close();
    if (right) $("[data-ok]", d).onclick = () => { if (onRight() !== false) d.close(); };
    d.onclick = (e) => { if (e.target === d) d.close(); };
    d.showModal();
    return d;
  }
  function pickSong(onPick) {
    const d = sheet("Insertar canción", `
      ${searchBox("pq", "Buscar canción")}
      <div class="group"><label class="cell"><div class="t"><b>Incluir la letra si la tiene</b></div><input type="checkbox" class="switch" id="pl" checked></label></div>
      <div class="group" id="pls"></div>`);
    const draw = () => {
      const all = alive(state.canciones).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
      const items = Search.rank(all, $("#pq", d).value, (c) => [[c.nombre, 1.2], [c.letra || "", 0.6]]).slice(0, 100);
      $("#pls", d).innerHTML = items.map((c) => `<button class="cell" data-id="${esc(c.id)}"><div class="t"><b>${esc(c.nombre)}</b></div>
        ${c.letra ? `<span class="tag lyr">Letra</span>` : ""}${c.tono ? `<span class="tag key">${esc(c.tono)}</span>` : ""}</button>`).join("")
        || `<div class="empty">Sin resultados</div>`;
    };
    $("#pq", d).oninput = draw;
    $("#pls", d).onclick = (e) => { const b = e.target.closest("[data-id]"); if (!b) return; onPick(songById(b.dataset.id), $("#pl", d).checked); d.close(); };
    draw();
  }

  // ---------- Letras desde internet (gratis y sin cuenta) ----------
  // LRCLIB (lrclib.net) trae la letra en la búsqueda; Lyrics.ovh sugiere canciones y la letra se pide
  // al tocarla. Genius no da letras por su API, por eso solo se abre su página para copiar.
  const Lyrics = {
    clean(t) {
      const junk = /^(paroles de la chanson.*|\d*\s*contributors?|you might also like|también te (podría|puede) gustar|translations?|\d*embed|see .* live|get tickets.*)$/i;
      return String(t || "").replace(/\r\n?/g, "\n").replace(/\d*Embed\s*$/i, "").split("\n")
        .map((l) => l.replace(/[ \t\u00a0]+$/g, "")).filter((l) => !junk.test(l.trim()))
        .join("\n").replace(/^.*\bLyrics\s*\n/i, "").replace(/\n{3,}/g, "\n\n").trim();
    },
    timed(p, ms) { return Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error("tardó demasiado")), ms))]); },
    /** LRCLIB: busca por título (y artista si lo diste) y por texto libre; la misma letra cantada por
     *  varios grupos se junta en un solo resultado, y van primero los títulos más parecidos. */
    async lrclib(title, artist) {
      const e = encodeURIComponent;
      const get = async (qs) => { const r = await fetch("https://lrclib.net/api/search?" + qs); if (!r.ok) throw new Error("LRCLIB " + r.status); return r.json(); };
      const lists = await Promise.allSettled([
        get("track_name=" + e(title) + (artist ? "&artist_name=" + e(artist) : "")),
        get("q=" + e([title, artist].filter(Boolean).join(" "))),
      ]);
      if (lists.every((x) => x.status === "rejected")) throw lists[0].reason;
      const groups = new Map(), seen = new Set();
      for (const x of lists.filter((l) => l.status === "fulfilled").flatMap((l) => l.value)) {
        if (seen.has(x.id) || !x.plainLyrics || x.instrumental) continue;
        seen.add(x.id);
        const letra = this.clean(x.plainLyrics), key = plain(letra).slice(0, 160);
        const g = groups.get(key);
        if (g) { if (!g.artistas.includes(x.artistName)) g.artistas.push(x.artistName); continue; }
        groups.set(key, { fuente: "LRCLIB", titulo: x.trackName, artistas: [x.artistName], letra });
      }
      const pa = plain(artist);
      return [...groups.values()].map((g) => {
        let sc = Search.score(title, [[g.titulo, 1]]) * 2 + Math.log2(1 + g.artistas.length);
        if (pa && g.artistas.some((a) => plain(a).includes(pa) || pa.includes(plain(a)))) sc += 6;
        return { ...g, sc };
      }).sort((a, b) => b.sc - a.sc).slice(0, 12);
    },
    async ovh(q) {
      const r = await fetch("https://api.lyrics.ovh/suggest/" + encodeURIComponent(q));
      if (!r.ok) throw new Error("Lyrics.ovh " + r.status);
      const seen = new Set();
      return ((await r.json()).data || []).filter((x) => {
        const k = (x.artist.name + "|" + x.title).toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true;
      }).slice(0, 8).map((x) => ({
        fuente: "Lyrics.ovh", titulo: x.title, artistas: [x.artist.name], letra: null,
        get: async () => {
          const g = await this.timed(fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(x.artist.name)}/${encodeURIComponent(x.title)}`), 20000);
          const j = g.ok ? await g.json() : {};
          if (!j.lyrics) throw new Error("Esta fuente no tiene la letra de esa canción");
          return this.clean(j.lyrics);
        },
      }));
    },
    async search(title, artist) {
      const res = await Promise.allSettled([this.timed(this.lrclib(title, artist), 15000),
        this.timed(this.ovh([title, artist].filter(Boolean).join(" ")), 15000)]);
      const items = [], errs = [], seen = new Set();
      res.forEach((r) => (r.status === "fulfilled" ? items.push(...r.value) : errs.push(r.reason)));
      return { errs, items: items.filter((x) => { const k = plain(x.artistas[0] + "|" + x.titulo); if (seen.has(k)) return false; seen.add(k); return true; }) };
    },
    /** Primeras dos líneas de la letra, para reconocer la canción sin abrirla. */
    snippet(t) { return String(t || "").split("\n").map((l) => l.trim()).filter((l) => l && !/^\[.*\]$/.test(l)).slice(0, 2).join(" / "); },
  };
  /** Busca la letra de una canción y deja elegir cuál usar; muestra la letra debajo del resultado tocado. */
  function lyricsSheet(nombre, onUse, actual = "") {
    const d = sheet("Buscar letra", `
      <div class="group">
        <label class="cell"><div class="t"><b>Canción</b></div><input type="text" id="lq" value="${esc(nombre)}" placeholder="Nombre de la canción"></label>
        <label class="cell"><div class="t"><b>Artista</b><span>Opcional, ayuda a encontrarla</span></div><input type="text" id="la" placeholder="ej. Los Ángeles Azules"></label>
      </div>
      <div class="row" style="margin-top:10px"><button class="btn fill" id="lgo">${ic("search")} Buscar</button></div>
      <p class="section-f" id="lst">Toca un resultado para ver la letra completa.</p>
      <div class="group" id="lres"></div>
      <p class="section-f">¿No aparece? <a id="lweb" target="_blank" rel="noopener">Búscala en Letras.com</a>, cópiala y toca <a href="#" id="lpst">Pegar letra</a>.</p>
      <div id="lman" hidden>
        <textarea class="editor" id="lpaste" style="min-height:22vh" placeholder="Mantén presionado aquí y toca Pegar"></textarea>
        <div class="row"><span class="spacer"></span><button class="btn fill sm" id="luse">Usar este texto</button></div>
      </div>`, { el: "#sheet2" });
    let items = [];
    const title = () => $("#lq", d).value.trim(), artist = () => $("#la", d).value.trim();
    const q = () => [title(), artist()].filter(Boolean).join(" ");
    const st = (t) => ($("#lst", d).textContent = t);
    const gen = () => ($("#lweb", d).href = "https://www.letras.com/?q=" + encodeURIComponent(q() || nombre));
    const use = (t) => {
      t = Lyrics.clean(t);
      if (t.length < 20) { toast("Eso no parece una letra: copia la letra completa"); return; }
      if (actual.trim() && !confirm("Esta canción ya tiene letra. ¿Cambiarla por la nueva?")) return;
      onUse(t); d.close();
    };
    $("#lpst", d).onclick = async (e) => {
      e.preventDefault();
      let t = "";
      try { t = await navigator.clipboard.readText(); } catch {}
      if (t && t.trim().length >= 20) return use(t);
      // si el aparato no deja leer lo copiado, se pega a mano en un recuadro
      $("#lman", d).hidden = false; $("#lpaste", d).focus();
      toast(t ? "Lo copiado es muy corto: copia la letra completa" : "Mantén presionado el recuadro y toca Pegar");
    };
    $("#luse", d).onclick = () => use($("#lpaste", d).value);
    const run = async () => {
      gen();
      if (!title()) return st("Escribe el nombre de la canción");
      if (!navigator.onLine) return st("Sin internet: conéctate para buscar letras.");
      st("Buscando…"); $("#lres", d).innerHTML = "";
      const r = await Lyrics.search(title(), artist());
      items = r.items;
      if (!items.length) return st(r.errs.length === 2 ? "No se pudo buscar (" + r.errs[0].message + "). Revisa el internet."
        : "No apareció. Prueba escribiendo también el artista.");
      st(items.length === 1 ? "Toca el resultado para ver la letra completa." : `${items.length} letras distintas. Toca una para verla completa.`);
      $("#lres", d).innerHTML = items.map((x, i) => {
        const more = x.artistas.length > 1 ? ` y ${x.artistas.length - 1} más` : "";
        const snip = x.letra ? Lyrics.snippet(x.letra) : "";
        return `<button class="cell lyr-hit" data-i="${i}"><div class="t"><b class="wrap">${esc(x.titulo)}</b>
          <span>${esc(x.artistas[0])}${more}</span>${snip ? `<span class="lyr-snip">${esc(snip)}…</span>` : ""}</div></button>`;
      }).join("");
    };
    $("#lq", d).oninput = $("#la", d).oninput = gen;
    $("#lq", d).onkeydown = $("#la", d).onkeydown = (e) => { if (e.key === "Enter") run(); };
    $("#lgo", d).onclick = run;
    $("#lres", d).onclick = async (e) => {
      const useB = e.target.closest("[data-use]");
      if (useB) { use(items[+useB.dataset.use].letra); return; }
      const b = e.target.closest("[data-i]"); if (!b) return;
      const open = b.nextElementSibling && b.nextElementSibling.classList.contains("lyr-prev");
      $$(".lyr-prev", d).forEach((x) => x.remove());
      if (open) return;
      const i = +b.dataset.i, x = items[i];
      b.insertAdjacentHTML("afterend", `<div class="lyr-prev"><div class="empty">Cargando letra…</div></div>`);
      const box = b.nextElementSibling;
      try { if (x.letra == null) x.letra = await x.get(); }
      catch (err) { box.innerHTML = `<div class="empty">${esc(err.message)}</div>`; return; }
      box.innerHTML = `<pre class="lyr-text">${esc(x.letra)}</pre>
        <div class="row"><span class="small muted">${esc(x.artistas.slice(0, 4).join(", "))}${x.artistas.length > 4 ? "…" : ""}</span><span class="spacer"></span><button class="btn fill sm" data-use="${i}">Usar esta letra</button></div>`;
    };
    gen();
    if (nombre.trim()) run();
  }

  // ---------- Canciones ----------
  const lib = { q: "", ritmo: "*", group: false, lyr: false };
  function viewBiblioteca(el) {
    setBar({ title: "Canciones", left: "back" });
    el.innerHTML = `
      <div class="large-title"><h1>Canciones<span class="sub" id="cnt"></span></h1>
        <button class="btn fill" id="add">${ic("plus")} Nueva</button></div>
      ${searchBox("q", "Buscar canción", lib.q)}
      <div class="pills" id="rits"></div>
      <div class="row" style="margin-top:8px">
        <div class="seg" id="seg"><button data-g="0">Lista</button><button data-g="1">Por ritmo</button></div>
        <span class="spacer"></span>
        <label class="row small muted">Solo con letra <input type="checkbox" class="switch" id="lyr" ${lib.lyr ? "checked" : ""}></label>
      </div>
      <datalist id="ritmosList">${state.ritmos.map((r) => `<option value="${esc(r)}">`).join("")}</datalist>
      <div id="out"></div>`;
    const drawPills = () => {
      const counts = {};
      alive(state.canciones).forEach((c) => { counts[c.ritmo || ""] = (counts[c.ritmo || ""] || 0) + 1; });
      const used = Object.keys(counts).filter(Boolean).sort((a, b) => a.localeCompare(b, "es"));
      const pill = (v, label, n) => `<button data-r="${esc(v)}" class="${lib.ritmo === v ? "on" : ""}">${esc(label)}<span class="n">${n}</span></button>`;
      $("#rits", el).innerHTML = pill("*", "Todas", alive(state.canciones).length) + pill("", "Sin ritmo", counts[""] || 0) + used.map((r) => pill(r, r, counts[r])).join("");
      $$("#seg button", el).forEach((b) => b.classList.toggle("on", (b.dataset.g === "1") === lib.group));
    };
    const row = (c) => `<div class="cell" data-id="${esc(c.id)}">
        <div class="t tap" data-open="${esc(c.id)}" style="cursor:pointer"><b class="wrap">${esc(c.nombre)}</b><span>${(c.notas || []).length} notas${c.letra ? " · con letra" : ""}</span></div>
        ${c.tono ? `<span class="tag key">${esc(c.tono)}</span>` : ""}
        <input class="ritmo-input" list="ritmosList" placeholder="Ritmo" value="${esc(c.ritmo)}" data-rit="${esc(c.id)}" aria-label="Ritmo de ${esc(c.nombre)}">
      </div>`;
    const draw = () => {
      const base = alive(state.canciones).filter((c) => (lib.ritmo === "*" || (c.ritmo || "") === lib.ritmo) && (!lib.lyr || c.letra))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
      // busca en nombre, ritmo, tono y letra (la letra pesa menos)
      const items = Search.rank(base, lib.q, (c) => [[c.nombre, 1.2], [`${c.ritmo || ""} ${c.tono || ""}`, 0.9], [c.letra || "", 0.6]]);
      $("#cnt", el).textContent = `${items.length} de ${alive(state.canciones).length}`;
      if (!items.length) { $("#out", el).innerHTML = `<div class="empty">No hay canciones con ese filtro.</div>`; return; }
      if (lib.group) {
        const g = {}; items.forEach((c) => (g[c.ritmo || "Sin ritmo"] ||= []).push(c));
        $("#out", el).innerHTML = Object.keys(g).sort((a, b) => (a === "Sin ritmo") - (b === "Sin ritmo") || a.localeCompare(b, "es"))
          .map((k) => `<div class="section-h">${esc(k)} · ${g[k].length}</div><div class="group" style="margin-top:0">${g[k].map(row).join("")}</div>`).join("");
      } else $("#out", el).innerHTML = `<div class="group">${items.map(row).join("")}</div>`;
    };
    $("#q", el).oninput = (e) => { lib.q = e.target.value; draw(); };
    $("#lyr", el).onchange = (e) => { lib.lyr = e.target.checked; draw(); };
    $("#seg", el).onclick = (e) => { const b = e.target.closest("[data-g]"); if (!b) return; lib.group = b.dataset.g === "1"; drawPills(); draw(); };
    $("#rits", el).onclick = (e) => { const b = e.target.closest("[data-r]"); if (!b) return; lib.ritmo = b.dataset.r; drawPills(); draw(); };
    $("#out", el).addEventListener("change", (e) => {
      const inp = e.target.closest("[data-rit]"); if (!inp) return;
      const c = songById(inp.dataset.rit); c.ritmo = inp.value.trim(); addRitmo(c.ritmo); touch(c); save();
      drawPills(); toast(`${c.nombre}: ${c.ritmo || "sin ritmo"}`);
    });
    $("#out", el).addEventListener("click", (e) => { const o = e.target.closest("[data-open]"); if (o) editSong(o.dataset.open, () => { drawPills(); draw(); }); });
    $("#add", el).onclick = () => {
      const c = touch({ id: "c-" + uid(), nombre: "", tono: "", ritmo: "", letra: "", notas: [] });
      editSong(c, () => { drawPills(); draw(); });
    };
    drawPills(); draw();
  }

  function editSong(idOrNew, after) {
    const isNew = typeof idOrNew === "object";
    const c = isNew ? idOrNew : songById(idOrNew);
    const d = sheet(isNew ? "Nueva canción" : "Canción", `
      <div class="group">
        <label class="cell"><div class="t"><b>Nombre</b></div><input type="text" id="sn" value="${esc(c.nombre)}" placeholder="Nombre"></label>
        <label class="cell"><div class="t"><b>Tono</b></div><input type="text" id="st" value="${esc(c.tono)}" placeholder="ej. LAB"></label>
        <label class="cell"><div class="t"><b>Ritmo</b></div><input type="text" id="sr" list="ritmosList2" value="${esc(c.ritmo)}" placeholder="Elegir"></label>
      </div>
      <datalist id="ritmosList2">${state.ritmos.map((r) => `<option value="${esc(r)}">`).join("")}</datalist>
      <div class="section-h">Letra</div>
      <div class="row" style="margin:0 0 8px"><button class="btn sm tint" id="sls">${ic("search")} Buscar letra en internet</button></div>
      <textarea class="editor" id="sl" style="min-height:34vh" placeholder="Pega aquí la letra o búscala en internet">${esc(c.letra)}</textarea>
      ${isNew ? "" : `<p class="section-f">Aparece en: ${esc((c.notas || []).join(", ") || "ninguna nota")}</p>
      <div class="row" style="margin-top:16px"><button class="btn tint" id="sp">${ic("play")} Ver en prompter</button><span class="spacer"></span>
        <button class="btn danger" id="sd">${ic("trash")} Borrar</button></div>`}`,
      { left: "Cancelar", right: "Guardar", onRight: () => {
        const nombre = $("#sn", d).value.trim(); if (!nombre) { toast("Escribe el nombre"); return false; }
        c.nombre = nombre; c.tono = $("#st", d).value.trim().toUpperCase(); c.ritmo = $("#sr", d).value.trim(); c.letra = $("#sl", d).value;
        addRitmo(c.ritmo); touch(c); if (isNew) state.canciones.push(c); save(); after && after(); toast("Guardado");
      } });
    $("#sls", d).onclick = () => lyricsSheet($("#sn", d).value.trim() || c.nombre, (t) => { $("#sl", d).value = t; toast("Letra lista: toca Guardar"); }, $("#sl", d).value);
    if (!isNew) {
      $("#sp", d).onclick = () => { d.close(); location.hash = "#/prompter/" + encodeURIComponent("song:" + c.id); };
      $("#sd", d).onclick = () => {
        if (!confirm(`¿Borrar "${c.nombre}" de tus canciones? Las notas no cambian.`)) return;
        c.del = true; touch(c); save(); d.close(); after && after();
      };
    }
  }

  // ---------- Armar tanda ----------
  // modo "orden": las canciones quedan en el orden que tú elijas.
  // modo "ritmo": se agrupan solas por ritmo (cumbias juntas, rancheras juntas…).
  // noLyr: canciones de la tanda que van sin letra aunque la tengan (cuando "Incluir letras" está prendido)
  let draft = { titulo: "", items: [], letras: true, noLyr: [], q: "", ritmo: "*", modo: "orden", juntas: false };
  const hasLyr = (c) => !!(c && c.letra && c.letra.trim());
  const withLyr = (c) => draft.letras && hasLyr(c) && !(draft.noLyr || []).includes(c.id);
  let tempText = null;
  const SIN_RITMO = "Sin ritmo";
  function groupsByRitmo(ids) {
    const g = new Map();
    ids.forEach((id) => { const c = songById(id); if (!c) return; const k = c.ritmo || SIN_RITMO; if (!g.has(k)) g.set(k, []); g.get(k).push(c); });
    return [...g.entries()].sort(([a], [b]) => (a === SIN_RITMO) - (b === SIN_RITMO) || a.localeCompare(b, "es"));
  }
  function tandaText() {
    const block = (c) => songBlock(c, withLyr(c));
    if (draft.modo !== "ritmo") return draft.items.map(songById).filter(Boolean).map(block).join("\n\n");
    return groupsByRitmo(draft.items).map(([ritmo, songs]) => {
      const head = "TANDA · " + ritmo.toUpperCase();
      if (!draft.juntas) return head + "\n\n" + songs.map(block).join("\n\n");
      // todas las del mismo ritmo en una línea, como en tus notas: -Eva María LAB/Azúcar DO
      const line = "-" + songs.map((c) => c.nombre + (c.tono ? " " + c.tono : "")).join("/");
      const lyr = songs.filter(withLyr).map((c) => c.letra.trim()).join("\n\nMÚSICA\n\n");
      return head + "\n\n" + line + (lyr ? "\n\n" + lyr : "");
    }).join("\n\n\n");
  }
  function viewTanda(el) {
    setBar({ title: "Armar tanda", left: "back" });
    el.innerHTML = `
      <div class="large-title"><h1>Armar tanda<span class="sub">Elige canciones de tu lista y guárdala como nota</span></h1></div>
      <div class="seg" id="modo" style="margin-bottom:14px"><button data-m="orden">En mi orden</button><button data-m="ritmo">Agrupada por ritmo</button></div>
      <div class="builder">
        <div>
          ${searchBox("q", "Buscar canción", draft.q)}
          <div class="pills" id="rits"></div>
          <div class="group scroll" id="src"></div>
        </div>
        <div>
          <div class="group">
            <label class="cell"><div class="t"><b>Nombre</b></div><input type="text" id="tit" placeholder="ej. Boda sábado" value="${esc(draft.titulo)}"></label>
            <label class="cell"><div class="t"><b>Incluir letras</b><span>Luego elige en la tanda cuáles sí llevan letra</span></div><input type="checkbox" class="switch" id="lt" ${draft.letras ? "checked" : ""}></label>
            <label class="cell" id="juntasRow"><div class="t"><b>Mismo ritmo en una línea</b><span>-Canción LAB/Canción DO, como en tus notas</span></div><input type="checkbox" class="switch" id="jt" ${draft.juntas ? "checked" : ""}></label>
          </div>
          <div class="section-h" id="setH">Tanda</div>
          <div id="set"></div>
          <div class="sticky-actions row">
            <button class="btn" id="clr">Vaciar</button><span class="spacer"></span>
            <button class="btn tint" id="prev">${ic("play")} Probar</button>
            <button class="btn fill" id="sv">Guardar</button>
          </div>
        </div>
      </div>`;
    const ritmos = [...new Set(alive(state.canciones).map((c) => c.ritmo).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
    const drawTop = () => {
      $$("#modo button", el).forEach((b) => b.classList.toggle("on", b.dataset.m === draft.modo));
      $("#juntasRow", el).hidden = draft.modo !== "ritmo";
      $("#rits", el).innerHTML = ["*", ...ritmos].map((r) => `<button data-r="${esc(r)}" class="${draft.ritmo === r ? "on" : ""}">${r === "*" ? "Todas" : esc(r)}</button>`).join("");
    };
    const drawSrc = () => {
      const base = alive(state.canciones).filter((c) => draft.ritmo === "*" || c.ritmo === draft.ritmo).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
      const items = Search.rank(base, draft.q, (c) => [[c.nombre, 1.2], [`${c.ritmo || ""} ${c.tono || ""}`, 0.9], [c.letra || "", 0.6]]);
      const qn = plain(draft.q);
      const nueva = qn && !alive(state.canciones).some((c) => plain(c.nombre) === qn)
        ? `<button class="cell new-song" data-new><span class="add-dot">${ic("plus")}</span><div class="t"><b>Agregar «${esc(draft.q.trim())}»</b><span>Canción nueva: se agrega a la tanda y puedes buscar su letra</span></div></button>` : "";
      $("#src", el).innerHTML = nueva + items.map((c) => {
        const on = draft.items.includes(c.id);
        return `<button class="cell" data-id="${esc(c.id)}" aria-pressed="${on}">
          <div class="t"><b>${esc(c.nombre)}</b><span>${esc(c.ritmo || SIN_RITMO)}${c.letra ? " · con letra" : ""}</span></div>
          ${c.tono ? `<span class="tag key">${esc(c.tono)}</span>` : ""}<span class="add-dot ${on ? "on" : ""}">${ic(on ? "check" : "plus")}</span></button>`;
      }).join("") || (nueva ? "" : `<div class="empty">Nada que mostrar.</div>`);
    };
    const row = (c, first, last, n) => {
      const has = hasLyr(c), on = withLyr(c);
      const sub = !has ? "Sin letra guardada" : !draft.letras ? "Tiene letra" : on ? "Con letra en esta tanda" : "Va sin letra en esta tanda";
      return `<div class="cell" data-id="${esc(c.id)}"><span class="num">${n}</span>
        <div class="t tap" data-ed style="cursor:pointer"><b>${esc(c.nombre)}</b><span>${sub}</span></div>
        <div class="acts">${c.tono ? `<span class="tag key">${esc(c.tono)}</span>` : ""}
        ${has && draft.letras ? `<button class="btn sm lyr-tg ${on ? "on" : ""}" data-lt aria-pressed="${on}" aria-label="Incluir la letra de ${esc(c.nombre)}">${on ? "✓ " : ""}Letra</button>` : ""}
        <button class="btn sm icon" data-ls aria-label="Buscar letra de ${esc(c.nombre)}" title="Buscar letra">${ic("search")}</button>
        <button class="btn sm icon" data-mv="-1" aria-label="Subir" ${first ? "disabled" : ""}>${ic("up")}</button>
        <button class="btn sm icon" data-mv="1" aria-label="Bajar" ${last ? "disabled" : ""}>${ic("down")}</button>
        <button class="btn sm icon danger" data-rm aria-label="Quitar">${ic("close")}</button></div></div>`;
    };
    const drawSet = () => {
      $("#setH", el).textContent = `Tanda · ${draft.items.length} canciones`;
      const conLetra = draft.items.map(songById).filter(hasLyr).length;
      const bulk = draft.letras && conLetra ? `<div class="row small" style="margin:0 4px 8px"><span class="muted">${draft.items.map(songById).filter(withLyr).length} de ${conLetra} con letra</span><span class="spacer"></span>
        <button class="btn sm plain" data-all="1">Todas</button><button class="btn sm plain" data-all="0">Ninguna</button></div>` : "";
      if (!draft.items.length) { $("#set", el).innerHTML = `<div class="group" style="margin-top:0"><div class="empty">Toca canciones de la lista para agregarlas.</div></div>`; return; }
      if (draft.modo === "ritmo") {
        let n = 0;
        $("#set", el).innerHTML = bulk + groupsByRitmo(draft.items).map(([ritmo, songs]) =>
          `<div class="section-h">${esc(ritmo)} · ${songs.length}</div><div class="group" style="margin-top:0">${
            songs.map((c, i) => row(c, i === 0, i === songs.length - 1, ++n)).join("")}</div>`).join("");
      } else {
        $("#set", el).innerHTML = bulk + `<div class="group" style="margin-top:0">${draft.items.map(songById).filter(Boolean)
          .map((c, i, arr) => row(c, i === 0, i === arr.length - 1, i + 1)).join("")}</div>`;
      }
    };
    const redraw = () => { drawTop(); drawSrc(); drawSet(); };
    $("#modo", el).onclick = (e) => { const b = e.target.closest("[data-m]"); if (b) { draft.modo = b.dataset.m; redraw(); } };
    $("#q", el).oninput = (e) => { draft.q = e.target.value; drawSrc(); };
    $("#rits", el).onclick = (e) => { const b = e.target.closest("[data-r]"); if (!b) return; draft.ritmo = b.dataset.r; drawTop(); drawSrc(); };
    // guarda la letra encontrada en la canción (queda para siempre en tu lista de canciones)
    const findLyrics = (c) => lyricsSheet(c.nombre, (t) => {
      c.letra = t; touch(c); save();
      draft.noLyr = (draft.noLyr || []).filter((x) => x !== c.id);
      if (!draft.letras) { draft.letras = true; $("#lt", el).checked = true; }
      toast("Letra guardada: " + c.nombre); drawSrc(); drawSet();
    }, c.letra || "");
    $("#src", el).onclick = (e) => {
      if (e.target.closest("[data-new]")) {
        const c = touch({ id: "c-" + uid(), nombre: draft.q.trim(), tono: "", ritmo: draft.ritmo !== "*" ? draft.ritmo : "", letra: "", notas: [] });
        state.canciones.push(c); save();
        draft.items.push(c.id); draft.q = ""; $("#q", el).value = "";
        drawSrc(); drawSet(); toast("Agregada: " + c.nombre);
        findLyrics(c);
        return;
      }
      const b = e.target.closest("[data-id]"); if (!b) return;
      const id = b.dataset.id, c = songById(id), at = draft.items.indexOf(id);
      if (at >= 0) { draft.items.splice(at, 1); toast("Quitada: " + c.nombre); }
      else { draft.items.push(id); toast("Agregada: " + c.nombre + (draft.modo === "ritmo" ? ` → ${c.ritmo || SIN_RITMO}` : "")); }
      drawSrc(); drawSet();
    };
    $("#set", el).onclick = (e) => {
      const all = e.target.closest("[data-all]");
      if (all) { draft.noLyr = all.dataset.all === "1" ? [] : draft.items.slice(); drawSet(); return; }
      const r = e.target.closest("[data-id]"); if (!r) return;
      const id = r.dataset.id, i = draft.items.indexOf(id);
      if (e.target.closest("[data-rm]")) { draft.items.splice(i, 1); drawSrc(); drawSet(); return; }
      if (e.target.closest("[data-lt]")) {
        const nl = draft.noLyr || (draft.noLyr = []), k = nl.indexOf(id);
        k >= 0 ? nl.splice(k, 1) : nl.push(id); drawSet(); return;
      }
      if (e.target.closest("[data-ls]")) { findLyrics(songById(id)); return; }
      if (e.target.closest("[data-ed]")) { editSong(id, () => { drawSrc(); drawSet(); }); return; }
      const mv = e.target.closest("[data-mv]"); if (!mv) return;
      const dir = +mv.dataset.mv;
      // en modo ritmo se mueve dentro de su grupo (salta las de otros ritmos)
      const same = (j) => draft.modo !== "ritmo" || ((songById(draft.items[j]) || {}).ritmo || "") === (songById(id).ritmo || "");
      let j = i + dir; while (j >= 0 && j < draft.items.length && !same(j)) j += dir;
      if (j >= 0 && j < draft.items.length) [draft.items[i], draft.items[j]] = [draft.items[j], draft.items[i]];
      drawSet();
    };
    $("#tit", el).oninput = (e) => (draft.titulo = e.target.value);
    $("#lt", el).onchange = (e) => { draft.letras = e.target.checked; drawSet(); };
    $("#jt", el).onchange = (e) => (draft.juntas = e.target.checked);
    $("#clr", el).onclick = () => { if (draft.items.length && confirm("¿Vaciar la tanda?")) { draft.items = []; drawSrc(); drawSet(); } };
    $("#prev", el).onclick = () => { if (!draft.items.length) return toast("La tanda está vacía"); tempText = { titulo: draft.titulo || "Tanda (prueba)", texto: tandaText() }; location.hash = "#/prompter/tmp"; };
    $("#sv", el).onclick = () => {
      if (!draft.items.length) return toast("La tanda está vacía");
      const n = touch({ id: "n" + uid(), titulo: draft.titulo.trim() || "Tanda " + fmtDate(today()), texto: tandaText(), modificado: today(), orden: topOrder() });
      draft.items.forEach((id) => { const c = songById(id); if (c && !(c.notas || []).includes(n.titulo)) { c.notas = [...(c.notas || []), n.titulo]; touch(c); } });
      state.notas.push(n); save();
      draft = { titulo: "", items: [], letras: draft.letras, noLyr: [], q: "", ritmo: "*", modo: draft.modo, juntas: draft.juntas };
      toast("Nota guardada"); location.hash = "#/nota/" + n.id;
    };
    redraw();
  }

  // ---------- Control (en el teléfono) ----------
  // 1) escanea el código del iPad  2) muestra su propio código para que el iPad lo lea
  // 3) ya conectados: panel para deslizar, flechas en T, velocidad y letra.
  let ctlState = null;
  function viewControl(el) {
    setBar({ title: "Control", left: "back", back: "#/notas" });
    const draw = () => {
      if (Link.ok() && Link.role === "control") return drawPad();
      if (Link.role === "control" && Link.pc && Link.quick) return drawWait();
      if (Link.role === "control" && Link.pc && Link.answer) return drawAnswer();
      drawScan();
    };
    Link.onChange = () => { if (location.hash.startsWith("#/control")) draw(); };
    Link.onMsg = (m) => {
      if (m.t === "estado") { ctlState = m; if (location.hash.startsWith("#/control")) updatePad(); }
      else if (m.kind === "fuente" && (m.t === "bg-ok" || m.t === "bg-error")) {
        toast(m.t === "bg-ok" ? "Fuente puesta en el iPad ✓" : String(m.msg || "No se pudo usar la fuente"));
        const pr = $("#cFontProg"); if (pr) pr.textContent = m.t === "bg-ok" ? "Listo, ya está en el iPad" : "No se pudo";
      }
      else if (m.t === "bg-ok" || m.t === "bg-error") {
        toast(m.t === "bg-ok" ? "Fondo enviado al iPad ✓" : String(m.msg || "No se pudo enviar el fondo"));
        const pr = $("#cBgProg"); if (pr) pr.textContent = m.t === "bg-ok" ? "Listo, ya está en el iPad" : "No se pudo enviar";
      }
      else if (m.t === "msg-ok") toast("El mensaje ya está en la pantalla del iPad ✓");
    };

    function drawScan() {
      el.innerHTML = `
        <div class="ctl">
          <h2 class="ctl-h">Escanea el código del iPad</h2>
          <p class="section-f">En el iPad: ☰ → <b>Conectar control</b>. Los dos deben estar en la misma red WiFi o en el hotspot de este teléfono (no necesita datos).</p>
          <div class="cam big"><video id="cam" playsinline muted></video><span class="cam-msg" id="camMsg">Abriendo cámara…</span></div>
          <details class="pair-manual"><summary>¿No funciona la cámara?</summary>
            <textarea class="field-input code" id="theirCode" placeholder="Pega aquí el código del iPad"></textarea>
            <div class="row"><button class="btn sm fill" id="useCode">Continuar</button></div>
          </details>
        </div>`;
      const certP = PhoneCert.get(); // la identidad fija de este teléfono (para que el iPad lo recuerde)
      const go = async (code) => {
        try {
          const desc = await unpackSdp(code);
          const msg = (t) => { const m = $("#camMsg", el); if (m) m.textContent = t; };
          if (desc.type !== "offer") { msg("Ese es el código del teléfono. Escanea el del iPad."); return false; }
          const cert = await certP, mark = desc.extra && desc.extra[0] === QUICK ? desc.extra.slice(1, 3) : null;
          // el iPad espera a un teléfono conocido: ¿soy yo?
          const quick = !!mark;
          if (quick && !(cert && fpHint(PhoneCert.fp(cert)).every((v, k) => v === mark[k]))) {
            msg("Este iPad recuerda otro teléfono. En el iPad toca «Usar otro teléfono».");
            return false;
          }
          if (navigator.vibrate) navigator.vibrate(30);
          msg(quick ? "¡Leído! Conectando…" : "¡Leído! Preparando respuesta…");
          const pc = Link.newPC("control", cert ? [cert] : null);
          pc.ondatachannel = (e) => Link.bind(e.channel);
          await pc.setRemoteDescription(desc);
          let ans = await pc.createAnswer();
          if (quick) {
            const ice = derivedIce(desc.sdp);
            ans = { type: "answer", sdp: ans.sdp.replace(/^a=ice-ufrag:.*$/m, "a=ice-ufrag:" + ice.ufrag).replace(/^a=ice-pwd:.*$/m, "a=ice-pwd:" + ice.pwd) };
          }
          await pc.setLocalDescription(ans);
          if (quick) { Link.quick = true; if (!Link.ok()) draw(); }
          // la cámara sigue prendida hasta aquí: así el teléfono comparte su dirección real en la red
          await gathered(pc);
          Cam.stop();
          if (pc !== Link.pc || quick) return true;
          Link.answer = await packSdp(pc.localDescription);
          draw();
          return true;
        } catch (e) { const m = $("#camMsg", el); if (m) m.textContent = "No se pudo leer: " + e.message; return false; }
      };
      $("#useCode", el).onclick = () => go($("#theirCode", el).value);
      Cam.start($("#cam", el), "environment", go)
        .then(() => { const m = $("#camMsg", el); if (m) m.textContent = "Apunta al código del iPad"; })
        .catch((e) => { const m = $("#camMsg", el); if (m) m.textContent = e.message || "No se pudo abrir la cámara"; });
    }

    /** iPad que ya conoce este teléfono: no hay que mostrar nada, solo esperar la conexión. */
    function drawWait() {
      el.innerHTML = `
        <div class="ctl">
          <h2 class="ctl-h">Conectando con el iPad…</h2>
          <p class="pair-state" id="wst">El iPad ya conoce este teléfono: no hace falta mostrarle ningún código.</p>
          <div class="row" style="justify-content:center"><button class="btn sm plain" id="again">Empezar de nuevo</button></div>
        </div>`;
      const pc = Link.pc;
      $("#again", el).onclick = () => { Link.reset(); Link.quick = false; draw(); };
      setTimeout(() => {
        if (Link.pc !== pc || Link.ok() || !location.hash.startsWith("#/control")) return;
        const w = $("#wst", el);
        if (w) w.innerHTML = "No se pudo conectar. Revisa que los dos estén en la misma red (WiFi o el hotspot de este teléfono) y toca <b>Empezar de nuevo</b>.";
      }, 12000);
    }

    async function drawAnswer() {
      el.innerHTML = `
        <div class="ctl">
          <h2 class="ctl-h">Muestra este código a la cámara del iPad</h2>
          <div class="qr big" id="qr"></div>
          <p class="pair-state">Esperando al iPad… <button class="btn sm plain" id="again">Empezar de nuevo</button></p>
          <details class="pair-manual"><summary>¿No funciona la cámara del iPad?</summary>
            <textarea class="field-input code" readonly id="myCode"></textarea>
            <div class="row"><button class="btn sm tint" id="cp">Copiar</button></div>
          </details>
        </div>`;
      $("#qr", el).innerHTML = await qrSvg(Link.answer);
      $("#myCode", el).value = Link.answer;
      $("#cp", el).onclick = async () => { try { await navigator.clipboard.writeText(Link.answer); toast("Copiado"); } catch { $("#myCode", el).select(); } };
      $("#again", el).onclick = () => { Link.answer = null; Link.reset(); draw(); };
    }

    function drawPad() {
      Link.answer = null; Link.quick = false;
      el.innerHTML = `
        <div class="ctl pad">
          <div class="ctl-status" id="cst"></div>
          <div class="group" style="margin:0">
            <label class="cell"><div class="t"><b>Abrir guion</b></div><select id="nota"><option value="">Elegir…</option></select></label>
          </div>
          <button class="rbtn main play" data-cmd="play" id="cPlay">${ic("play")} Iniciar / Pausar</button>
          <div class="tpad" id="tpad" aria-label="Panel para deslizar el texto">
            <div class="tpad-lines" id="tpadLines"></div><span class="tpad-hint">Desliza aquí para mover el texto</span>
          </div>
          <div class="tkeys">
            <button class="rbtn tk up" data-line="-1" aria-label="Subir una línea">▲<small>línea</small></button>
            <button class="rbtn tk left" data-cmd="prev" aria-label="Canción anterior">◀<small>canción</small></button>
            <button class="rbtn tk down" data-line="1" aria-label="Bajar una línea">▼<small>línea</small></button>
            <button class="rbtn tk right" data-cmd="next" aria-label="Canción siguiente">▶<small>canción</small></button>
          </div>
          <div class="r2"><button class="rbtn" data-cmd="slower">− Velocidad</button><button class="rbtn" data-cmd="faster">+ Velocidad</button></div>
          <div class="group" style="margin:0"><div class="cell slider-cell"><div class="top"><b>Velocidad</b><span id="cv-speed"></span></div>
            <input type="range" min="0.5" max="30" step="0.5" id="cSpeed" aria-label="Velocidad"></div></div>
          <div class="r2"><button class="rbtn" data-cmd="smaller">A − Letra</button><button class="rbtn" data-cmd="bigger">A + Letra</button></div>
          <div class="r2"><button class="rbtn" data-cmd="top">⤒ Inicio</button><button class="rbtn" data-cmd="exit">✕ Cerrar guion</button></div>
          <div class="msg-card">
            <div class="msg-h"><b>MENSAJE</b><span class="spacer"></span>
              <label class="msg-att" aria-label="Agregar foto o video">${ic("clip")}<input type="file" id="cMsgFile" accept="image/*,video/*" hidden></label>
              <button class="msg-send" id="cMsgSend" aria-label="Enviar mensaje a la pantalla">${ic("mail")}</button></div>
            <textarea id="cMsg" maxlength="300" rows="2" placeholder="Escribe un mensaje para que salga en la pantalla del iPad"></textarea>
            <div class="msg-chip" id="cMsgChip" hidden><span id="cMsgChipT"></span><button id="cMsgChipX" aria-label="Quitar archivo">✕</button></div>
          </div>
          <details class="ctl-more" id="cMore"><summary>Pantalla y fondo del iPad</summary>
            <div class="group" style="margin:8px 0 0">
              <div class="cell slider-cell"><div class="top"><b>Márgenes</b><span id="cv-margin"></span></div><input type="range" min="0" max="25" step="1" data-set="margin" aria-label="Márgenes"></div>
              <label class="cell"><div class="t"><b>Modo espejo</b></div><input type="checkbox" class="switch" data-set="mirror"></label>
              <label class="cell"><div class="t"><b>Marcador de línea</b></div><input type="checkbox" class="switch" data-set="guide"></label>
              <label class="cell"><div class="t"><b>Guion en bucle</b></div><input type="checkbox" class="switch" data-set="loop"></label>
              <label class="cell"><div class="t"><b>Color de letra</b></div><input type="color" data-set="fg" aria-label="Color de letra"></label>
              <label class="cell"><div class="t"><b>Color de fondo</b></div><input type="color" data-set="bg" aria-label="Color de fondo"></label>
              <label class="cell"><div class="t"><b>Tipografía</b><span id="cFontN"></span></div><select id="cFont" aria-label="Tipografía">${fontOptions()}</select></label>
              <div class="cell"><div class="t"><b>Fuente propia</b><span id="cFontProg">Un archivo .ttf u .otf (por ejemplo de DaFont)</span></div>
                <label class="btn sm tint">Elegir<input type="file" id="cFontFile" accept=".ttf,.otf,.woff,.woff2,font/*" hidden></label></div>
              <label class="cell"><div class="t"><b>Efecto de letra</b></div><select data-set="efecto" aria-label="Efecto de letra">${fxOptions()}</select></label>
            </div>
            <div class="group" style="margin:12px 0 0">
              <div class="cell"><div class="t"><b id="cBgName">Sin foto ni video de fondo</b><span id="cBgProg">Elige uno aquí: se manda al iPad y queda guardado ahí</span></div>
                <label class="btn sm tint">Elegir<input type="file" id="cBgFile" accept="image/*,video/*" hidden></label>
                <button class="btn sm plain danger" id="cBgDel" hidden>Quitar</button></div>
              <div class="cell slider-cell" id="cDimRow" hidden><div class="top"><b>Oscurecer el fondo</b><span id="cv-dim"></span></div><input type="range" min="0" max="90" step="5" data-set="dim" aria-label="Oscurecer el fondo"></div>
            </div>
          </details>
          <button class="btn plain danger" id="cut" style="margin:6px auto 0">Desconectar</button>
        </div>`;
      const send = (cmd, extra) => {
        if (!Link.send({ t: "cmd", cmd, ...extra })) return toast("Sin conexión con el iPad");
        if (navigator.vibrate && !/^(drag|speed):/.test(cmd)) navigator.vibrate(12);
      };
      $$("[data-cmd]", el).forEach((b) => (b.onclick = () => send(b.dataset.cmd)));
      $("#nota", el).onchange = (e) => { if (e.target.value) send("open", { nota: e.target.value }); };
      $("#cut", el).onclick = () => { Link.reset(); Link.role = null; draw(); };
      guardBack();
      // ajustes del iPad desde el teléfono (los deslizadores mandan como máximo ~10 cambios por segundo)
      const last = {}, later = {};
      $$("[data-set]", el).forEach((inp) => {
        const k = inp.dataset.set;
        const val = () => (inp.type === "checkbox" ? inp.checked : inp.type === "range" ? +inp.value : inp.value);
        const go = () => { last[k] = Date.now(); if (!Link.send({ t: "set", k, v: val() })) toast("Sin conexión con el iPad"); };
        inp.addEventListener(inp.type === "checkbox" ? "change" : "input", () => {
          inp.dataset.touched = Date.now();
          const o = $("#cv-" + k, el); if (o) o.textContent = inp.value + (k === "dim" ? " %" : "");
          clearTimeout(later[k]);
          if (Date.now() - (last[k] || 0) > 100) go(); else later[k] = setTimeout(go, 120);
        });
      });
      $("#cBgFile", el).onchange = async (e) => {
        const f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return;
        const pr = $("#cBgProg", el);
        try {
          await sendBgFile(f, (x) => { if (pr) pr.textContent = `Enviando al iPad… ${Math.round(x * 100)} %`; });
          if (pr) pr.textContent = "Guardando en el iPad…";
        } catch (err) { toast(err.message); if (pr) pr.textContent = "No se pudo enviar"; }
      };
      $("#cBgDel", el).onclick = () => { if (!Link.send({ t: "bg-clear" })) toast("Sin conexión con el iPad"); };
      // tipografía: el teléfono baja la fuente de Google Fonts y se la manda al iPad (así el iPad no necesita internet)
      const cf = $("#cFont", el), cfp = $("#cFontProg", el);
      const sendFont = async (file, extra) => {
        try { await sendBgFile(file, (x) => (cfp.textContent = `Enviando fuente… ${Math.round(x * 100)} %`), { kind: "fuente", ...extra }); }
        catch (err) { toast(err.message); cfp.textContent = "No se pudo enviar"; }
      };
      cf.onchange = async () => {
        let v = cf.value; cf.dataset.touched = Date.now();
        if (v === "g:?") { const n = askFontName(); if (!n) { updatePad(); return; } v = "g:" + n; }
        if (!v.startsWith("g:")) { if (!Link.send({ t: "set", k: "fuente", v: v === "file" ? "web" : v })) toast("Sin conexión con el iPad"); return; }
        const fam = v.slice(2); cfp.textContent = "Bajando " + fam + "…";
        let file = null; try { file = await Fuente.googleFile(fam); } catch {}
        if (file) return sendFont(file, { fname: fam, src: "google" });
        cfp.textContent = "Este teléfono no pudo bajarla: se la pido al iPad";
        Link.send({ t: "set", k: "fuente-g", v: fam });
      };
      $("#cFontFile", el).onchange = (e) => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (f) sendFont(f, {}); };
      // velocidad con la barra (como máximo ~10 cambios por segundo)
      const sp = $("#cSpeed", el); let spLast = 0, spT = 0;
      const spGo = () => { spLast = Date.now(); send("speed:" + sp.value); };
      sp.addEventListener("input", () => {
        sp.dataset.touched = Date.now(); $("#cv-speed", el).textContent = fmtSpeed(+sp.value);
        clearTimeout(spT); if (Date.now() - spLast > 100) spGo(); else spT = setTimeout(spGo, 120);
      });
      // MENSAJE: sale en el iPad con un sobre y el texto corriendo de lado a lado
      let msgFile = null, msgBusy = false;
      const chip = (f) => {
        msgFile = f; $("#cMsgChip", el).hidden = !f;
        if (f) $("#cMsgChipT", el).textContent = (/^video\//.test(f.type) ? "🎬 " : "🖼 ") + f.name;
      };
      $("#cMsgFile", el).onchange = (e) => {
        const f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return;
        if (!/^(image|video)\//.test(f.type)) return toast("Elige una foto, un GIF o un video");
        if (f.size > BgRecv.MAX) return toast("Es muy grande: máximo 150 MB");
        chip(f);
      };
      $("#cMsgChipX", el).onclick = () => chip(null);
      $("#cMsgSend", el).onclick = async () => {
        const ta = $("#cMsg", el), text = ta.value.trim().slice(0, 300), b = $("#cMsgSend", el);
        if (msgBusy) return;
        if (!text && !msgFile) { ta.focus(); return toast("Escribe el mensaje o agrega una foto o video"); }
        if (msgFile) {
          msgBusy = true; const f = msgFile, t = $("#cMsgChipT", el);
          try { await sendBgFile(f, (x) => (t.textContent = `Enviando… ${Math.round(x * 100)} %`), { kind: "msg", text }); }
          catch (err) { msgBusy = false; t.textContent = f.name; return toast(err.message); }
          msgBusy = false; chip(null);
        } else if (!Link.send({ t: "msg", text })) return toast("Sin conexión con el iPad");
        b.classList.remove("sent"); void b.offsetWidth; b.classList.add("sent");
        if (navigator.vibrate) navigator.vibrate(20);
        ta.value = ""; toast("Mensaje enviado ✉");
      };
      // ▲ ▼: una línea por toque; mantenido, sigue línea por línea
      $$("[data-line]", el).forEach((b) => {
        let t1 = 0, t2 = 0;
        const stop = () => { clearTimeout(t1); clearInterval(t2); b.classList.remove("held"); };
        b.addEventListener("pointerdown", (e) => {
          e.preventDefault(); stop(); b.classList.add("held");
          const go = () => send("line:" + b.dataset.line); go();
          t1 = setTimeout(() => (t2 = setInterval(go, 170)), 420);
        });
        ["pointerup", "pointercancel", "pointerleave"].forEach((ev) => b.addEventListener(ev, stop));
        b.addEventListener("contextmenu", (e) => e.preventDefault());
      });
      // panel: deslizar hacia arriba = el texto avanza; 30 px de dedo = 1 línea
      const pad = $("#tpad", el), stripes = $("#tpadLines", el);
      let lastY = null, pend = 0, off = 0, flushT = 0;
      const flush = () => { flushT = 0; if (Math.abs(pend) < 0.05) return; const n = Math.round(pend * 100) / 100; pend -= n; send("drag:" + n); };
      pad.addEventListener("pointerdown", (e) => { pad.setPointerCapture(e.pointerId); lastY = e.clientY; pad.classList.add("on"); });
      pad.addEventListener("pointermove", (e) => {
        if (lastY == null) return;
        const dy = e.clientY - lastY; lastY = e.clientY;
        pend += -dy / 30; off = (off + dy) % 30; stripes.style.setProperty("--off", off + "px");
        if (!flushT) flushT = setTimeout(flush, 50);
      });
      const end = () => { lastY = null; pad.classList.remove("on"); if (!flushT) flushT = setTimeout(flush, 0); };
      pad.addEventListener("pointerup", end); pad.addEventListener("pointercancel", end);
      updatePad();
    }
    draw();
  }
  function updatePad() {
    const cst = $("#cst"), sel = $("#nota"); if (!cst || !sel) return;
    const s = ctlState;
    cst.innerHTML = !s ? `<span class="sync-dot ok">Conectado</span>` :
      `<span class="sync-dot ok">Conectado</span> · ${s.abierto ? `${s.playing ? "▶" : "❚❚"} <b>${esc(s.abierto)}</b> · vel ${esc(fmtSpeed(s.speed))}` : "Elige un guion"}`;
    const want = (s && s.notas) || [];
    if (sel.options.length - 1 !== want.length || sel.dataset.sig !== String(want.length) + (want[0] || [""])[0]) {
      sel.innerHTML = `<option value="">Elegir…</option>` + want.map(([id, t]) => `<option value="${esc(id)}">${esc(t)}</option>`).join("");
      sel.dataset.sig = String(want.length) + (want[0] || [""])[0];
    }
    if (s) sel.value = s.nota || "";
    const cf = $("#cFont");
    if (cf && s && s.fuente && document.activeElement !== cf && Date.now() - (+cf.dataset.touched || 0) > 1500) {
      if (![...cf.options].some((o) => o.value === s.fuente)) cf.insertAdjacentHTML("beforeend", `<option value="${esc(s.fuente)}">${esc(s.fuenteN || s.fuente.slice(2))}</option>`);
      cf.value = s.fuente; $("#cFontN").textContent = s.fuente === "file" ? s.fuenteN || "" : "";
    }
    const csp = $("#cSpeed");
    if (csp && s && s.speed != null && document.activeElement !== csp && Date.now() - (+csp.dataset.touched || 0) > 1500) {
      csp.value = s.speed; $("#cv-speed").textContent = fmtSpeed(s.speed);
    }
    const pb = $("#cPlay"); if (pb && s) pb.innerHTML = `${ic(s.playing ? "pause" : "play")} ${s.playing ? "Pausar" : "Iniciar"}`;
    // ajustes de pantalla tal como están en el iPad (sin pisar lo que estás moviendo en ese momento)
    if (s && s.aj) $$("[data-set]").forEach((inp) => {
      const k = inp.dataset.set, v = k === "dim" ? s.dim : s.aj[k];
      if (v == null || document.activeElement === inp || Date.now() - (+inp.dataset.touched || 0) < 1500) return;
      if (inp.type === "checkbox") inp.checked = !!v; else inp.value = v;
      const o = $("#cv-" + k); if (o) o.textContent = v + (k === "dim" ? " %" : "");
    });
    const bn = $("#cBgName");
    if (bn && s) { bn.textContent = s.fondo || "Sin foto ni video de fondo"; $("#cBgDel").hidden = !s.fondo; $("#cDimRow").hidden = !s.fondo; }
  }

  // ---------- Ajustes ----------
  function viewAjustes(el) {
    setBar({ title: "Más ajustes", left: "back" });
    const a = state.ajustes;
    const slider = (k, label, min, max, step, unit) => `<div class="cell slider-cell">
        <div class="top"><b>${label}</b><span id="v-${k}">${a[k]}${unit}</span></div>
        <input type="range" min="${min}" max="${max}" step="${step}" value="${a[k]}" data-k="${k}" data-u="${unit}" aria-label="${label}"></div>`;
    const sw = (k, label, sub = "") => `<label class="cell"><div class="t"><b>${label}</b>${sub ? `<span>${sub}</span>` : ""}</div><input type="checkbox" class="switch" data-c="${k}" ${a[k] ? "checked" : ""}></label>`;
    const dbx = Dropbox.available()
      ? (Dropbox.connected()
        ? `<div class="cell"><span class="lead">${ic("cloud")}</span><div class="t"><b>Dropbox conectado</b><span>Se sincroniza solo cuando hay internet</span></div><button class="btn sm" id="dbxOff">Desconectar</button></div>`
        : `<button class="cell" id="dbxOn"><span class="lead">${ic("cloud")}</span><div class="t"><b>Conectar Dropbox</b><span>Sincroniza Android, iPad y PC por internet</span></div>${ic("chev", "chev")}</button>`)
      : `<div class="cell"><span class="lead">${ic("cloud")}</span><div class="t"><b>Dropbox</b><span>${CFG.dropboxAppKey ? "Abre la app desde su dirección https para usarlo" : "Falta configurar la clave en config.js (ver README)"}</span></div></div>`;
    el.innerHTML = `
      <div class="large-title"><h1>Ajustes</h1></div>

      <div class="section-h">Sincronizar entre dispositivos</div>
      <div class="group">
        <div class="cell"><span class="lead">${ic("wifi")}</span><div class="t"><b>WiFi local (sin internet)</b><span id="lanInfo">Buscando la PC…</span></div></div>
        ${dbx}
        <button class="cell" id="send"><span class="lead">${ic("share")}</span><div class="t"><b>Enviar a otro dispositivo</b><span>WhatsApp, Telegram, correo, Drive…</span></div>${ic("chev", "chev")}</button>
        <label class="cell tap"><span class="lead">${ic("receive")}</span><div class="t"><b>Recibir archivo</b><span>Combina lo recibido con lo que ya tienes</span></div>${ic("chev", "chev")}
          <input type="file" id="recv" accept=".json,application/json" hidden></label>
        <button class="cell" id="syncNow"><span class="lead">${ic("sync")}</span><div class="t"><b>Sincronizar ahora</b></div></button>
      </div>
      <p class="section-f">Nada se reemplaza a ciegas: al sincronizar se queda el cambio más reciente de cada nota y canción.</p>

      <div class="section-h">Prompter</div>
      <div class="group">
        ${slider("font", "Tamaño de letra", 24, 140, 2, " px")}
        ${slider("speed", "Velocidad inicial", 0.5, 30, 0.5, "")}
        ${slider("lineHeight", "Espacio entre líneas", 1, 2.2, 0.05, "")}
        ${slider("margin", "Márgenes", 0, 25, 1, " %")}
        ${slider("guidePos", "Altura de la línea guía", 10, 70, 1, " %")}
        ${slider("countdown", "Cuenta regresiva", 0, 10, 1, " s")}
      </div>
      <div class="group">
        ${sw("guide", "Línea guía")}${sw("mirror", "Espejo horizontal", "Para cristal de teleprompter")}${sw("mirrorV", "Espejo vertical")}${sw("upper", "Todo en mayúsculas")}
      </div>

      <div class="section-h">Control remoto</div>
      <div class="group">
        <div class="cell"><span class="lead">${ic("keys")}</span><div class="t"><b>Pedal o teclado Bluetooth</b>
          <span>Espacio: iniciar/pausar · ↑↓: velocidad (de 0.5 en 0.5) · ←→: canción · +/−: letra · M: espejo</span></div></div>
        <a class="cell tap" id="rmtGo" href="remote.html"><span class="lead">${ic("phone")}</span><div class="t"><b>Usar este celular como control remoto</b><span id="rmt">Necesita la PC con server.py</span></div>${ic("chev", "chev")}</a>
      </div>

      <div class="section-h">Ritmos</div>
      <div class="group">
        <div class="cell" style="flex-wrap:wrap;gap:6px">${state.ritmos.map((r) => `<span class="tag rit">${esc(r)}</span>`).join("")}</div>
        <div class="cell"><input type="text" class="field-input" id="nr" placeholder="Agregar ritmo"><button class="btn sm fill" id="anr">Agregar</button></div>
        <label class="cell tap"><span class="lead">${ic("text")}</span><div class="t"><b>Importar ritmos desde lista</b><span>“Lista de canciones.txt” con formato Canción - Ritmo</span></div>${ic("chev", "chev")}
          <input type="file" id="fr" accept=".txt,text/plain" hidden></label>
      </div>

      <div class="section-h">Datos</div>
      <div class="group">
        <button class="cell" id="mrg"><div class="t"><b>Agregar notas nuevas de Dropbox/Parrot</b><span>Después de correr tools/generar_datos.py</span></div></button>
        <button class="cell" id="rst"><div class="t"><b style="color:var(--danger)">Restablecer este dispositivo</b></div></button>
      </div>
      <p class="section-f">${alive(state.notas).length} notas · ${alive(state.canciones).length} canciones · ${alive(state.canciones).filter((c) => c.ritmo).length} con ritmo · datos de ${esc(state.origen || "—")}</p>`;

    $$("input[type=range]", el).forEach((r) => (r.oninput = () => { a[r.dataset.k] = +r.value; $("#v-" + r.dataset.k, el).textContent = r.value + r.dataset.u; save({ sync: false }); }));
    $$("input[data-c]", el).forEach((c) => (c.onchange = () => { a[c.dataset.c] = c.checked; save({ sync: false }); }));
    $("#send", el).onclick = shareFile;
    $("#recv", el).onchange = (e) => { const f = e.target.files[0]; if (f) receiveFile(f); e.target.value = ""; };
    $("#syncNow", el).onclick = () => { if (!Sync.lan && !Dropbox.connected()) return toast("Conecta la PC o Dropbox, o usa Enviar/Recibir"); Sync.run(); };
    $("#dbxOn", el) && ($("#dbxOn", el).onclick = () => Dropbox.connect());
    $("#dbxOff", el) && ($("#dbxOff", el).onclick = () => { Dropbox.disconnect(); viewAjustes(el); });
    $("#anr", el).onclick = () => { const v = $("#nr", el).value.trim(); if (!v) return; addRitmo(v); save(); viewAjustes(el); };
    $("#fr", el).onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      let ok = 0; const miss = [];
      (await f.text()).split(/\r?\n/).forEach((line) => {
        const m = line.match(/^(.+?)\s+-\s+(.+)$/); if (!m) return;
        const c = songById(songIdFromName(m[1])); if (!c) { miss.push(m[1]); return; }
        c.ritmo = m[2].trim(); addRitmo(c.ritmo); touch(c); ok++;
      });
      save(); toast(`${ok} ritmos importados` + (miss.length ? ` · ${miss.length} sin encontrar` : ""));
      if (miss.length) console.info("No encontradas:", miss);
      viewAjustes(el);
    };
    $("#mrg", el).onclick = () => {
      const d = window.ATRIL_DATA; if (!d) return;
      let n = 0;
      d.notas.forEach((x) => {
        const cur = state.notas.find((y) => y.titulo === x.titulo);
        if (!cur) { state.notas.push(touch({ ...x, id: "n" + uid() })); n++; }
        else if (!cur.ts && cur.texto !== x.texto) { cur.texto = x.texto; cur.modificado = x.modificado; touch(cur); n++; }
      });
      d.canciones.forEach((c) => { if (!state.canciones.some((y) => y.id === c.id)) { state.canciones.push(touch({ ...c })); n++; } });
      state.origen = d.generado; save(); toast(n ? `${n} elementos nuevos o actualizados` : "No hay nada nuevo"); viewAjustes(el);
    };
    $("#rst", el).onclick = () => {
      if (!confirm("¿Borrar los datos de este dispositivo y volver a los originales? Si tienes sincronización, lo de los otros aparatos regresará al sincronizar.")) return;
      state = seed(); save({ sync: false }); toast("Listo"); viewAjustes(el);
    };
    const li = $("#lanInfo", el), rm = $("#rmt", el);
    if (Sync.lan) {
      li.textContent = `Conectado a ${Sync.lan.name || "la PC"}`;
      rm.innerHTML = `Toca aquí. Desde otro celular abre <b>${esc(Sync.lan.remote)}</b>`;
    } else {
      li.textContent = "Abre la app desde la PC con server.py (ver README)";
      $("#rmtGo", el).onclick = (e) => { e.preventDefault(); toast("El control remoto necesita la PC con server.py"); };
    }
  }

  // ================= 5. teleprompter =================
  const P = { open: false, playing: false, raf: 0, last: 0, acc: 0, hideT: 0, wake: null };
  $$("#prompter [data-act]").forEach((b) => {
    const m = { exit: "close", top: "top", smaller: "aSmall", bigger: "aBig", prev: "prev", play: "play", next: "next", slower: "minus", faster: "plus", mirror: "mirror", remote: "phone" };
    if (m[b.dataset.act]) b.innerHTML = ic(m[b.dataset.act]);
  });

  function renderPrompterText(text) {
    const up = state.ajustes.upper;
    return String(text || "").replace(/\r/g, "").split("\n").map((raw) => {
      const line = up ? raw.toUpperCase() : raw, t = line.trim();
      if (!t) return `<div class="ln"></div>`;
      if (/^[—–]|——/.test(t)) return `<div class="marker">${esc(t.replace(/[—–]+/g, " ").replace(/^-+|-+$/g, "").trim())}</div>`;
      if (/^-/.test(t)) {
        const html = t.replace(/^-+\s*/, "").split("/").map((p) => p.trim()).filter(Boolean).map((p) => {
          const tags = [];
          p = p.replace(/\(([^)]*)\)?/g, (_, x) => { tags.push(x); return ""; }).replace(/\b(MITADES|MITAD|COMPLETA)\b/gi, (x) => { tags.push(x); return ""; }).trim();
          const m = p.match(KEY_RE); let k = "";
          if (m) { k = m[1].toUpperCase(); p = p.slice(0, m.index).trim(); }
          return `${esc(p)}${k ? `<span class="k">${esc(k)}</span>` : ""}${tags.map((x) => `<span class="tg">${esc(x)}</span>`).join("")}`;
        }).join(`<span class="sep">/</span>`);
        return `<div class="song">${html}</div>`;
      }
      const sp = t.match(SPEED_RE);
      if (sp) { const v = clampSpeed(parseFloat(sp[1].replace(",", "."))); return `<div class="spd" data-v="${v}">${ic("gauge")} velocidad ${fmtSpeed(v)}</div>`; }
      if (/^m[uú]sica$/i.test(t)) return `<div class="cue">♪ MÚSICA ♪</div>`;
      if (/^(tanda|intro|set)\b/i.test(t) && t.length < 40) return `<div class="section">${esc(t)}</div>`;
      return `<div class="ln">${esc(line)}</div>`;
    }).join("");
  }

  // ---- velocidades ----
  const SPEED_RE = /^\[\s*(?:vel|velocidad)\s*:?\s*(\d+(?:[.,]\d+)?)\s*\]$/i;
  const SPEED_PRESETS = [["Muy lenta", 2], ["Lenta", 4], ["Normal", 6], ["Rápida", 9], ["Muy rápida", 13], ["Máxima", 20]];
  const clampSpeed = (v) => Math.min(30, Math.max(0.5, Math.round((isFinite(v) ? v : 6) * 2) / 2));
  const fmtSpeed = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
  function setSpeed(v, { remember = true } = {}) {
    const a = state.ajustes; a.speed = clampSpeed(v);
    if (remember) {
      P.baseSpeed = a.speed;
      if (P.noteId) a.speedByNote = { ...(a.speedByNote || {}), [P.noteId]: a.speed };
    }
    save({ sync: false }); applySettings();
  }
  function speedMenu() {
    let m = $("#pSpeedMenu");
    if (m) { m.remove(); return; }
    m = document.createElement("div"); m.id = "pSpeedMenu"; m.className = "p-menu";
    m.innerHTML = `<div class="p-menu-h">Velocidad</div>
      <div class="p-menu-r"><input type="range" min="0.5" max="30" step="0.5" value="${state.ajustes.speed}" id="pMenuR" aria-label="Velocidad"><b id="pMenuV">${fmtSpeed(state.ajustes.speed)}</b></div>` + SPEED_PRESETS.map(([n, v]) =>
      `<button data-sp="${v}" class="${state.ajustes.speed === v ? "on" : ""}"><span>${n}</span><b>${v}</b></button>`).join("") +
      `<div class="p-menu-f">Tip: escribe <b>[vel 8]</b> en una línea de la nota para cambiar la velocidad al llegar ahí.</div>`;
    $("#pMenuR", m).addEventListener("input", (e) => {
      setSpeed(+e.target.value); $("#pMenuV").textContent = fmtSpeed(state.ajustes.speed);
      $$("[data-sp]", m).forEach((b) => b.classList.toggle("on", +b.dataset.sp === state.ajustes.speed));
    });
    m.onclick = (e) => { e.stopPropagation(); const b = e.target.closest("[data-sp]"); if (b) { setSpeed(+b.dataset.sp); m.remove(); toast("Velocidad " + b.dataset.sp); } };
    $("#prompter").appendChild(m); showUI();
  }
  function checkSpeedMarks(pos) {
    if (!P.marks || !P.marks.length) return;
    const g = pos + $("#pScroll").clientHeight * state.ajustes.guidePos / 100;
    let idx = -1;
    for (let i = 0; i < P.marks.length; i++) if (P.marks[i].y <= g) idx = i; else break;
    if (idx !== P.markIdx) {
      P.markIdx = idx;
      if (idx >= 0) { setSpeed(P.marks[idx].v, { remember: false }); flashSpeed(P.marks[idx].v); }
    }
  }
  function flashSpeed(v) { const el = $("#pSpeed"); el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash"); el.textContent = fmtSpeed(v); }

  // ---- Fondo del teleprompter: foto, GIF o video. Se guarda solo en este aparato (IndexedDB),
  // no se sincroniza porque puede pesar mucho. "Oscurecer" pone una capa negra encima para leer bien.
  // ---- tipografías ----
  // Las del aparato funcionan siempre; las de Google Fonts (gratis, licencia abierta) se bajan una vez
  // y se guardan en el iPad; y se puede usar cualquier archivo de fuente propio (por ejemplo de DaFont).
  const DEV_FONTS = [
    ["sistema", "Normal (del sistema)", "var(--font)"],
    ["redonda", "Redondeada", 'ui-rounded, "SF Pro Rounded", "Arial Rounded MT Bold", var(--font)'],
    ["serif", "Clásica con serifa", 'ui-serif, "New York", Georgia, "Times New Roman", serif'],
    ["maquina", "Máquina de escribir", '"American Typewriter", "Courier New", monospace'],
    ["futura", "Futura", 'Futura, "Century Gothic", "Trebuchet MS", sans-serif'],
    ["angosta", "Angosta", '"Avenir Next Condensed", "Arial Narrow", "Roboto Condensed", sans-serif'],
    ["marcador", "Marcador", '"Marker Felt", "Chalkboard SE", "Comic Sans MS", cursive'],
  ];
  const WEB_FONTS = ["Tilt Neon", "Neonderthaw", "Monoton", "Bungee", "Righteous", "Orbitron", "Audiowide", "Bebas Neue", "Anton", "Oswald",
    "Montserrat", "Poppins", "Playfair Display", "Lobster", "Pacifico", "Permanent Marker", "Kaushan Script", "Caveat", "Great Vibes", "Press Start 2P"];
  const FX = [["ninguno", "Sin efecto"], ["neon", "Neón"], ["neon-parpadeo", "Neón parpadeante"], ["latido", "Brillo que late"],
    ["arcoiris", "Arcoíris"], ["contorno", "Solo contorno"], ["sombra3d", "Sombra 3D"], ["fuego", "Fuego"]];
  const isFontFile = (name, type) => /\.(ttf|otf|woff2?)$/i.test(name || "") || /^(font\/|application\/(x-)?font)/i.test(type || "");
  const fontOptions = () =>
    `<optgroup label="Del aparato (sin internet)">${DEV_FONTS.map(([v, n]) => `<option value="${v}">${n}</option>`).join("")}</optgroup>` +
    `<optgroup label="Google Fonts (se bajan una vez)">${WEB_FONTS.map((n) => `<option value="g:${esc(n)}">${esc(n)}</option>`).join("")}` +
    `<option value="g:?">Otra de Google Fonts…</option></optgroup>`;
  const fxOptions = () => FX.map(([v, n]) => `<option value="${v}">${n}</option>`).join("");
  const askFontName = () => {
    const n = (prompt("Nombre de la fuente tal como aparece en fonts.google.com (por ejemplo: Rubik Glitch)") || "").trim();
    return n.replace(/[^\p{L}\p{N} ]/gu, "").slice(0, 60);
  };
  /** Lo que se muestra elegido en las listas. */
  function fontValue() {
    const a = state.ajustes;
    if (a.fuente !== "web") return DEV_FONTS.some((f) => f[0] === a.fuente) ? a.fuente : "sistema";
    return Fuente.src === "google" ? "g:" + Fuente.name : "file";
  }
  function fontStack() {
    const a = state.ajustes;
    if (a.fuente === "web") return '"AtrilFuente", var(--font)';
    return (DEV_FONTS.find((f) => f[0] === a.fuente) || DEV_FONTS[0])[2];
  }
  const Fuente = {
    name: "", src: "", face: null, loaded: false, MAX: 10 * 1024 * 1024,
    async load() {
      if (this.loaded) return;
      this.loaded = true;
      try { const r = await BgMedia.io("readonly", (st) => st.get("fuente")); if (r && r.blob) await this.apply(r.blob, r.name, r.src); } catch {}
    },
    async apply(blob, name, src) {
      const face = new FontFace("AtrilFuente", await blob.arrayBuffer(), { weight: "100 900", style: "normal" });
      await face.load();
      if (this.face) document.fonts.delete(this.face);
      document.fonts.add(face); this.face = face; this.name = name || "Fuente propia"; this.src = src || "file";
    },
    /** Guarda y activa un archivo de fuente (.ttf, .otf, .woff, .woff2). */
    async choose(file, src = "file", name) {
      if (!isFontFile(file.name, file.type)) throw new Error("Elige un archivo de fuente (.ttf, .otf o .woff)");
      if (file.size > this.MAX) throw new Error("La fuente es muy grande (máx. 10 MB)");
      name = name || file.name.replace(/\.(ttf|otf|woff2?)$/i, "").replace(/[_-]+/g, " ").trim();
      try { await this.apply(file, name, src); } catch { throw new Error("Ese archivo de fuente no se pudo abrir"); }
      this.loaded = true;
      try { await BgMedia.io("readwrite", (st) => st.put({ blob: file, name, src }, "fuente")); } catch {}
    },
    /** Baja de Google Fonts el archivo (letras latinas, la más gruesa hasta 700) sin guardarlo. */
    async googleFile(family) {
      const q = encodeURIComponent(family).replace(/%20/g, "+"), base = "https://fonts.googleapis.com/css2?display=swap&family=";
      let r = await fetch(base + q + ":wght@400;700");
      if (!r.ok) r = await fetch(base + q);
      if (!r.ok) throw new Error("No existe esa fuente");
      const css = await r.text(), faces = [];
      css.replace(/\/\*\s*([\w-]+)\s*\*\/\s*@font-face\s*{([^}]*)}/g, (_, sub, body) => {
        const u = /url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/.exec(body), w = /font-weight:\s*(\d+)/.exec(body);
        if (u) faces.push({ sub, url: u[1], w: w ? +w[1] : 400 });
      });
      if (!faces.length) css.replace(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g, (_, u) => faces.push({ sub: "latin", url: u, w: 400 }));
      const pick = faces.filter((f) => f.sub === "latin").sort((x, y) => y.w - x.w)[0] || faces[0];
      if (!pick) throw new Error("No se encontró el archivo");
      const f = await fetch(pick.url); if (!f.ok) throw new Error("descarga " + f.status);
      const ext = (/\.(woff2|woff|ttf|otf)(\?|$)/.exec(pick.url) || [, "woff2"])[1];
      return new File([await f.blob()], family + "." + ext, { type: "font/" + ext });
    },
    async google(family) { await this.choose(await this.googleFile(family), "google", family); },
  };
  setTimeout(() => Fuente.load().then(() => { if (P.open) applySettings(); }), 0);

  const BgMedia = {
    url: "", kind: "", name: "", loaded: false, K: "atril:fondo-oscuro",
    db() {
      return new Promise((ok, no) => {
        const r = indexedDB.open("atril-media", 1);
        r.onupgradeneeded = () => r.result.createObjectStore("m");
        r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error);
      });
    },
    async io(mode, fn) {
      const db = await this.db();
      return new Promise((ok, no) => { const tx = db.transaction("m", mode), q = fn(tx.objectStore("m")); tx.oncomplete = () => ok(q && q.result); tx.onerror = () => no(tx.error); });
    },
    async load() {
      if (this.loaded) return;
      this.loaded = true;
      try { const r = await this.io("readonly", (st) => st.get("fondo")); if (r && r.blob) this.set(r.blob, r.kind, r.name); } catch {}
    },
    set(blob, kind, name) {
      if (this.url) URL.revokeObjectURL(this.url);
      this.url = blob ? URL.createObjectURL(blob) : ""; this.kind = blob ? kind : ""; this.name = blob ? name || "" : "";
    },
    async choose(file) {
      const kind = /^video\//.test(file.type) ? "video" : /^image\//.test(file.type) ? "image" : "";
      if (!kind) throw new Error("Elige una foto, un GIF o un video");
      if (file.size > 300 * 1024 * 1024) throw new Error("El archivo es muy grande (máximo 300 MB)");
      await this.io("readwrite", (st) => st.put({ blob: file, kind, name: file.name }, "fondo"));
      this.set(file, kind, file.name); this.render();
    },
    async clear() { try { await this.io("readwrite", (st) => st.delete("fondo")); } catch {} this.set(null); this.render(); },
    dim() { const v = localStorage.getItem(this.K); return v === null ? 40 : +v; },
    setDim(v) { localStorage.setItem(this.K, String(v)); this.render(); },
    render() {
      const box = $("#pBg"), pr = $("#prompter"); if (!box) return;
      pr.classList.toggle("has-bg", !!this.url);
      if (!this.url) { box.innerHTML = ""; box.hidden = true; return; }
      box.hidden = false;
      pr.style.setProperty("--p-dim", this.dim() / 100);
      const cur = box.firstElementChild;
      if (!cur || cur.dataset.src !== this.url) {
        box.innerHTML = this.kind === "video"
          ? `<video data-src="${this.url}" src="${this.url}" muted loop playsinline autoplay></video>`
          : `<img data-src="${this.url}" src="${this.url}" alt="">`;
      }
      const v = $("video", box);
      if (v) { v.muted = true; if (P.open) v.play().catch(() => {}); else v.pause(); }
    },
  };

  function openPrompter(id) {
    let titulo, texto;
    if (id === "tmp" && tempText) ({ titulo, texto } = tempText);
    else if (id.startsWith("song:")) { const c = songById(id.slice(5)); if (c) { titulo = c.nombre; texto = songBlock(c, true); } }
    else { const n = noteById(id); if (n) ({ titulo, texto } = n); }
    if (texto == null) { toast("No se encontró la nota"); location.hash = "#/notas"; return; }
    P.open = true; P.noteId = id;
    const saved = (state.ajustes.speedByNote || {})[id];
    if (saved) state.ajustes.speed = saved; // cada nota recuerda su velocidad
    P.baseSpeed = state.ajustes.speed;     // los marcadores [vel N] la cambian solo mientras está abierta
    $("#pText").innerHTML = renderPrompterText(texto);
    P.markIdx = -2;
    $("#pTitle").textContent = titulo;
    $("#prompter").hidden = false; document.body.style.overflow = "hidden";
    $("#navbar").hidden = true; $("#view").hidden = true;
    applySettings(); $("#pScroll").scrollTop = 0; progress(); pause(); showUI();
    BgMedia.load().then(() => BgMedia.render());
    const pr = $("#prompter");
    try { const f = pr.requestFullscreen || pr.webkitRequestFullscreen; if (f) Promise.resolve(f.call(pr)).catch(() => {}); } catch {}
    keepAwake(true);
  }
  function closePrompter(nav = true) {
    if (!P.open) return;
    P.open = false; pause(); if (!Link.ok()) keepAwake(false);
    if (P.baseSpeed != null) { state.ajustes.speed = P.baseSpeed; save({ sync: false }); }
    $("#pSpeedMenu") && $("#pSpeedMenu").remove();
    $("#prompter").hidden = true; document.body.style.overflow = "";
    BgMedia.render(); // pausa el video de fondo
    $("#navbar").hidden = false; $("#view").hidden = false;
    try { if (document.fullscreenElement) document.exitFullscreen(); } catch {}
    if (nav) { if (history.length > 1) history.back(); else location.hash = "#/notas"; }
  }
  function applySettings() {
    const a = state.ajustes, pr = $("#prompter");
    pr.style.setProperty("--p-font", a.font + "px");
    pr.style.setProperty("--p-lh", a.lineHeight);
    pr.style.setProperty("--p-margin", a.margin + "vw");
    pr.style.setProperty("--p-guide", a.guidePos + "%");
    pr.style.setProperty("--p-fg", a.fg || "#ffffff");
    pr.style.setProperty("--p-bg", a.bg || "#000000");
    pr.classList.toggle("mirror", !!a.mirror);
    pr.classList.toggle("mirror-v", !!a.mirrorV);
    pr.classList.toggle("no-guide", !a.guide);
    document.documentElement.style.setProperty("--p-family", fontStack());
    pr.dataset.fx = a.efecto || "ninguno";
    $("#pSpeed").textContent = fmtSpeed(a.speed); $("#pFont").textContent = a.font;
    const r = $("#pSpeedR"); if (r && +r.value !== a.speed) r.value = a.speed;
    const mr = $("#pMenuR"); if (mr && document.activeElement !== mr) { mr.value = a.speed; $("#pMenuV").textContent = fmtSpeed(a.speed); }
    $("#pMirror").classList.toggle("on", !!a.mirror);
    // posiciones de los marcadores [vel N] (se miden con el prompter visible y la letra ya aplicada)
    if (P.open) P.marks = $$("#pText .spd").map((el) => ({ y: el.offsetTop, v: +el.dataset.v }));
  }
  function step() {
    if (!P.playing) return;
    const ts = performance.now();
    cancelAnimationFrame(P.raf);
    const sc = $("#pScroll"), dt = Math.min(100, ts - (P.last || ts)); P.last = ts;
    // Llevamos la posición exacta aparte: el navegador redondea scrollTop a píxeles de pantalla.
    if (P.pos == null || Math.abs(sc.scrollTop - P.pos) > 3) P.pos = sc.scrollTop; // el usuario movió el texto a mano
    P.pos += state.ajustes.speed * state.ajustes.font * 0.06 * dt / 1000; // px por segundo según velocidad y tamaño
    sc.scrollTop = P.pos;
    checkSpeedMarks(P.pos);
    progress();
    if (sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 2) {
      if (!state.ajustes.loop) { pause(); return; }
      sc.scrollTop = P.pos = 0; P.markIdx = -2;   // guion en bucle: vuelve a empezar solo
    }
    P.raf = requestAnimationFrame(step);
  }
  function progress() {
    const sc = $("#pScroll"), max = sc.scrollHeight - sc.clientHeight;
    $("#pProgress").style.width = (max > 0 ? (sc.scrollTop / max) * 100 : 0) + "%";
  }
  let countT = 0;
  function play({ count = true } = {}) {
    if (P.playing || countT) return;
    const box = $("#pCount");
    const go = () => {
      box.hidden = true; countT = 0; P.playing = true; P.last = 0; P.pos = null; $("#pPlay").innerHTML = ic("pause");
      P.raf = requestAnimationFrame(step);
      // Respaldo: si el navegador frena la animación (ahorro de batería, pestaña de fondo), seguimos avanzando.
      clearInterval(P.tick); P.tick = setInterval(() => { if (performance.now() - P.last > 80) step(); }, 50);
      hideUISoon();
    };
    let left = count ? state.ajustes.countdown : 0; if (!left) return go();
    box.hidden = false; box.textContent = left;
    countT = setInterval(() => { left--; if (left <= 0) { clearInterval(countT); go(); } else box.textContent = left; }, 1000);
  }
  function pause() {
    if (countT) { clearInterval(countT); countT = 0; $("#pCount").hidden = true; }
    P.playing = false; cancelAnimationFrame(P.raf); clearInterval(P.tick); $("#pPlay").innerHTML = ic("play"); showUI();
  }
  function jumpSong(dir) {
    const sc = $("#pScroll"), guide = sc.clientHeight * state.ajustes.guidePos / 100;
    const heads = $$("#pText .song").map((h) => h.offsetTop - guide), cur = sc.scrollTop;
    const target = dir > 0 ? heads.find((y) => y > cur + 4) : [...heads].reverse().find((y) => y < cur - 4);
    sc.scrollTo({ top: Math.max(0, target ?? (dir < 0 ? 0 : cur)), behavior: "smooth" });
    setTimeout(progress, 450);
  }
  // ---- mover por líneas (flechas del control y panel táctil) ----
  // Una "línea" mide lo mismo que una línea de texto en pantalla (letra × espacio entre líneas).
  const lineH = () => state.ajustes.font * state.ajustes.lineHeight;
  const N = { target: null, cur: 0, raf: 0 };
  function clampScroll(y) { const sc = $("#pScroll"); return Math.max(0, Math.min(sc.scrollHeight - sc.clientHeight, y)); }
  // drag: se mueve al instante, siguiendo el dedo
  function dragLines(n) {
    const sc = $("#pScroll");
    cancelAnimationFrame(N.raf); N.target = null;
    P.pos = clampScroll((P.pos ?? sc.scrollTop) + n * lineH());
    sc.scrollTop = P.pos; progress();
  }
  // line: avanza o regresa líneas completas con un movimiento suave
  function nudgeLines(n) {
    const sc = $("#pScroll");
    if (P.playing) return dragLines(n);   // corriendo: el desplazamiento automático sigue desde ahí
    if (N.target == null) N.cur = sc.scrollTop;
    N.target = clampScroll((N.target ?? sc.scrollTop) + n * lineH());
    cancelAnimationFrame(N.raf);
    const ease = () => {
      const d = N.target - N.cur;
      if (Math.abs(d) < 0.5) { sc.scrollTop = P.pos = N.target; N.target = null; progress(); return; }
      N.cur += d * 0.3; sc.scrollTop = P.pos = N.cur; progress();
      N.raf = requestAnimationFrame(ease);
    };
    N.raf = requestAnimationFrame(ease);
    // seguro: si el navegador frena la animación (ahorro de batería), igual llega a la línea
    clearTimeout(N.snap);
    N.snap = setTimeout(() => {
      if (N.target == null) return;
      cancelAnimationFrame(N.raf); sc.scrollTop = P.pos = N.target; N.target = null; progress();
    }, 350);
  }
  function command(act) {
    const a = state.ajustes;
    switch (act) {
      case "play": (P.playing || countT) ? pause() : play(); return;
      case "pause": pause(); return;
      case "faster": setSpeed(a.speed + 0.5); showUI(); return;
      case "slower": setSpeed(a.speed - 0.5); showUI(); return;
      case "speeds": speedMenu(); return;
      case "bigger": a.font = Math.min(140, a.font + 4); break;
      case "smaller": a.font = Math.max(24, a.font - 4); break;
      case "mirror": a.mirror = !a.mirror; break;
      case "next": jumpSong(1); break;
      case "prev": jumpSong(-1); break;
      case "top": $("#pScroll").scrollTo({ top: 0, behavior: "smooth" }); break;
      case "back": $("#pScroll").scrollBy({ top: -$("#pScroll").clientHeight * 0.4, behavior: "smooth" }); break;
      case "fwd": $("#pScroll").scrollBy({ top: $("#pScroll").clientHeight * 0.4, behavior: "smooth" }); break;
      case "exit": closePrompter(); return;
      case "remote": if (Link.ok()) toast("Control conectado"); else pairScreen(); return;
      default: {
        const m = /^(speed|line|drag):(-?\d+(?:\.\d+)?)$/.exec(act || "");
        if (!m) return;
        const n = parseFloat(m[2]);
        if (m[1] === "speed") { setSpeed(n); flashSpeed(state.ajustes.speed); showUI(); }
        else if (m[1] === "line") nudgeLines(Math.max(-20, Math.min(20, n)));
        else dragLines(Math.max(-40, Math.min(40, n)));
        return;
      }
    }
    save({ sync: false }); applySettings(); showUI();
  }
  /** MENSAJE desde el teléfono: llega un sobre, se abre, el texto corre de lado a lado y se vuelve a la letra. */
  const Msg = {
    q: [], busy: false, resume: false, cur: null,
    show(text, file = null) {
      text = String(text || "").replace(/\s+/g, " ").trim().slice(0, 300);
      if ((!text && !file) || this.q.length >= 6) return;
      this.q.push({ text, file }); if (!this.busy) this.next();
    },
    async next() {
      const it = this.q.shift();
      if (it == null) {
        this.busy = false;
        if (this.resume && P.open) play({ count: false });
        this.resume = false; return;
      }
      this.busy = true;
      if (P.open && (P.playing || countT)) { pause(); this.resume = true; }
      const a = state.ajustes, o = document.createElement("div");
      o.className = "msg-ov" + (a.mirror ? " mirror" : "") + (a.mirrorV ? " mirror-v" : "");
      o.dataset.fx = a.efecto || "ninguno"; o.style.setProperty("--p-fg", a.fg || "#ffffff");
      o.innerHTML = `<div class="msg-env"><svg viewBox="0 0 120 84" aria-hidden="true">
          <rect x="3" y="3" width="114" height="78" rx="9" class="e-body"/><path d="M6 78 48 42M114 78 72 42" class="e-line"/>
          <path d="M5 7 60 49 115 7" class="e-flap"/></svg><b>MENSAJE</b></div>
        <div class="msg-media"></div><div class="msg-run"><span></span></div>`;
      const text = it.text; let url = "";
      o.querySelector(".msg-run span").textContent = text;
      document.body.appendChild(o);
      // si el aparato frena las animaciones, un reloj de respaldo hace que el mensaje siga igual
      const anim = (el, kf, opt) => {
        const x = (this.cur = el.animate(kf, { fill: "forwards", ...opt }));
        return Promise.race([x.finished.catch(() => {}), new Promise((r) => setTimeout(() => { try { x.finish(); } catch {} r(); }, opt.duration + 150))]);
      };
      o.onclick = () => {
        this.skip = true; this.stopMedia && this.stopMedia();
        o.getAnimations({ subtree: true }).forEach((x) => { try { x.finish(); } catch {} });
      };
      this.skip = false;
      try {
        const env = o.querySelector(".msg-env");
        await anim(o, [{ opacity: 0 }, { opacity: 1 }], { duration: 200 });
        await anim(env, [
          { transform: "translate(-60vw, 30vh) scale(.35) rotate(-18deg)", opacity: 0 },
          { transform: "translate(4vw, -2vh) scale(1.08) rotate(4deg)", opacity: 1, offset: .7 },
          { transform: "none", opacity: 1 }], { duration: 650, easing: "cubic-bezier(.2,.8,.2,1)" });
        env.classList.add("open");
        if (!this.skip) await anim(env, [{ transform: "none" }, { transform: "scale(1.04)" }, { transform: "none" }], { duration: 800 });
        await anim(env, [{ transform: "none", opacity: 1 }, { transform: "translateY(-24vh) scale(.5)", opacity: 0 }], { duration: 380, easing: "ease-in" });
        const run = o.querySelector(".msg-run"), sp = run.firstElementChild;
        // foto (7 s) o video (hasta que termine, máx. 90 s), con el texto corriendo abajo
        let mediaDone = Promise.resolve();
        if (it.file && !this.skip) {
          url = URL.createObjectURL(it.file);
          const box = o.querySelector(".msg-media");
          if (/^video\//.test(it.file.type)) {
            const v = Object.assign(document.createElement("video"), { src: url, muted: true, playsInline: true, autoplay: true });
            v.setAttribute("playsinline", ""); v.setAttribute("muted", "");
            box.appendChild(v); v.play().catch(() => {});
            mediaDone = new Promise((r) => { v.onended = r; v.onerror = r; setTimeout(r, 90000); this.stopMedia = r; });
          } else {
            const img = new Image(); img.src = url; img.alt = ""; box.appendChild(img);
            mediaDone = new Promise((r) => { setTimeout(r, 7000); this.stopMedia = r; });
          }
          box.classList.add("on");
          await anim(box, [{ opacity: 0, transform: "scale(.9)" }, { opacity: 1, transform: "none" }], { duration: 420, easing: "cubic-bezier(.2,.8,.2,1)" });
          run.classList.add("bottom");
        }
        let textDone = Promise.resolve();
        if (text && !this.skip) {
          run.classList.add("on");
          const W = o.clientWidth, w = sp.offsetWidth, pxs = Math.max(320, W / 3.2);
          textDone = anim(sp, [{ transform: `translateX(${W}px)` }, { transform: `translateX(${-w}px)` }],
            { duration: Math.max(3500, ((W + w) / pxs) * 1000), easing: "linear" });
        }
        await Promise.all([mediaDone, textDone]);
        await anim(o, [{ opacity: 1 }, { opacity: 0 }], { duration: 350 });
      } finally { o.remove(); this.cur = null; this.stopMedia = null; if (url) URL.revokeObjectURL(url); }
      this.next();
    },
  };
  function showUI() { $("#prompter").classList.remove("hide-ui"); hideUISoon(); }
  function hideUISoon() { clearTimeout(P.hideT); if (P.playing) P.hideT = setTimeout(() => $("#prompter").classList.add("hide-ui"), 2500); }
  // Pantalla siempre encendida. Wake Lock solo existe en https; abierta desde la PC
  // (http://192.168…) el iPad no lo tiene, así que se reproduce en bucle un video mudo
  // e invisible de 4 s, que también evita que se bloquee.
  // video mudo de 4 s en negro (3.7 KB) incluido aquí mismo: iOS no lo reproduce si el
  // servidor no admite descargas por partes, y así además funciona sin internet
  const AWAKE_MP4 = "data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAk0bW9vdgAAAGxtdmhkAAAAAAAAAAAAAAAAAAAD6AAAD6AAAQAAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwAAA4l0cmFrAAAAXHRraGQAAAADAAAAAAAAAAAAAAABAAAAAAAAD6AAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAABAAAAAQAAAAAAAkZWR0cwAAABxlbHN0AAAAAAAAAAEAAA+gAAAAAAABAAAAAAMBbWRpYQAAACBtZGhkAAAAAAAAAAAAAAAAAAAoAAAAoABVxAAAAAAALWhkbHIAAAAAAAAAAHZpZGUAAAAAAAAAAAAAAABWaWRlb0hhbmRsZXIAAAACrG1pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAAmxzdGJsAAAAuHN0c2QAAAAAAAAAAQAAAKhhdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAABAAEABIAAAASAAAAAAAAAABFUxhdmM2Mi4yOC4xMDIgbGlieDI2NAAAAAAAAAAAAAAAGP//AAAALmF2Y0MBQsAK/+EAFmdCwArZHsBEAAADAAQAAAMAUDxImSABAAVoy4PLIAAAABBwYXNwAAAAAQAAAAEAAAAUYnRydAAAAAAAAAfGAAAAAAAAABhzdHRzAAAAAAAAAAEAAAAoAAAEAAAAABRzdHNzAAAAAAAAAAEAAAABAAAAHHN0c2MAAAAAAAAAAQAAAAEAAAABAAAAAQAAALRzdHN6AAAAAAAAAAAAAAAoAAACgwAAAAkAAAAKAAAACQAAAAkAAAAJAAAACQAAAAkAAAAJAAAACQAAAAkAAAAJAAAACQAAAAkAAAAJAAAACQAAAAkAAAAJAAAACQAAAAkAAAAJAAAACQAAAAkAAAAJAAAACQAAAAkAAAAJAAAACQAAAAkAAAAJAAAACQAAAAkAAAAJAAAACQAAAAkAAAAJAAAACQAAAAkAAAAJAAAACQAAALBzdGNvAAAAAAAAACgAAAl5AAAMCAAADBkAAAwrAAAMPAAADE0AAAxeAAAMcwAADIQAAAyVAAAMpgAADLcAAAzIAAAM2QAADO4AAAz/AAANEAAADSEAAA0yAAANQwAADVgAAA1pAAANegAADYsAAA2cAAANrQAADb4AAA3TAAAN5AAADfUAAA4GAAAOFwAADigAAA49AAAOTgAADl8AAA5wAAAOgQAADpIAAA6jAAAE1XRyYWsAAABcdGtoZAAAAAMAAAAAAAAAAAAAAAIAAAAAAAAPoAAAAAAAAAAAAAAAAQEAAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAACRlZHRzAAAAHGVsc3QAAAAAAAAAAQAAD6AAAAQAAAEAAAAABE1tZGlhAAAAIG1kaGQAAAAAAAAAAAAAAAAAAFYiAAFciFXEAAAAAAAtaGRscgAAAAAAAAAAc291bgAAAAAAAAAAAAAAAFNvdW5kSGFuZGxlcgAAAAP4bWluZgAAABBzbWhkAAAAAAAAAAAAAAAkZGluZgAAABxkcmVmAAAAAAAAAAEAAAAMdXJsIAAAAAEAAAO8c3RibAAAAH5zdHNkAAAAAAAAAAEAAABubXA0YQAAAAAAAAABAAAAAAAAAAAAAQAQAAAAAFYiAAAAAAA2ZXNkcwAAAAADgICAJQACAASAgIAXQBUAAAAAAB9AAAAC2QWAgIAFE4hW5QAGgICAAQIAAAAUYnRydAAAAAAAAB9AAAAC2QAAACBzdHRzAAAAAAAAAAIAAABXAAAEAAAAAAEAAACIAAAAuHN0c2MAAAAAAAAADgAAAAEAAAABAAAAAQAAAAIAAAADAAAAAQAAAAMAAAACAAAAAQAAAAgAAAADAAAAAQAAAAkAAAACAAAAAQAAAA8AAAADAAAAAQAAABAAAAACAAAAAQAAABUAAAADAAAAAQAAABYAAAACAAAAAQAAABwAAAADAAAAAQAAAB0AAAACAAAAAQAAACIAAAADAAAAAQAAACMAAAACAAAAAQAAACkAAAADAAAAAQAAAXRzdHN6AAAAAAAAAAAAAABYAAAAFQAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAAAQAAAAEAAAABAAAALRzdGNvAAAAAAAAACkAAAlkAAAL/AAADBEAAAwjAAAMNAAADEUAAAxWAAAMZwAADHwAAAyNAAAMngAADK8AAAzAAAAM0QAADOIAAAz3AAANCAAADRkAAA0qAAANOwAADUwAAA1hAAANcgAADYMAAA2UAAANpQAADbYAAA3HAAAN3AAADe0AAA3+AAAODwAADiAAAA4xAAAORgAADlcAAA5oAAAOeQAADooAAA6bAAAOrAAAABpzZ3BkAQAAAHJvbGwAAAACAAAAAf//AAAAHHNiZ3AAAAAAcm9sbAAAAAEAAABYAAAAAQAAAGJ1ZHRhAAAAWm1ldGEAAAAAAAAAIWhkbHIAAAAAAAAAAG1kaXJhcHBsAAAAAAAAAAAAAAAALWlsc3QAAAAlqXRvbwAAAB1kYXRhAAAAAQAAAABMYXZmNjIuMTIuMTAyAAAACGZyZWUAAAVcbWRhdN4CAExhdmM2Mi4yOC4xMDIAAjBADgAAAnEGBf//bdxF6b3m2Ui3lizYINkj7u94MjY0IC0gY29yZSAxNjUgcjMyMjMgMDQ4MGNiMCAtIEguMjY0L01QRUctNCBBVkMgY29kZWMgLSBDb3B5bGVmdCAyMDAzLTIwMjUgLSBodHRwOi8vd3d3LnZpZGVvbGFuLm9yZy94MjY0Lmh0bWwgLSBvcHRpb25zOiBjYWJhYz0wIHJlZj0zIGRlYmxvY2s9MTowOjAgYW5hbHlzZT0weDE6MHgxMTEgbWU9aGV4IHN1Ym1lPTcgcHN5PTEgcHN5X3JkPTEuMDA6MC4wMCBtaXhlZF9yZWY9MSBtZV9yYW5nZT0xNiBjaHJvbWFfbWU9MSB0cmVsbGlzPTEgOHg4ZGN0PTAgY3FtPTAgZGVhZHpvbmU9MjEsMTEgZmFzdF9wc2tpcD0xIGNocm9tYV9xcF9vZmZzZXQ9LTIgdGhyZWFkcz0xIGxvb2thaGVhZF90aHJlYWRzPTEgc2xpY2VkX3RocmVhZHM9MCBucj0wIGRlY2ltYXRlPTEgaW50ZXJsYWNlZD0wIGJsdXJheV9jb21wYXQ9MCBjb25zdHJhaW5lZF9pbnRyYT0wIGJmcmFtZXM9MCB3ZWlnaHRwPTAga2V5aW50PTI1MCBrZXlpbnRfbWluPTEwIHNjZW5lY3V0PTQwIGludHJhX3JlZnJlc2g9MCByY19sb29rYWhlYWQ9NDAgcmM9Y3JmIG1idHJlZT0xIGNyZj0yMy4wIHFjb21wPTAuNjAgcXBtaW49MCBxcG1heD02OSBxcHN0ZXA9NCBpcF9yYXRpbz0xLjQwIGFxPTE6MS4wMACAAAAACmWIhA/yYoAAw+4BGCAHARggBwEYIAcAAAAFQZo4H+oBGCAHARggBwAAAAZBmlQH+oABGCAHARggBwAAAAVBmmA/1AEYIAcBGCAHAAAABUGagD/UARggBwEYIAcAAAAFQZqgP9QBGCAHARggBwAAAAVBmsA/1AEYIAcBGCAHARggBwAAAAVBmuA/1AEYIAcBGCAHAAAABUGbAD/UARggBwEYIAcAAAAFQZsgP9QBGCAHARggBwAAAAVBm0A/1AEYIAcBGCAHAAAABUGbYD/UARggBwEYIAcAAAAFQZuAP9QBGCAHARggBwAAAAVBm6A/1AEYIAcBGCAHARggBwAAAAVBm8A/1AEYIAcBGCAHAAAABUGb4D/UARggBwEYIAcAAAAFQZoAP9QBGCAHARggBwAAAAVBmiA/1AEYIAcBGCAHAAAABUGaQD/UARggBwEYIAcAAAAFQZpgP9QBGCAHARggBwEYIAcAAAAFQZqAP9QBGCAHARggBwAAAAVBmqA/1AEYIAcBGCAHAAAABUGawD/UARggBwEYIAcAAAAFQZrgP9QBGCAHARggBwAAAAVBmwA/1AEYIAcBGCAHAAAABUGbID/UARggBwEYIAcAAAAFQZtAP9QBGCAHARggBwEYIAcAAAAFQZtgP9QBGCAHARggBwAAAAVBm4A/1AEYIAcBGCAHAAAABUGboD/UARggBwEYIAcAAAAFQZvAP9QBGCAHARggBwAAAAVBm+A/1AEYIAcBGCAHAAAABUGaAD/UARggBwEYIAcBGCAHAAAABUGaID/UARggBwEYIAcAAAAFQZpAP9QBGCAHARggBwAAAAVBmmA/1AEYIAcBGCAHAAAABUGagD/UARggBwEYIAcAAAAFQZqgP9QBGCAHARggBwAAAAVBmsA71AEYIAcBGCAHAAAABUGa4DfUARggBwEYIAcBGCAH";
  let awakeVideo = null;
  async function keepAwake(on) {
    try {
      if (on && "wakeLock" in navigator) { P.wake = await navigator.wakeLock.request("screen"); return; }
      if (!on && P.wake) { await P.wake.release(); P.wake = null; }
    } catch {}
    if (on) {
      if (!awakeVideo) {
        awakeVideo = Object.assign(document.createElement("video"), { src: AWAKE_MP4, muted: true, loop: true, playsInline: true });
        awakeVideo.setAttribute("playsinline", ""); awakeVideo.setAttribute("muted", "");
        awakeVideo.style.cssText = "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:0;top:0";
        document.body.appendChild(awakeVideo);
      }
      awakeVideo.play().catch(() => {});
    } else if (awakeVideo) awakeVideo.pause();
  }

  $("#prompter").addEventListener("click", (e) => {
    const b = e.target.closest("[data-act]");
    const menu = $("#pSpeedMenu");
    if (menu && !e.target.closest("#pSpeedMenu") && (!b || b.dataset.act !== "speeds")) { menu.remove(); if (!b) return; }
    if (b) { e.stopPropagation(); command(b.dataset.act); return; }
    if (e.target.closest("#pScroll")) {
      if ($("#prompter").classList.contains("hide-ui")) showUI(); // primer toque muestra controles
      else command("play");
    }
  });
  $("#pScroll").addEventListener("scroll", () => { if (!P.playing) progress(); }, { passive: true });
  // barra de velocidad del prompter: se mueve mientras corre el texto
  $("#pSpeedR").addEventListener("input", (e) => { setSpeed(+e.target.value); showUI(); });
  ["pointerdown", "click"].forEach((ev) => $("#pSpeedR").addEventListener(ev, (e) => { e.stopPropagation(); showUI(); }));
  $("#prompter").addEventListener("mousemove", showUI, { passive: true });

  document.addEventListener("keydown", (e) => {
    if (!P.open || (e.target.matches && e.target.matches("input, textarea, select"))) return;
    const act = {
      " ": "play", Enter: "play", k: "play", ArrowUp: "faster", ArrowDown: "slower",
      ArrowRight: "next", PageDown: "next", ArrowLeft: "prev", PageUp: "prev",
      "+": "bigger", "=": "bigger", "-": "smaller", m: "mirror", M: "mirror", Home: "top", Escape: "exit",
    }[e.key];
    if (act) { e.preventDefault(); command(act); }
  });

  // ================= arranque =================
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    if (P.open) keepAwake(true);
    Lan.wake();
    Sync.schedule(200);
  });
  window.addEventListener("pageshow", () => Lan.wake());
  window.addEventListener("online", () => { Lan.wake(); Sync.schedule(200); });
  setInterval(() => { if (Dropbox.connected() && document.visibilityState === "visible") Sync.schedule(0); }, 60000);

  if ("serviceWorker" in navigator && window.isSecureContext && location.protocol !== "file:") {
    navigator.serviceWorker.register("sw.js").catch((e) => console.warn("Modo sin internet no disponible", e));
  }

  route();
  (async () => {
    if (Dropbox.available()) { try { await Dropbox.finishLogin(); } catch (e) { console.warn(e); } }
    Sync.lan = await Lan.detect();
    if (Sync.lan) Lan.start(Sync.lan);
    else if (location.protocol === "http:") {
      // la PC no respondió al abrir (WiFi lento, server.py apagado): se sigue intentando
      const retry = setInterval(async () => {
        if (document.visibilityState !== "visible") return;
        const info = await Lan.detect(); if (!info) return;
        clearInterval(retry); Sync.lan = info; Lan.start(info); Sync.schedule(50);
        if (location.hash.startsWith("#/ajustes")) refreshView();
      }, 5000);
    }
    Sync.setStatus("local");
    Sync.schedule(50);
    if (location.hash.startsWith("#/ajustes")) refreshView();
  })();
})();

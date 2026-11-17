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
  const DEFAULT_SETTINGS = { font: 56, speed: 6, lineHeight: 1.35, margin: 8, mirror: false, mirrorV: false, guide: true, guidePos: 35, countdown: 3, upper: false, loop: false, fg: "#ffffff", bg: "#000000" };
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
  function save({ sync = true } = {}) {
    try { localStorage.setItem(STORE, JSON.stringify(state)); }
    catch { toast("No se pudo guardar en este navegador"); }
    if (sync) Sync.schedule();
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
      dc.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch { return; } this.handle(m); };
    },
    send(m) { if (this.ok()) { try { this.dc.send(JSON.stringify(m)); return true; } catch {} } return false; },
    opened() {
      Cam.stop(); keepAwake(true);
      if (this.role === "pantalla") {
        const fp = this.pc && this.pc.remoteDescription ? fpOf(this.pc.remoteDescription.sdp) : "";
        if (fp) Known.set(fp); // la próxima vez basta con que el teléfono escanee el código del iPad
        toast("Control conectado");
        this.statusT = setInterval(() => this.pushStatus(), 700); this.pushStatus();
      }
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
      if (this.role === "pantalla" && m.t === "cmd") remoteCmd(String(m.cmd || "").slice(0, 24), m.nota);
      else if (this.onMsg) this.onMsg(m);
    },
    /** El iPad le cuenta al teléfono qué guiones hay y qué está pasando, para mostrarlo en el control. */
    pushStatus() {
      const n = P.open ? noteById(P.noteId) : null;
      const st = {
        t: "estado", abierto: P.open ? ($("#pTitle").textContent || "Guion") : "", playing: !!P.playing,
        speed: state.ajustes.speed, font: state.ajustes.font,
        notas: ordered(alive(state.notas)).map((x) => [x.id, x.titulo]), nota: n ? n.id : "",
      };
      const j = JSON.stringify(st);
      if (j !== this.last && this.send(st)) this.last = j;
    },
  };
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
        ${link("#/ajustes", "gear", "Más ajustes y respaldo")}
      </div>`;
    const changed = () => { save({ sync: false }); if (P.open) applySettings(); };
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
        draft = { titulo: "", items: [], letras: draft.letras, q: "", ritmo: "*", modo: b.dataset.m };
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
      draft = { titulo: n.titulo + " (por ritmo)", items: ids, letras: draft.letras, q: "", ritmo: "*", modo: "ritmo" };
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
  function sheet(title, body, { left = "Cerrar", right = "", onRight } = {}) {
    const d = $("#sheet");
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
      <textarea class="editor" id="sl" style="min-height:34vh" placeholder="Pega aquí la letra">${esc(c.letra)}</textarea>
      ${isNew ? "" : `<p class="section-f">Aparece en: ${esc((c.notas || []).join(", ") || "ninguna nota")}</p>
      <div class="row" style="margin-top:16px"><button class="btn tint" id="sp">${ic("play")} Ver en prompter</button><span class="spacer"></span>
        <button class="btn danger" id="sd">${ic("trash")} Borrar</button></div>`}`,
      { left: "Cancelar", right: "Guardar", onRight: () => {
        const nombre = $("#sn", d).value.trim(); if (!nombre) { toast("Escribe el nombre"); return false; }
        c.nombre = nombre; c.tono = $("#st", d).value.trim().toUpperCase(); c.ritmo = $("#sr", d).value.trim(); c.letra = $("#sl", d).value;
        addRitmo(c.ritmo); touch(c); if (isNew) state.canciones.push(c); save(); after && after(); toast("Guardado");
      } });
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
  let draft = { titulo: "", items: [], letras: true, q: "", ritmo: "*", modo: "orden", juntas: false };
  let tempText = null;
  const SIN_RITMO = "Sin ritmo";
  function groupsByRitmo(ids) {
    const g = new Map();
    ids.forEach((id) => { const c = songById(id); if (!c) return; const k = c.ritmo || SIN_RITMO; if (!g.has(k)) g.set(k, []); g.get(k).push(c); });
    return [...g.entries()].sort(([a], [b]) => (a === SIN_RITMO) - (b === SIN_RITMO) || a.localeCompare(b, "es"));
  }
  function tandaText() {
    const block = (c) => songBlock(c, draft.letras);
    if (draft.modo !== "ritmo") return draft.items.map(songById).filter(Boolean).map(block).join("\n\n");
    return groupsByRitmo(draft.items).map(([ritmo, songs]) => {
      const head = "TANDA · " + ritmo.toUpperCase();
      if (!draft.juntas) return head + "\n\n" + songs.map(block).join("\n\n");
      // todas las del mismo ritmo en una línea, como en tus notas: -Eva María LAB/Azúcar DO
      const line = "-" + songs.map((c) => c.nombre + (c.tono ? " " + c.tono : "")).join("/");
      const lyr = draft.letras ? songs.filter((c) => c.letra).map((c) => c.letra.trim()).join("\n\nMÚSICA\n\n") : "";
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
            <label class="cell"><div class="t"><b>Incluir letras</b><span>Cuando la canción tenga letra guardada</span></div><input type="checkbox" class="switch" id="lt" ${draft.letras ? "checked" : ""}></label>
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
      $("#src", el).innerHTML = items.map((c) => {
        const on = draft.items.includes(c.id);
        return `<button class="cell" data-id="${esc(c.id)}" aria-pressed="${on}">
          <div class="t"><b>${esc(c.nombre)}</b><span>${esc(c.ritmo || SIN_RITMO)}${c.letra ? " · con letra" : ""}</span></div>
          ${c.tono ? `<span class="tag key">${esc(c.tono)}</span>` : ""}<span class="add-dot ${on ? "on" : ""}">${ic(on ? "check" : "plus")}</span></button>`;
      }).join("") || `<div class="empty">Nada que mostrar.</div>`;
    };
    const row = (c, first, last, n) => `<div class="cell" data-id="${esc(c.id)}"><span class="num">${n}</span><div class="t"><b>${esc(c.nombre)}</b></div>
        ${c.tono ? `<span class="tag key">${esc(c.tono)}</span>` : ""}
        <button class="btn sm icon" data-mv="-1" aria-label="Subir" ${first ? "disabled" : ""}>${ic("up")}</button>
        <button class="btn sm icon" data-mv="1" aria-label="Bajar" ${last ? "disabled" : ""}>${ic("down")}</button>
        <button class="btn sm icon danger" data-rm aria-label="Quitar">${ic("close")}</button></div>`;
    const drawSet = () => {
      $("#setH", el).textContent = `Tanda · ${draft.items.length} canciones`;
      if (!draft.items.length) { $("#set", el).innerHTML = `<div class="group" style="margin-top:0"><div class="empty">Toca canciones de la lista para agregarlas.</div></div>`; return; }
      if (draft.modo === "ritmo") {
        let n = 0;
        $("#set", el).innerHTML = groupsByRitmo(draft.items).map(([ritmo, songs]) =>
          `<div class="section-h">${esc(ritmo)} · ${songs.length}</div><div class="group" style="margin-top:0">${
            songs.map((c, i) => row(c, i === 0, i === songs.length - 1, ++n)).join("")}</div>`).join("");
      } else {
        $("#set", el).innerHTML = `<div class="group" style="margin-top:0">${draft.items.map(songById).filter(Boolean)
          .map((c, i, arr) => row(c, i === 0, i === arr.length - 1, i + 1)).join("")}</div>`;
      }
    };
    const redraw = () => { drawTop(); drawSrc(); drawSet(); };
    $("#modo", el).onclick = (e) => { const b = e.target.closest("[data-m]"); if (b) { draft.modo = b.dataset.m; redraw(); } };
    $("#q", el).oninput = (e) => { draft.q = e.target.value; drawSrc(); };
    $("#rits", el).onclick = (e) => { const b = e.target.closest("[data-r]"); if (!b) return; draft.ritmo = b.dataset.r; drawTop(); drawSrc(); };
    $("#src", el).onclick = (e) => {
      const b = e.target.closest("[data-id]"); if (!b) return;
      const id = b.dataset.id, c = songById(id), at = draft.items.indexOf(id);
      if (at >= 0) { draft.items.splice(at, 1); toast("Quitada: " + c.nombre); }
      else { draft.items.push(id); toast("Agregada: " + c.nombre + (draft.modo === "ritmo" ? ` → ${c.ritmo || SIN_RITMO}` : "")); }
      drawSrc(); drawSet();
    };
    $("#set", el).onclick = (e) => {
      const r = e.target.closest("[data-id]"); if (!r) return;
      const id = r.dataset.id, i = draft.items.indexOf(id);
      if (e.target.closest("[data-rm]")) { draft.items.splice(i, 1); drawSrc(); drawSet(); return; }
      const mv = e.target.closest("[data-mv]"); if (!mv) return;
      const dir = +mv.dataset.mv;
      // en modo ritmo se mueve dentro de su grupo (salta las de otros ritmos)
      const same = (j) => draft.modo !== "ritmo" || ((songById(draft.items[j]) || {}).ritmo || "") === (songById(id).ritmo || "");
      let j = i + dir; while (j >= 0 && j < draft.items.length && !same(j)) j += dir;
      if (j >= 0 && j < draft.items.length) [draft.items[i], draft.items[j]] = [draft.items[j], draft.items[i]];
      drawSet();
    };
    $("#tit", el).oninput = (e) => (draft.titulo = e.target.value);
    $("#lt", el).onchange = (e) => (draft.letras = e.target.checked);
    $("#jt", el).onchange = (e) => (draft.juntas = e.target.checked);
    $("#clr", el).onclick = () => { if (draft.items.length && confirm("¿Vaciar la tanda?")) { draft.items = []; drawSrc(); drawSet(); } };
    $("#prev", el).onclick = () => { if (!draft.items.length) return toast("La tanda está vacía"); tempText = { titulo: draft.titulo || "Tanda (prueba)", texto: tandaText() }; location.hash = "#/prompter/tmp"; };
    $("#sv", el).onclick = () => {
      if (!draft.items.length) return toast("La tanda está vacía");
      const n = touch({ id: "n" + uid(), titulo: draft.titulo.trim() || "Tanda " + fmtDate(today()), texto: tandaText(), modificado: today(), orden: topOrder() });
      draft.items.forEach((id) => { const c = songById(id); if (c && !(c.notas || []).includes(n.titulo)) { c.notas = [...(c.notas || []), n.titulo]; touch(c); } });
      state.notas.push(n); save();
      draft = { titulo: "", items: [], letras: draft.letras, q: "", ritmo: "*", modo: draft.modo, juntas: draft.juntas };
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
    Link.onMsg = (m) => { if (m.t === "estado") { ctlState = m; if (location.hash.startsWith("#/control")) updatePad(); } };

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
          <div class="r3"><button class="rbtn" data-cmd="speed:4">Lenta</button><button class="rbtn" data-cmd="speed:6">Normal</button><button class="rbtn" data-cmd="speed:9">Rápida</button></div>
          <div class="r2"><button class="rbtn" data-cmd="smaller">A − Letra</button><button class="rbtn" data-cmd="bigger">A + Letra</button></div>
          <div class="r2"><button class="rbtn" data-cmd="top">⤒ Inicio</button><button class="rbtn" data-cmd="exit">✕ Cerrar guion</button></div>
          <button class="btn plain danger" id="cut" style="margin:6px auto 0">Desconectar</button>
        </div>`;
      const send = (cmd, extra) => {
        if (!Link.send({ t: "cmd", cmd, ...extra })) return toast("Sin conexión con el iPad");
        if (navigator.vibrate && !/^drag:/.test(cmd)) navigator.vibrate(12);
      };
      $$("[data-cmd]", el).forEach((b) => (b.onclick = () => send(b.dataset.cmd)));
      $("#nota", el).onchange = (e) => { if (e.target.value) send("open", { nota: e.target.value }); };
      $("#cut", el).onclick = () => { Link.reset(); Link.role = null; draw(); };
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
    const pb = $("#cPlay"); if (pb && s) pb.innerHTML = `${ic(s.playing ? "pause" : "play")} ${s.playing ? "Pausar" : "Iniciar"}`;
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
    m.innerHTML = `<div class="p-menu-h">Velocidad</div>` + SPEED_PRESETS.map(([n, v]) =>
      `<button data-sp="${v}" class="${state.ajustes.speed === v ? "on" : ""}"><span>${n}</span><b>${v}</b></button>`).join("") +
      `<div class="p-menu-f">Tip: escribe <b>[vel 8]</b> en una línea de la nota para cambiar la velocidad al llegar ahí.</div>`;
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
    $("#pSpeed").textContent = fmtSpeed(a.speed); $("#pFont").textContent = a.font;
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
  function play() {
    if (P.playing || countT) return;
    const box = $("#pCount");
    const go = () => {
      box.hidden = true; countT = 0; P.playing = true; P.last = 0; P.pos = null; $("#pPlay").innerHTML = ic("pause");
      P.raf = requestAnimationFrame(step);
      // Respaldo: si el navegador frena la animación (ahorro de batería, pestaña de fondo), seguimos avanzando.
      clearInterval(P.tick); P.tick = setInterval(() => { if (performance.now() - P.last > 80) step(); }, 50);
      hideUISoon();
    };
    let left = state.ajustes.countdown; if (!left) return go();
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
  function showUI() { $("#prompter").classList.remove("hide-ui"); hideUISoon(); }
  function hideUISoon() { clearTimeout(P.hideT); if (P.playing) P.hideT = setTimeout(() => $("#prompter").classList.add("hide-ui"), 2500); }
  // Pantalla siempre encendida. Wake Lock solo existe en https; abierta desde la PC
  // (http://192.168…) el iPad no lo tiene, así que se reproduce en bucle un video mudo
  // e invisible de 4 s, que también evita que se bloquee.
  // video mudo de 4 s en negro (3.7 KB) incluido aquí mismo: iOS no lo reproduce si el
  // servidor no admite descargas por partes, y así además funciona sin internet
  const AWAKE_MP4 = "data:video/mp4;base64,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";
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

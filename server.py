"""
Servidor local de Atril — NO necesita internet.

Sirve la app a todos los aparatos conectados a la misma red WiFi (o al hotspot del
celular), guarda una copia compartida de los datos y reenvía los comandos del
celular-control remoto al iPad.

Uso:   python server.py            (puerto 8765)
       python server.py 9000       (otro puerto)

Luego abre en el iPad/Android la dirección que aparece en pantalla.
Solo usa la biblioteca estándar de Python 3.8+.
"""
import collections, json, os, queue, socket, sys, threading, time
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
STATE_FILE = os.path.join(ROOT, "atril-sync.json")

lock = threading.Lock()
clients = []  # colas de los aparatos escuchando /api/events
rev = 0
# últimos comandos del control remoto, numerados: si una pantalla pierde la conexión
# en vivo los recoge preguntando a /api/poll y no se pierde ninguno
cmds = collections.deque(maxlen=50)
seq = 0
pollers = {}  # ip -> última vez que preguntó (pantallas usando el respaldo)


def load_state():
    try:
        with open(STATE_FILE, encoding="utf-8") as fh:
            return json.load(fh)
    except Exception:
        return None


shared = load_state()


def merge(base, inc):
    """Combina por id: gana el elemento con 'ts' (hora de cambio) más reciente."""
    if not base:
        return inc
    out = {"app": "atril", "version": 2}
    for key in ("notas", "canciones"):
        items = {x["id"]: x for x in base.get(key, [])}
        for x in inc.get(key, []):
            cur = items.get(x["id"])
            if cur is None or (x.get("ts") or 0) > (cur.get("ts") or 0):
                items[x["id"]] = x
        out[key] = list(items.values())
    ritmos = list(base.get("ritmos", []))
    for r in inc.get("ritmos", []):
        if r not in ritmos:
            ritmos.append(r)
    out["ritmos"] = ritmos
    return out


def broadcast(msg):
    data = json.dumps(msg)
    with lock:
        for q in list(clients):
            q.put(data)


def screens():
    """Cuántas pantallas están escuchando comandos (en vivo o por respaldo)."""
    now = time.time()
    with lock:
        live = len(clients)
        for ip, t in list(pollers.items()):
            if now - t > 6:
                del pollers[ip]
        return live + len(pollers)


def lan_ips():
    ips = set()
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("10.255.255.255", 1))  # no envía nada, solo elige la interfaz de red
        ips.add(s.getsockname()[0])
        s.close()
    except Exception:
        pass
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            ips.add(info[4][0])
    except Exception:
        pass
    return sorted(ip for ip in ips if not ip.startswith("127."))


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def log_message(self, fmt, *args):
        # se muestran todas las visitas de otros aparatos para saber si llegan a la PC
        if "events" not in (self.path or "") and self.client_address[0] not in ("127.0.0.1", "::1"):
            sys.stdout.write("  %s %s\n" % (self.address_string(), fmt % args))
            sys.stdout.flush()

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def _json(self, obj, code=200):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _body(self):
        n = int(self.headers.get("Content-Length") or 0)
        return json.loads(self.rfile.read(n) or b"{}")

    def do_GET(self):
        path = self.path.split("?")[0]
        if path.endswith("/api/ping"):
            host = self.headers.get("Host") or f"{lan_ips()[0] if lan_ips() else 'localhost'}:{PORT}"
            return self._json({"name": socket.gethostname(), "remote": f"http://{host}/remote.html", "ips": lan_ips(),
                               "seq": seq, "rev": rev, "screens": screens()})
        if path.endswith("/api/state"):
            with lock:
                return self._json({"rev": rev, "data": shared})
        if path.endswith("/api/poll"):
            # respaldo cuando la conexión en vivo se cae (iPad bloqueado, WiFi inestable…)
            try:
                since = int(self.path.split("since=")[1].split("&")[0]) if "since=" in self.path else seq
            except ValueError:
                since = seq
            with lock:
                pollers[self.client_address[0]] = time.time()
                out = {"seq": seq, "rev": rev, "now": time.time(), "cmds": [c for c in cmds if c["seq"] > since]}
            return self._json(out)
        if path.endswith("/api/events"):
            q = queue.Queue()
            with lock:
                clients.append(q)
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.end_headers()
            try:
                # retry: el navegador se reconecta a los 2 s si se corta
                self.wfile.write(f"retry: 2000\ndata: {json.dumps({'type': 'hello', 'seq': seq, 'rev': rev})}\n\n".encode("utf-8"))
                self.wfile.flush()
                while True:
                    try:
                        msg = q.get(timeout=10)
                    except queue.Empty:
                        # señal de vida: si la pantalla deja de recibirla sabe que debe reconectarse
                        msg = json.dumps({"type": "ping", "seq": seq, "rev": rev})
                    self.wfile.write(f"data: {msg}\n\n".encode("utf-8"))
                    self.wfile.flush()
            except Exception:
                pass
            finally:
                with lock:
                    if q in clients:
                        clients.remove(q)
            return
        return super().do_GET()

    def do_POST(self):
        global shared, rev, seq
        path = self.path.split("?")[0]
        try:
            body = self._body()
        except Exception:
            return self._json({"error": "JSON inválido"}, 400)
        if path.endswith("/api/state"):
            data = body.get("data")
            if not isinstance(data, dict) or not isinstance(data.get("notas"), list):
                return self._json({"error": "datos inválidos"}, 400)
            with lock:
                before = json.dumps(shared, sort_keys=True)
                shared = merge(shared, data)
                changed = json.dumps(shared, sort_keys=True) != before
                if changed:
                    rev += 1
                    tmp = STATE_FILE + ".tmp"
                    with open(tmp, "w", encoding="utf-8") as fh:
                        json.dump(shared, fh, ensure_ascii=False)
                    os.replace(tmp, STATE_FILE)
                out = {"rev": rev, "data": shared}
            if changed:
                broadcast({"type": "rev", "rev": rev, "from": body.get("from")})
            return self._json(out)
        if path.endswith("/api/cmd"):
            cmd =str(body.get("cmd") or "")[:20]
            msg = {"type": "cmd", "cmd": cmd, "t": time.time()}
            if body.get("nota"):
                msg["nota"] = str(body["nota"])[:80]
            with lock:
                seq += 1
                msg["seq"] = seq
                cmds.append(msg)
            broadcast(msg)
            return self._json({"ok": True, "seq": seq, "screens": screens()})
        return self._json({"error": "no encontrado"}, 404)


class Server(ThreadingHTTPServer):
    request_queue_size = 64  # varios aparatos conectándose a la vez

    def handle_error(self, request, client_address):
        # un celular que se bloquea o cambia de red corta la conexión: es normal, no es un error
        if isinstance(sys.exc_info()[1], (ConnectionError, TimeoutError)):
            return
        super().handle_error(request, client_address)


if __name__ == "__main__":
    Handler.extensions_map.update({".webmanifest": "application/manifest+json", ".js": "text/javascript", ".svg": "image/svg+xml"})
    srv = Server(("0.0.0.0", PORT), Handler)
    srv.daemon_threads = True
    print("\n  Atril está listo (no necesita internet).\n")
    print(f"  En esta PC:          http://localhost:{PORT}")
    for ip in lan_ips():
        print(f"  En iPad / Android:   http://{ip}:{PORT}")
        print(f"  Control remoto:      http://{ip}:{PORT}/remote.html")
    print("\n  Todos los aparatos deben estar en la misma red WiFi (o en el hotspot del celular).")
    print("  Cierra esta ventana o presiona Ctrl+C para apagarlo.\n")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass

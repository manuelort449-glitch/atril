"""
Genera los datos de Atril a partir de las notas de Parrot Teleprompter en Dropbox.

Uso (desde la carpeta atril):
    python tools/generar_datos.py
    python tools/generar_datos.py "C:/ruta/a/Dropbox/Aplicaciones/Parrot Teleprompter"

Escribe:
    data/mis-datos.js                 -> tus datos para la app (window.ATRIL_DATA); NO se sube a GitHub
    listas/Lista de canciones.txt     -> todas las canciones, sin repetir
    listas/Canciones con letra.txt    -> canciones que tienen letra en las notas
"""
import os, re, sys, json, datetime, unicodedata
from collections import defaultdict
sys.stdout.reconfigure(encoding="utf-8")

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.expanduser("~"), "Dropbox", "Aplicaciones", "Parrot Teleprompter")
outdir = os.path.join(ROOT, "listas")
song_files = defaultdict(set)
raw_notes = []

KEY = r"(?:DO|RE|MI|FA|SOL|LA|SI)(?:#|B)?M?"
key_re = re.compile(r"\s+(" + KEY + r")\s*$", re.I)
SKIP = {"intro", "musica", "musicas", "popurri julion alvarez"}
ALIAS = {
    "segunda vida": "mi segunda vida",
    "malboro rojo": "marlboro rojo",
    "hotel de el cid": "hotel del cid",
    "intro cara a la muerte": "cara a la muerte",
    "intro de cara a la muerte": "cara a la muerte",
    "popurri arrolladora quechsm": "popurri arrolladora que chsm mi ex",
    "popurri arrolladora quechsme": "popurri arrolladora que chsm mi ex",
    "popurri arrolladora": "popurri arrolladora que chsm mi ex",
    "buena y la mala": "la buena y la mala",
    "el 24": "24",
    "mananitas": "las mananitas",
}
FIXED_NAME = {
    "popurri arrolladora que chsm mi ex": "Popurrí Arrolladora \"Qué CHSM mi ex\" (canciones no especificadas en las notas)",
    "marlboro rojo": "Marlboro rojo",
    "hotel del cid": "Hotel del Cid",
    "cara a la muerte": "Cara a la muerte",
    "las mananitas": "Las mañanitas",
    "mi segunda vida": "Mi segunda vida",
    "24": "El 24",
    "la buena y la mala": "La buena y la mala",
}

def plain(s):
    s = unicodedata.normalize("NFD", s.lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    return re.sub(r"\s+", " ", s).strip()

def norm(s):
    s = plain(s)
    s = ALIAS.get(s, s)
    if s in ALIAS.values() or s in FIXED_NAME:
        return s
    s2 = re.sub(r"^(el|la|los|las)\s+", "", s)
    return ALIAS.get(s2, s2)

def clean_part(p):
    p = p.replace("✍️", "").replace("✍", "")
    p = re.sub(r"\b(SEISOCHO|TRESCUARTOS|DOSCUARTOS)\b", "", p)
    p = re.sub(r"\((?i:mitad(?:es)?|completa|empieza[^)]*)\)?", "", p)
    p = re.sub(r"(?i)\b(MITADES|MITAD|COMPLETA)\b", "", p)
    p = p.replace("(", " ").replace(")", " ").strip()
    k = None
    m = key_re.search(p)
    if m:
        k = m.group(1).upper()
        p = p[:m.start()]
    return p.strip(" -\"“”\t"), k

def parse_line(line):
    body = line.lstrip("-").strip()
    body = body.replace("6/8", "SEISOCHO").replace("3/4", "TRESCUARTOS").replace("2/4", "DOSCUARTOS")
    m = re.match(r"(?i)popurr[ií][^(]*\((.*)\)?$", body)
    if m:
        body = m.group(1)
    out = []
    for p in body.split("/"):
        name, k = clean_part(p)
        if not name:
            continue
        n = norm(name)
        if n and n not in SKIP:
            out.append((n, name, k))
    return out

UNDASHED = re.compile(r"^[^\-\s—].{1,60}\s(DO|RE|MI|FA|SOL|LA|SI|Do|Re|Mi|Fa|Sol|La|Si)(#|B|b)?M?\s*(✍️|✍)?\s*$")

def is_break(line):
    return line.startswith("—") or "——" in line

def is_header(line):
    if not line or is_break(line):
        return False
    if line.startswith("-"):
        return True
    if re.match(r"(?i)intro\b", line):
        return False
    return bool(UNDASHED.match(line))

names = defaultdict(lambda: defaultdict(int))
song_keys = defaultdict(lambda: defaultdict(int))
lyrics = {}          # id -> (text, source file)
lyric_files = defaultdict(set)
unassigned = []

NOT_LYRIC = re.compile(r"(?i)^(m[uú]sica|tanda.*|intro.*|\d+\s*(ra|da|ta)?\s*tanda.*|final|fin)$")

for root, _, files in os.walk(src):
    for f in sorted(files):
        if not f.lower().endswith(".txt"):
            continue
        rel = os.path.relpath(os.path.join(root, f), src)
        with open(os.path.join(root, f), encoding="utf-8", errors="replace") as fh:
            full = fh.read().lstrip("﻿")
            lines = full.splitlines()
        raw_notes.append({
            "id": "n" + str(len(raw_notes) + 1),
            "titulo": rel[:-4].replace(os.sep, " - "),
            "texto": full.replace("\r\n", "\n"),
            "modificado": datetime.datetime.fromtimestamp(os.path.getmtime(os.path.join(root, f))).strftime("%Y-%m-%d"),
        })
        i = 0
        while i < len(lines):
            line = lines[i].strip()
            if not is_header(line):
                i += 1; continue
            songs = parse_line(line)
            for n, raw, k in songs:
                names[n][raw] += 1
                song_files[n].add(rel[:-4].replace(os.sep, " - "))
                if k:
                    song_keys[n][k] += 1
            j = i + 1
            block = []
            while j < len(lines) and not is_header(lines[j].strip()) and not is_break(lines[j].strip()):
                block.append(lines[j].rstrip()); j += 1
            text_lines = [b for b in block if b.strip() and not NOT_LYRIC.match(b.strip())]
            if len(text_lines) >= 2 and songs:
                # trim leading/trailing blank lines
                while block and not block[0].strip(): block.pop(0)
                while block and not block[-1].strip(): block.pop()
                # drop trailing header lines (e.g. "Tanda II")
                while block and (not block[-1].strip() or NOT_LYRIC.match(block[-1].strip())) and not re.match(r"(?i)^m[uú]sica$", block[-1].strip()):
                    block.pop()
                text = "\n".join(block)
                if len(songs) == 1:
                    target = songs[0][0]
                else:
                    lt = " " + plain(text) + " "
                    def score(n):
                        ws = [w for w in n.split() if len(w) >= 4]
                        return sum(1 for w in ws if f" {w} " in lt) / (len(ws) or 1)
                    best = max(songs, key=lambda s: score(s[0]))
                    target = best[0] if score(best[0]) > 0 else None
                if target is None:
                    unassigned.append((rel, line, text))
                else:
                    lyric_files[target].add(rel)
                    if target not in lyrics or len(text) > len(lyrics[target][0]):
                        lyrics[target] = (text, rel)
            i = j

def pretty(n):
    if n in FIXED_NAME:
        return FIXED_NAME[n]
    best = max(names[n].items(), key=lambda kv: (not kv[0].isupper(), kv[1]))[0]
    best = best.strip()
    return best[0].upper() + best[1:].lower() if best.isupper() else best[0].upper() + best[1:]

order = sorted(names, key=lambda n: plain(pretty(n)))
os.makedirs(outdir, exist_ok=True)
with open(os.path.join(outdir, "Lista de canciones.txt"), "w", encoding="utf-8-sig") as fh:
    fh.write(f"LISTA DE CANCIONES (sin repetir) - {len(order)} canciones\n")
    fh.write("Sacada de las notas de Parrot Teleprompter (Dropbox). Escribe el ritmo después del guion.\n\n")
    for n in order:
        fh.write(f"{pretty(n)} - \n")

lord = sorted(lyrics, key=lambda n: plain(pretty(n)))
with open(os.path.join(outdir, "Canciones con letra.txt"), "w", encoding="utf-8-sig") as fh:
    fh.write(f"CANCIONES CON LETRA EN LAS NOTAS - {len(lord)} canciones\n")
    fh.write("Se guarda la versión más completa de cada letra.\n\n")
    fh.write("ÍNDICE\n")
    for n in lord:
        fh.write(f"- {pretty(n)}\n")
    for n in lord:
        text, rel = lyrics[n]
        fh.write("\n\n" + "=" * 50 + "\n")
        fh.write(pretty(n).upper() + "\n")
        fh.write(f"(letra tomada de: {rel[:-4]})\n")
        fh.write("=" * 50 + "\n\n")
        fh.write(text + "\n")
    if unassigned:
        fh.write("\n\n" + "=" * 50 + "\nLETRAS SIN IDENTIFICAR (venían debajo de un bloque de varias canciones)\n" + "=" * 50 + "\n")
        for rel, line, text in unassigned:
            fh.write(f"\n--- Nota: {rel[:-4]} | Bloque: {line.lstrip('-').strip()}\n\n{text}\n")

print(len(order), "canciones;", len(lord), "con letra;", len(unassigned), "letras sin asignar")
for rel, line, text in unassigned:
    print("SIN ASIGNAR:", rel, "|", line, "|", text[:60].replace("\n", " "))

# ---------- datos para la app ----------
canciones = []
for n in order:
    letra = lyrics.get(n, ("", ""))[0]
    tono = max(song_keys[n].items(), key=lambda kv: kv[1])[0] if song_keys[n] else ""
    canciones.append({
        "id": re.sub(r"\s+", "-", n),
        "nombre": pretty(n),
        "tono": tono,
        "ritmo": "",
        "letra": letra,
        "notas": sorted(song_files[n]),
    })
datos = {
    "generado": datetime.datetime.now().strftime("%Y-%m-%d %H:%M"),
    "origen": "Parrot Teleprompter (Dropbox)",
    "canciones": canciones,
    "notas": sorted(raw_notes, key=lambda x: x["modificado"], reverse=True),
}
os.makedirs(os.path.join(ROOT, "data"), exist_ok=True)
with open(os.path.join(ROOT, "data", "mis-datos.js"), "w", encoding="utf-8") as fh:
    fh.write("// Generado por tools/generar_datos.py - no editar a mano\n")
    fh.write("window.ATRIL_DATA = ")
    json.dump(datos, fh, ensure_ascii=False)
    fh.write(";\n")
print("data/mis-datos.js:", len(canciones), "canciones,", len(raw_notes), "notas")

"""Genera data/fotos.js: qué fotos de free-exercise-db corresponden a cada ejercicio.

free-exercise-db (https://github.com/yuhonas/free-exercise-db) publica dos fotos
por ejercicio (inicio y fin) bajo Unlicense (dominio público).

Emparejamiento:
  1. scripts/fotos_manual.json: hecho a mano, tiene prioridad. Sus fotos se
     copian a img/ejercicios/ para que no dependan de otro servidor.
  2. Automático: solo cuando el nombre en inglés tiene exactamente las mismas
     palabras en los dos sitios. Esas fotos se cargan desde GitHub.

Uso:  python scripts/construir_fotos.py
"""

import json
import re
import urllib.request
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
NUESTROS = RAIZ / "fuentes" / "exercises.json"
FEDB = RAIZ / "fuentes" / "free-exercise-db.json"
MANUAL = RAIZ / "scripts" / "fotos_manual.json"
LOCALES = RAIZ / "img" / "ejercicios"
SALIDA = RAIZ / "data" / "fotos.js"
BASE = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/"

VACIAS = {"the", "with", "on", "a", "an", "of", "and", "to", "v", "male", "female", "version"}
COMPUESTAS = re.compile(r"\b(pull|push|chin|sit|step|kick|press|pull)[ -]?(ups?|downs?|backs?|overs?)\b")


def palabras(nombre):
    n = nombre.lower()
    n = COMPUESTAS.sub(lambda m: m.group(1) + m.group(2).rstrip("s"), n)
    n = re.sub(r"v\. ?\d+", " ", n)
    n = re.sub(r"[^a-z0-9]+", " ", n)
    salida = set()
    for p in n.split():
        if p in VACIAS:
            continue
        if len(p) > 3 and p.endswith("s") and not p.endswith("ss"):
            p = p[:-1]
        salida.add(p)
    return frozenset(salida)


def main():
    nuestros = json.loads(NUESTROS.read_text(encoding="utf-8"))
    fedb = json.loads(FEDB.read_text(encoding="utf-8"))
    con_fotos = [e for e in fedb if len(e.get("images", [])) >= 2]
    por_nombre = {e["name"]: e for e in con_fotos}
    por_palabras = {}
    for e in con_fotos:
        por_palabras.setdefault(palabras(e["name"]), e)

    mapa = {}
    for e in nuestros:
        igual = por_palabras.get(palabras(e["name"]))
        if igual:
            mapa[e["id"]] = igual["id"]

    manual = {k: v for k, v in json.loads(MANUAL.read_text(encoding="utf-8")).items() if not k.startswith("_")}
    locales = []
    for clave, dato in manual.items():
        foto = por_nombre.get(dato["foto"])
        if not foto:
            raise SystemExit(f"No existe en free-exercise-db: {dato['foto']!r}")
        mapa[clave] = ("~" if dato.get("aprox") else "") + foto["id"]
        if foto["id"] not in locales:
            locales.append(foto["id"])
        for n in (0, 1):
            destino = LOCALES / foto["id"] / f"{n}.jpg"
            if not destino.exists():
                destino.parent.mkdir(parents=True, exist_ok=True)
                with urllib.request.urlopen(f"{BASE}{foto['id']}/{n}.jpg", timeout=30) as r:
                    destino.write_bytes(r.read())

    cabecera = (
        "// Generado por scripts/construir_fotos.py. No editar a mano.\n"
        "// Fotos de free-exercise-db (https://github.com/yuhonas/free-exercise-db), Unlicense.\n"
        "// mapa: id del ejercicio -> carpeta de fotos; \"~\" delante = variante parecida.\n"
    )
    datos = {"remoto": BASE, "local": "img/ejercicios/", "locales": sorted(locales), "mapa": dict(sorted(mapa.items()))}
    SALIDA.write_text(f"{cabecera}window.FOTOS_EJERCICIOS = {json.dumps(datos, ensure_ascii=False, separators=(',', ':'))};\n", encoding="utf-8")
    peso = sum(f.stat().st_size for f in LOCALES.rglob("*.jpg"))
    print(f"{len(mapa)} ejercicios con foto ({len(manual)} a mano, {len(locales)} carpetas locales, {peso // 1024} KB) -> {SALIDA.relative_to(RAIZ)}")


if __name__ == "__main__":
    main()

"""Genera data/ejercicios.js a partir de fuentes/exercises.json.

Toma solo los campos que usa la web, traduce las categorías al español y
añade los nombres traducidos de scripts/nombres_es.json (si existe).
No incluye imágenes ni GIFs: son © Gym visual y no tenemos licencia.

Uso:  python scripts/construir_datos.py
"""

import json
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
FUENTE = RAIZ / "fuentes" / "exercises.json"
NOMBRES = RAIZ / "scripts" / "nombres_es.json"
SALIDA = RAIZ / "data" / "ejercicios.js"

ZONAS = {
    "upper arms": "Brazos",
    "upper legs": "Piernas",
    "back": "Espalda",
    "waist": "Abdomen",
    "chest": "Pecho",
    "shoulders": "Hombros",
    "lower legs": "Pantorrillas",
    "lower arms": "Antebrazos",
    "cardio": "Cardio",
    "neck": "Cuello",
}

MUSCULOS = {
    "abs": "Abdominales",
    "abdominals": "Abdominales",
    "lower abs": "Abdominales inferiores",
    "obliques": "Oblicuos",
    "core": "Core",
    "pectorals": "Pectorales",
    "chest": "Pectorales",
    "upper chest": "Pectoral superior",
    "biceps": "Bíceps",
    "brachialis": "Braquial",
    "triceps": "Tríceps",
    "forearms": "Antebrazos",
    "wrist flexors": "Flexores de muñeca",
    "wrist extensors": "Extensores de muñeca",
    "wrists": "Muñecas",
    "hands": "Manos",
    "grip muscles": "Agarre",
    "delts": "Deltoides",
    "deltoids": "Deltoides",
    "shoulders": "Hombros",
    "rear deltoids": "Deltoides posterior",
    "rotator cuff": "Manguito rotador",
    "traps": "Trapecios",
    "trapezius": "Trapecios",
    "levator scapulae": "Elevador de la escápula",
    "serratus anterior": "Serrato anterior",
    "upper back": "Espalda alta",
    "back": "Espalda",
    "lats": "Dorsales",
    "latissimus dorsi": "Dorsales",
    "rhomboids": "Romboides",
    "spine": "Zona lumbar",
    "lower back": "Zona lumbar",
    "glutes": "Glúteos",
    "quads": "Cuádriceps",
    "quadriceps": "Cuádriceps",
    "hamstrings": "Isquiotibiales",
    "adductors": "Aductores",
    "inner thighs": "Aductores",
    "groin": "Ingle",
    "abductors": "Abductores",
    "hip flexors": "Flexores de cadera",
    "calves": "Pantorrillas",
    "soleus": "Sóleo",
    "shins": "Tibiales",
    "ankles": "Tobillos",
    "ankle stabilizers": "Estabilizadores del tobillo",
    "feet": "Pies",
    "sternocleidomastoid": "Esternocleidomastoideo",
    "cardiovascular system": "Sistema cardiovascular",
}

EQUIPOS = {
    "body weight": "Peso corporal",
    "dumbbell": "Mancuernas",
    "cable": "Polea",
    "barbell": "Barra",
    "olympic barbell": "Barra olímpica",
    "ez barbell": "Barra Z",
    "leverage machine": "Máquina",
    "smith machine": "Máquina Smith",
    "sled machine": "Prensa / trineo",
    "band": "Banda elástica",
    "resistance band": "Banda elástica",
    "kettlebell": "Kettlebell",
    "weighted": "Lastre",
    "stability ball": "Fitball",
    "bosu ball": "Bosu",
    "medicine ball": "Balón medicinal",
    "assisted": "Asistido",
    "rope": "Cuerda",
    "roller": "Rodillo",
    "wheel roller": "Rueda abdominal",
    "upper body ergometer": "Ergómetro de brazos",
    "skierg machine": "SkiErg",
    "stationary bike": "Bicicleta estática",
    "hammer": "Mazo",
    "tire": "Neumático",
    "trap bar": "Barra hexagonal",
    "elliptical machine": "Elíptica",
    "stepmill machine": "Escaladora",
}


def traducir(tabla, valor, campo):
    if valor not in tabla:
        raise SystemExit(f"Falta traducción de {campo}: {valor!r}")
    return tabla[valor]


def main():
    ejercicios = json.loads(FUENTE.read_text(encoding="utf-8"))
    nombres = {}
    if NOMBRES.exists():
        nombres = json.loads(NOMBRES.read_text(encoding="utf-8"))

    salida = []
    sin_nombre = 0
    for e in ejercicios:
        musculo = traducir(MUSCULOS, e["target"], "músculo")
        secundarios = []
        for m in [e["muscle_group"], *e["secondary_muscles"]]:
            es = traducir(MUSCULOS, m, "músculo")
            if es != musculo and es not in secundarios:
                secundarios.append(es)
        nombre = nombres.get(e["id"])
        if not nombre:
            sin_nombre += 1
            nombre = e["name"][:1].upper() + e["name"][1:]
        salida.append({
            "id": e["id"],
            "nombre": nombre,
            # El dataset trae "45в°" mal codificado en algunos nombres.
            "nombreEn": e["name"].replace("в°", "°"),
            "zona": traducir(ZONAS, e["category"], "zona"),
            "musculo": musculo,
            "secundarios": secundarios,
            "equipoEn": e["equipment"],
            "equipo": traducir(EQUIPOS, e["equipment"], "equipo"),
            "pasos": e["instruction_steps"]["es"],
        })

    cabecera = (
        "// Generado por scripts/construir_datos.py. No editar a mano.\n"
        "// Datos de ejercicios: exercises-dataset, MIT License,\n"
        "// Copyright (c) 2026 Hasan Emir Yildirim (ver fuentes/LICENSE-exercises-dataset.txt).\n"
    )
    cuerpo = json.dumps(salida, ensure_ascii=False, separators=(",", ":"))
    SALIDA.write_text(f"{cabecera}window.EJERCICIOS = {cuerpo};\n", encoding="utf-8")
    print(f"{len(salida)} ejercicios -> {SALIDA.relative_to(RAIZ)}"
          f" ({SALIDA.stat().st_size // 1024} KB, {sin_nombre} sin nombre en español)")


if __name__ == "__main__":
    main()

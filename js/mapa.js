// Mapa muscular en SVG (frente y espalda). Cada región se dibuja en la
// mitad izquierda de la figura y se refleja para obtener la derecha.
(function () {
  "use strict";

  const ESPEJO = "matrix(-1 0 0 1 200 0)";

  // Silueta: mitad izquierda cerrada en el eje central (x = 100).
  const SILUETA =
    "M100 8 C87 8 81 19 81 32 C81 44 86 52 91 56 L91 62 C83 66 72 68 62 72 C50 76 44 88 44 100 " +
    "L42 124 C40 136 38 146 38 154 C34 172 30 192 28 212 C26 222 22 234 24 242 C28 247 34 245 36 236 " +
    "L40 216 C46 196 52 176 54 160 L58 136 L62 118 L64 140 C66 160 68 176 66 194 C62 206 60 226 60 250 " +
    "C60 270 62 290 64 304 C60 324 62 350 68 380 L66 396 C62 402 64 409 72 409 L86 409 C90 405 89 396 86 388 " +
    "C88 360 92 330 90 304 C94 280 96 256 98 232 L100 228 Z";

  // musculo: valor del filtro de la biblioteca (músculo principal del dataset).
  // alias: nombres (principal o secundario) que iluminan esta región.
  const REGIONES = [
    // ----- Frente -----
    { id: "trap-f", vista: "frente", musculo: "Trapecios", alias: ["Trapecios", "Elevador de la escápula"],
      d: ["M91 60 C84 64 76 67 69 70 C78 71 86 70 92 68 Z"] },
    { id: "delt-f", vista: "frente", musculo: "Deltoides", alias: ["Deltoides", "Hombros", "Manguito rotador"],
      d: ["M67 71 C55 72 46 82 45 98 C49 103 56 103 60 98 C62 88 66 80 73 74 Z"] },
    { id: "pecho", vista: "frente", musculo: "Pectorales", alias: ["Pectorales", "Pectoral superior"],
      d: ["M98 75 L77 74 C69 78 64 88 63 101 C70 111 85 114 98 108 Z"] },
    { id: "serrato", vista: "frente", musculo: "Serrato anterior", alias: ["Serrato anterior"],
      d: ["M64 106 C66 109 69 112 71 113 L71 126 C68 124 66 120 64.5 116 Z"] },
    { id: "biceps", vista: "frente", musculo: "Bíceps", alias: ["Bíceps", "Braquial"],
      d: ["M58 102 C51 106 47 117 46 131 C47 140 51 145 55 144 C59 132 61 119 61 106 Z"] },
    { id: "antebrazo-f", vista: "frente", musculo: "Antebrazos",
      alias: ["Antebrazos", "Flexores de muñeca", "Extensores de muñeca", "Agarre", "Muñecas", "Manos"],
      d: ["M45 151 C39 162 34 182 31 207 L39 210 C45 190 51 170 54 154 Z"] },
    { id: "abs", vista: "frente", musculo: "Abdominales", alias: ["Abdominales", "Abdominales inferiores", "Core"],
      d: ["M86 113 C91 112 95 112 98.5 112 L98.5 198 C93 197 89 193 87 187 C86 164 86 138 86 113 Z"] },
    { id: "oblicuos", vista: "frente", musculo: "Abdominales", alias: ["Oblicuos", "Core"],
      d: ["M73 116 C71 138 72 160 75 182 C78 186 81 188 84 188 C83 164 83 140 83 116 C79 116 76 116 73 116 Z"] },
    { id: "abductor-f", vista: "frente", musculo: "Abductores", alias: ["Abductores", "Flexores de cadera"],
      d: ["M67 196 C63 206 61 220 62 236 C65 228 68 214 72 201 Z"] },
    { id: "cuadriceps", vista: "frente", musculo: "Cuádriceps", alias: ["Cuádriceps", "Flexores de cadera"],
      d: ["M73 203 C65 225 62 260 67 292 C72 297 79 298 85 295 C90 270 92 244 92 224 C86 214 80 207 73 203 Z"] },
    { id: "aductores", vista: "frente", musculo: "Aductores", alias: ["Aductores", "Ingle"],
      d: ["M95 224 C93 242 91 263 88 284 L90.5 286 C96 263 98.5 245 98.5 230 Z"] },
    { id: "pierna-f", vista: "frente", musculo: "Pantorrillas",
      alias: ["Pantorrillas", "Sóleo", "Tibiales", "Tobillos", "Estabilizadores del tobillo"],
      d: ["M66 312 C62 332 64 356 71 384 L80 384 C82 360 85 336 84 312 C78 309 71 309 66 312 Z"] },

    // ----- Espalda -----
    { id: "trap-b", vista: "espalda", musculo: "Trapecios", alias: ["Trapecios", "Elevador de la escápula"],
      d: ["M92 57 L92 63 C84 67 75 69 68 71 C76 76 84 88 90 104 L98.5 116 L98.5 57 Z"] },
    { id: "delt-b", vista: "espalda", musculo: "Deltoides", alias: ["Deltoides", "Hombros", "Deltoides posterior", "Manguito rotador"],
      d: ["M66 72 C54 73 46 83 45 98 C49 103 56 103 60 98 C62 88 66 80 72 75 Z"] },
    { id: "espalda-alta", vista: "espalda", musculo: "Espalda alta", alias: ["Espalda alta", "Romboides", "Espalda", "Manguito rotador"],
      d: ["M72 78 C68 86 66 95 67 104 C75 106 83 108 89 108 C85 96 79 86 72 78 Z"] },
    { id: "dorsales", vista: "espalda", musculo: "Dorsales", alias: ["Dorsales", "Espalda"],
      d: ["M66 108 C66 128 70 150 80 170 C86 166 92 160 96 156 L96 122 C88 116 78 111 66 108 Z"] },
    { id: "triceps", vista: "espalda", musculo: "Tríceps", alias: ["Tríceps"],
      d: ["M58 101 C51 106 47 117 46 131 C47 140 51 146 55 145 C59 132 61 119 62 106 Z"] },
    { id: "antebrazo-b", vista: "espalda", musculo: "Antebrazos",
      alias: ["Antebrazos", "Flexores de muñeca", "Extensores de muñeca", "Agarre", "Muñecas", "Manos"],
      d: ["M45 151 C39 162 34 182 31 207 L39 210 C45 190 51 170 54 154 Z"] },
    { id: "lumbar", vista: "espalda", musculo: "Zona lumbar", alias: ["Zona lumbar"],
      d: ["M90 162 C93 160 96 158 98.5 157 L98.5 196 C95 196 91 195 87 194 C88 184 89 172 90 162 Z"] },
    { id: "abductor-b", vista: "espalda", musculo: "Abductores", alias: ["Abductores"],
      d: ["M68 186 C64 192 62 200 63 210 C67 205 71 199 75 194 C73 191 71 188 68 186 Z"] },
    { id: "gluteos", vista: "espalda", musculo: "Glúteos", alias: ["Glúteos"],
      d: ["M76 196 C67 204 64 220 69 233 C77 241 91 240 98.5 232 L98.5 200 C91 195 83 194 76 196 Z"] },
    { id: "isquios", vista: "espalda", musculo: "Isquiotibiales", alias: ["Isquiotibiales"],
      d: ["M69 241 C64 260 64 280 68 298 C74 301 81 301 87 298 C91 280 94 262 95 244 C86 246 77 245 69 241 Z"] },
    { id: "pierna-b", vista: "espalda", musculo: "Pantorrillas",
      alias: ["Pantorrillas", "Sóleo", "Tobillos", "Estabilizadores del tobillo"],
      d: ["M67 310 C61 328 63 348 72 362 C80 360 86 344 87 324 C86 318 85 313 84 309 C78 307 72 307 67 310 Z"] },
  ];

  const MUSCULOS_MAPA = [...new Set(REGIONES.map((r) => r.musculo))];

  function figura(vista, estadoDe, interactivo, conteos) {
    const regiones = REGIONES.filter((r) => r.vista === vista);
    const grupos = regiones.map((r) => {
      const estado = estadoDe(r);
      const paths = r.d.map((d) => `<path d="${d}"/><path d="${d}" transform="${ESPEJO}"/>`).join("");
      if (!interactivo) return `<g class="region ${estado}">${paths}</g>`;
      const n = conteos[r.musculo] || 0;
      const etiqueta = `${r.musculo}: ${n} ejercicios`;
      return `<g class="region ${estado}" data-musculo="${r.musculo}" tabindex="0" role="button"
        aria-pressed="${estado === "activa"}" aria-label="${etiqueta}"><title>${etiqueta}</title>${paths}</g>`;
    }).join("");
    return `
      <figure class="figura">
        <svg viewBox="0 0 200 420" aria-hidden="${interactivo ? "false" : "true"}" focusable="false">
          <path class="silueta" d="${SILUETA}"/><path class="silueta" d="${SILUETA}" transform="${ESPEJO}"/>
          <circle class="silueta" cx="100" cy="31" r="20"/>
          ${grupos}
          ${vista === "frente" ? '<path class="marcas" d="M87 133 H113 M87 152 H113 M87.5 170 H112.5"/>' : ""}
        </svg>
        <figcaption>${vista === "frente" ? "Frente" : "Espalda"}</figcaption>
      </figure>`;
  }

  // Mapa para elegir músculo: resalta el seleccionado.
  function interactivo(seleccionado, conteos) {
    const estado = (r) => (r.musculo === seleccionado ? "activa" : "");
    return figura("frente", estado, true, conteos) + figura("espalda", estado, true, conteos);
  }

  // Mapa de solo lectura: principal en color fuerte, secundarios en suave.
  function trabajo(principal, secundarios) {
    const estado = (r) => {
      if (r.alias.includes(principal) || r.musculo === principal) return "principal";
      if (secundarios.some((s) => r.alias.includes(s))) return "secundaria";
      return "";
    };
    return figura("frente", estado, false) + figura("espalda", estado, false);
  }

  window.NM = window.NM || {};
  window.NM.mapa = { interactivo, trabajo, MUSCULOS_MAPA };
})();

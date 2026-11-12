// Contador diario de calorías y macros. Se anota lo que se come cada día y
// se compara con los objetivos de la dieta del plan.
//   nm.alimentos: [{ id, nombre, base: "g"|"mL", kcal, proteina, carbohidratos,
//                    grasas (por 100 g o mL), porcion: { nombre, cantidad }, estimado? }]
//   nm.diario:    { "AAAA-MM-DD": [{ id, nombre, cantidad, kcal, proteina, carbohidratos, grasas }] }
(function () {
  "use strict";

  const U = window.NM.util;
  const { $, esc, aviso, almacen, hoyISO, fechaCorta, kgTxt, ICONOS } = U;
  const raiz = $("#diario");
  if (!raiz) return;

  const MACROS = [
    ["kcal", "Calorías", "kcal"],
    ["proteina", "Proteína", "g"],
    ["carbohidratos", "Carbohidratos", "g"],
    ["grasas", "Grasas", "g"],
  ];
  const fmt = (n) => Math.round(n).toLocaleString("es");
  const r1 = (n) => Math.round(n * 10) / 10;
  const nuevoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const num = (v) => {
    const n = parseFloat(String(v ?? "").replace(",", "."));
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  // Alimentos iniciales. Orden de valores (por 100 g o mL), igual que en la
  // tabla nutricional del usuario: kcal, proteína, grasa, carbohidratos.
  // Los 13 primeros salen de etiquetas; los marcados como estimados son
  // valores genéricos aproximados.
  const INICIALES = [
    ["Whey Vital Plus (polvo)", "g", 347, 58.8, 3.7, 19.6, "scoop", 17],
    ["Proteína vegana (polvo)", "g", 379, 45.5, 9.1, 36.4, "porción", 33],
    ["Leche entera Montefrío", "mL", 61, 3.3, 3.2, 4.8, "vaso", 200],
    ["Queso mozzarella rayado (ARA)", "g", 293, 21, 20, 6.3, "cucharada", 18],
    ["Queso parmesano (ARA)", "g", 366, 33, 26, 0, "cucharada", 18],
    ["Avena en hojuelas (seca)", "g", 383, 14.2, 8.3, 66.7, "porción", 24],
    ["Avena Go Power (polvo seco)", "g", 381, 12.7, 9.3, 68.8, "porción", 24],
    ["Tortilla normal (ARA)", "g", 300, 8.5, 6.2, 55, "unidad", 30],
    ["Tortilla integral Bem (ARA)", "g", 281, 9.1, 4.8, 51, "unidad", 31],
    ["Galleta tipo club (Taco Club)", "g", 426, 8.1, 14, 70, "paquete", 25.5],
    ["Maíz dulce congelado", "g", 73, 3.4, 1.0, 15, "taza", 85],
    ["Ajiaco El Ajiaco (D1), base", "g", 42, 4.9, 0.3, 5.5, "empaque", 380],
    ["Salsa chipotle (D1)", "g", 223, 0.7, 21, 7.8, "cucharada", 12],
    ["Pechuga de pollo cocida", "g", 165, 31, 3.6, 0, "porción", 150, true],
    ["Arroz blanco cocido", "g", 130, 2.7, 0.3, 28, "taza", 160, true],
    ["Fríjoles cocidos", "g", 127, 8.7, 0.5, 22.8, "cucharón", 150, true],
    ["Huevo", "g", 143, 12.6, 9.5, 0.7, "unidad", 50, true],
    ["Banano", "g", 89, 1.1, 0.3, 22.8, "unidad", 120, true],
    ["Cerveza", "mL", 43, 0.5, 0, 3.6, "botella", 330, true],
  ].map(([nombre, base, kcal, proteina, grasas, carbohidratos, pNombre, pCantidad, estimado], i) => ({
    id: `i${i}`, nombre, base, kcal, proteina, carbohidratos, grasas,
    porcion: { nombre: pNombre, cantidad: pCantidad }, ...(estimado ? { estimado: true } : {}),
  }));

  const alimentoValido = (a) => a && typeof a.nombre === "string" && a.nombre.trim() &&
    ["kcal", "proteina", "carbohidratos", "grasas"].every((k) => typeof a[k] === "number" && a[k] >= 0) &&
    a.porcion && a.porcion.cantidad > 0;
  const entradaValida = (e) => e && typeof e.nombre === "string" && typeof e.kcal === "number";

  function limpiarAlimento(a) {
    return {
      id: String(a.id || nuevoId()), nombre: String(a.nombre).trim().slice(0, 80), base: a.base === "mL" ? "mL" : "g",
      kcal: a.kcal, proteina: a.proteina, carbohidratos: a.carbohidratos, grasas: a.grasas,
      porcion: { nombre: String(a.porcion.nombre || "porción").slice(0, 20), cantidad: a.porcion.cantidad },
      ...(a.estimado ? { estimado: true } : {}),
    };
  }
  function limpiarDiario(d) {
    const limpio = {};
    if (!d || typeof d !== "object") return limpio;
    for (const [fecha, lista] of Object.entries(d)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !Array.isArray(lista)) continue;
      const entradas = lista.filter(entradaValida).map((e) => ({
        id: String(e.id || nuevoId()), nombre: String(e.nombre).slice(0, 120), cantidad: String(e.cantidad || "").slice(0, 60),
        kcal: e.kcal, proteina: num(e.proteina) || 0, carbohidratos: num(e.carbohidratos) || 0, grasas: num(e.grasas) || 0,
      }));
      if (entradas.length) limpio[fecha] = entradas;
    }
    return limpio;
  }

  let alimentos = almacen.leer("nm.alimentos", null);
  alimentos = Array.isArray(alimentos) ? alimentos.filter(alimentoValido).map(limpiarAlimento) : INICIALES.slice();
  let diario = limpiarDiario(almacen.leer("nm.diario", {}));

  // ---------- Estado de la pantalla ----------
  let fecha = hoyISO();
  let hoyPintado = fecha; // para pasar al día nuevo si la app quedó abierta de un día a otro
  let pestana = "alimentos";
  const sel = { alimento: alimentos[0] ? alimentos[0].id : "", cantidad: "1", unidad: "porcion" };
  let editando = null; // id del alimento cargado en el formulario de "Mis alimentos"

  const guardarDiario = () => almacen.guardar("nm.diario", diario);
  const guardarAlimentos = () => almacen.guardar("nm.alimentos", alimentos);
  const entradas = (f = fecha) => diario[f] || [];
  const totales = (lista) => Object.fromEntries(MACROS.map(([k]) => [k, lista.reduce((s, e) => s + (e[k] || 0), 0)]));
  const objetivos = () => {
    const plan = window.NM.plan && window.NM.plan.obtener();
    return plan ? plan.dieta.objetivos : {};
  };
  const porNombre = (a, b) => a.nombre.localeCompare(b.nombre, "es");

  // Macros de una cantidad de un alimento. unidad: "porcion" o "base" (g o mL).
  function calcular(a, cantidad, unidad) {
    const gramos = unidad === "porcion" ? cantidad * a.porcion.cantidad : cantidad;
    const f = gramos / 100;
    return {
      nombre: a.nombre,
      cantidad: unidad === "porcion" ? `${kgTxt(cantidad)} × ${a.porcion.nombre} (${kgTxt(gramos)} ${a.base})` : `${kgTxt(gramos)} ${a.base}`,
      kcal: Math.round(a.kcal * f), proteina: r1(a.proteina * f), carbohidratos: r1(a.carbohidratos * f), grasas: r1(a.grasas * f),
    };
  }

  function agregar(nuevas) {
    diario[fecha] = entradas().concat(nuevas.map((e) => ({ id: nuevoId(), ...e })));
    guardarDiario();
    pintar();
  }

  // Últimas entradas distintas de cualquier día, para repetirlas con un toque.
  function recientes() {
    const vistas = new Set(), lista = [];
    for (const f of Object.keys(diario).sort().reverse()) {
      for (const e of diario[f].slice().reverse()) {
        const clave = `${e.nombre}|${e.cantidad}`;
        if (vistas.has(clave)) continue;
        vistas.add(clave);
        lista.push(e);
        if (lista.length === 8) return lista;
      }
    }
    return lista;
  }

  // ---------- Pintado ----------
  // Calorías y proteína como anillos (fuera y dentro); carbohidratos y grasas como barras.
  function htmlBarras(total, obj) {
    const frac = (k) => (obj[k] ? Math.min(1, total[k] / obj[k]) : 0);
    const pasada = Boolean(obj.kcal) && total.kcal > obj.kcal * 1.05;
    const cumplida = Boolean(obj.proteina) && total.proteina >= obj.proteina;
    const anillo = (k, r, extra) => {
      const c = 2 * Math.PI * r;
      return `<circle class="anillo__pista" cx="60" cy="60" r="${r}" stroke-width="11"/>` + (frac(k) > 0
        ? `<circle class="anillo anillo--${k} ${extra}" cx="60" cy="60" r="${r}" stroke-width="11"
            stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - frac(k))).toFixed(1)}"/>`
        : "");
    };
    const dato = (k, nombre, u, clase, estado) => `
      <p class="dato dato--${k} ${clase}">
        <span class="dato__nombre">${nombre}</span>
        <span class="dato__valor">${fmt(total[k])}<small>${obj[k] ? `de ${fmt(obj[k])} ${u}` : u}</small></span>
        ${estado ? `<span class="dato__estado">${estado}</span>` : ""}
      </p>`;
    const estadoKcal = !obj.kcal ? "" : total.kcal > obj.kcal ? `Te pasaste ${fmt(total.kcal - obj.kcal)} kcal` : `Te quedan ${fmt(obj.kcal - total.kcal)} kcal`;
    const estadoProteina = !obj.proteina ? "" : cumplida ? "Cumplida" : `Te faltan ${fmt(obj.proteina - total.proteina)} g`;
    const barras = MACROS.slice(2).map(([k, nombre, u]) => {
      const meta = obj[k];
      const pct = meta ? Math.min(100, (total[k] / meta) * 100) : 0;
      return `
        <div class="barra barra--${k}">
          <p class="barra__texto"><span>${nombre}</span><span><strong>${fmt(total[k])}</strong>${meta ? ` / ${fmt(meta)}` : ""} ${u}</span></p>
          <div class="barra__pista" role="progressbar" aria-label="${nombre}" aria-valuemin="0" aria-valuemax="${meta ? Math.round(meta) : 0}" aria-valuenow="${Math.round(total[k])}">
            <div class="barra__relleno" style="width:${pct.toFixed(1)}%"></div>
          </div>
        </div>`;
    }).join("");
    return `
      <div class="anillos">
        <svg class="anillos__svg" viewBox="0 0 120 120" role="img"
          aria-label="Calorías: ${fmt(total.kcal)}${obj.kcal ? ` de ${fmt(obj.kcal)}` : ""}. Proteína: ${fmt(total.proteina)}${obj.proteina ? ` de ${fmt(obj.proteina)}` : ""} gramos.">
          ${anillo("kcal", 53, pasada ? "pasada" : "")}
          ${anillo("proteina", 38, "")}
        </svg>
        <div class="anillos__datos">
          ${dato("kcal", "Calorías", "kcal", pasada ? "pasada" : "", estadoKcal)}
          ${dato("proteina", "Proteína", "g", cumplida ? "cumplida" : "", estadoProteina)}
        </div>
      </div>
      <div class="diario__barras">${barras}</div>`;
  }

  function textoResumen(total, obj, hay) {
    if (!obj.kcal && !obj.proteina) return "Carga tu dieta para ver cuánto te falta de cada objetivo.";
    if (!hay) return "Aún no has anotado nada este día.";
    const partes = [];
    if (obj.proteina) {
      const falta = Math.round(obj.proteina - total.proteina);
      partes.push(falta > 0 ? `Te faltan ${fmt(falta)} g de proteína` : "Proteína cumplida");
    }
    if (obj.kcal) {
      const falta = Math.round(obj.kcal - total.kcal);
      partes.push(falta >= 0 ? `te quedan ${fmt(falta)} kcal` : `te pasaste ${fmt(-falta)} kcal`);
    }
    return `${partes.join(" y ")}.`;
  }

  function htmlAnadir() {
    if (pestana === "rapido") {
      return `
        <form class="diario__form" data-form="rapido">
          <label class="selector"><span>Qué comiste</span><input type="text" id="r-nombre" maxlength="120" placeholder="Ej.: corrientazo con pollo" required></label>
          <div class="diario__macros">
            <label class="selector"><span>kcal</span><input type="number" id="r-kcal" min="0" inputmode="decimal" required></label>
            <label class="selector"><span>Proteína</span><input type="number" id="r-proteina" min="0" step="0.1" inputmode="decimal"></label>
            <label class="selector"><span>Carbos</span><input type="number" id="r-carbohidratos" min="0" step="0.1" inputmode="decimal"></label>
            <label class="selector"><span>Grasas</span><input type="number" id="r-grasas" min="0" step="0.1" inputmode="decimal"></label>
          </div>
          <button type="submit" class="boton boton--primario">Añadir</button>
        </form>`;
    }
    if (pestana === "plan") {
      const plan = window.NM.plan && window.NM.plan.obtener();
      const comidas = plan ? plan.dieta.comidas.map((c, i) => ({ c, i })).filter(({ c }) => c.alimentos.some((a) => a.kcal != null)) : [];
      if (!comidas.length) return '<p class="vacio-progreso">Tu dieta no tiene comidas con valores. Cárgala o edítala más abajo.</p>';
      return `
        <div class="diario__plan">
          ${comidas.map(({ c, i }) => {
            const t = totales(c.alimentos);
            return `<button type="button" class="selector__item" data-comida="${i}">
              <span class="tarjeta__nombre">${esc(c.nombre)}</span>
              <span class="bloque__meta">${fmt(t.kcal)} kcal · ${fmt(t.proteina)} g de proteína · ${c.alimentos.length} alimentos</span>
            </button>`;
          }).join("")}
          <p class="grafica__nota">Se añaden los alimentos de esa comida; luego puedes quitar los que no comiste.</p>
        </div>`;
    }
    if (!alimentos.length) return '<p class="vacio-progreso">No tienes alimentos guardados. Añade uno en «Mis alimentos».</p>';
    const a = alimentos.find((x) => x.id === sel.alimento) || alimentos[0];
    sel.alimento = a.id;
    return `
      <form class="diario__form" data-form="alimento">
        <label class="selector"><span>Alimento</span>
          <select id="d-alimento">${alimentos.slice().sort(porNombre).map((x) => `<option value="${esc(x.id)}" ${x.id === a.id ? "selected" : ""}>${esc(x.nombre)}</option>`).join("")}</select>
        </label>
        <div class="diario__cantidad">
          <label class="selector"><span>Cantidad</span><input type="number" id="d-cantidad" min="0" step="0.25" inputmode="decimal" value="${esc(sel.cantidad)}" required></label>
          <label class="selector"><span>Unidad</span>
            <select id="d-unidad">
              <option value="porcion" ${sel.unidad === "porcion" ? "selected" : ""}>${esc(a.porcion.nombre)} (${kgTxt(a.porcion.cantidad)} ${a.base})</option>
              <option value="base" ${sel.unidad === "base" ? "selected" : ""}>${a.base === "mL" ? "mililitros" : "gramos"}</option>
            </select>
          </label>
        </div>
        <p class="diario__previa" id="d-previa"></p>
        <button type="submit" class="boton boton--primario">Añadir</button>
      </form>`;
  }

  function pintarPrevia() {
    const el = $("#d-previa", raiz);
    if (!el) return;
    const a = alimentos.find((x) => x.id === sel.alimento);
    const cantidad = num(sel.cantidad);
    if (!a || !cantidad) { el.textContent = "Escribe la cantidad."; return; }
    const e = calcular(a, cantidad, sel.unidad);
    el.textContent = `${fmt(e.kcal)} kcal · P ${kgTxt(e.proteina)} g · C ${kgTxt(e.carbohidratos)} g · G ${kgTxt(e.grasas)} g${a.estimado ? " (estimado)" : ""}`;
  }

  function htmlSemana(obj) {
    const dias = Array.from({ length: 7 }, (_, i) => U.sumarDias(hoyISO(), -i));
    const conDatos = dias.filter((d) => entradas(d).length);
    if (!conDatos.length) return '<p class="vacio-progreso">Aún no hay días anotados.</p>';
    // El día de hoy suele estar incompleto: no entra en el promedio si hay otros días.
    const completos = conDatos.length > 1 ? conDatos.filter((d) => d !== hoyISO()) : conDatos;
    const media = (k) => completos.reduce((s, d) => s + totales(entradas(d))[k], 0) / completos.length;
    return `
      <table class="tabla">
        <thead><tr><th>Día</th><th>kcal</th><th>Proteína</th><th><span class="sr">Ver</span></th></tr></thead>
        <tbody>
          ${dias.map((d) => {
            const lista = entradas(d), t = totales(lista);
            return `<tr>
              <td>${d === hoyISO() ? "Hoy" : esc(U.fechaDe(d).toLocaleDateString("es", { weekday: "short", day: "numeric", month: "short" }))}</td>
              <td>${lista.length ? fmt(t.kcal) : "—"}</td>
              <td>${lista.length ? `${fmt(t.proteina)} g` : "—"}</td>
              <td style="text-align:right"><button type="button" class="borrar" data-ir="${d}">Ver</button></td>
            </tr>`;
          }).join("")}
        </tbody>
      </table>
      <p class="cargas__resumen">Promedio de ${completos.length} ${completos.length === 1 ? "día anotado" : "días anotados"}${completos.length < conDatos.length ? " (sin contar hoy)" : ""}:
        <strong>${fmt(media("kcal"))} kcal</strong>${obj.kcal ? ` (objetivo ${fmt(obj.kcal)})` : ""} y
        <strong>${fmt(media("proteina"))} g de proteína</strong>${obj.proteina ? ` (objetivo ${fmt(obj.proteina)})` : ""}.</p>`;
  }

  function htmlAlimentos() {
    const e = editando ? alimentos.find((a) => a.id === editando) : null;
    const v = (k) => (e ? e[k] : "");
    return `
      <ul class="diario__alimentos">
        ${alimentos.slice().sort(porNombre).map((a) => `
          <li>
            <span><strong>${esc(a.nombre)}</strong>${a.estimado ? ' <span class="nota">estimado</span>' : ""}
              <span class="bloque__meta">Por 100 ${a.base}: ${fmt(a.kcal)} kcal · P ${kgTxt(a.proteina)} · C ${kgTxt(a.carbohidratos)} · G ${kgTxt(a.grasas)} · ${esc(a.porcion.nombre)} = ${kgTxt(a.porcion.cantidad)} ${a.base}</span></span>
            <span class="acciones-fila">
              <button type="button" class="borrar" data-editar-alimento="${esc(a.id)}">Editar</button>
              <button type="button" class="borrar" data-borrar-alimento="${esc(a.id)}">Borrar</button>
            </span>
          </li>`).join("")}
      </ul>
      <form class="diario__form diario__form--alimento" data-form="nuevo-alimento">
        <h3>${e ? "Editar alimento" : "Nuevo alimento"}</h3>
        <div class="diario__fila2">
          <label class="selector"><span>Nombre</span><input type="text" id="n-nombre" maxlength="80" value="${esc(v("nombre"))}" required></label>
          <label class="selector"><span>Valores por 100</span>
            <select id="n-base"><option value="g" ${!e || e.base === "g" ? "selected" : ""}>gramos</option><option value="mL" ${e && e.base === "mL" ? "selected" : ""}>mililitros</option></select>
          </label>
        </div>
        <div class="diario__macros">
          <label class="selector"><span>kcal</span><input type="number" id="n-kcal" min="0" step="0.1" inputmode="decimal" value="${v("kcal")}" required></label>
          <label class="selector"><span>Proteína</span><input type="number" id="n-proteina" min="0" step="0.1" inputmode="decimal" value="${v("proteina")}" required></label>
          <label class="selector"><span>Carbos</span><input type="number" id="n-carbohidratos" min="0" step="0.1" inputmode="decimal" value="${v("carbohidratos")}" required></label>
          <label class="selector"><span>Grasas</span><input type="number" id="n-grasas" min="0" step="0.1" inputmode="decimal" value="${v("grasas")}" required></label>
        </div>
        <div class="diario__fila2">
          <label class="selector"><span>Nombre de la porción</span><input type="text" id="n-porcion" maxlength="20" placeholder="unidad, cucharada, taza…" value="${esc(e ? e.porcion.nombre : "")}"></label>
          <label class="selector"><span>Cuánto pesa la porción</span><input type="number" id="n-porcion-cantidad" min="0.1" step="0.1" inputmode="decimal" value="${e ? e.porcion.cantidad : ""}" required></label>
        </div>
        <div class="acciones-fila">
          <button type="submit" class="boton boton--primario boton--icono">${e ? "Guardar cambios" : "Guardar alimento"}</button>
          ${e ? '<button type="button" class="boton boton--texto boton--icono" data-cancelar-edicion>Cancelar</button>' : ""}
        </div>
      </form>`;
  }

  function pintar() {
    const abiertos = { alimentos: Boolean($("#diario-alimentos", raiz) && $("#diario-alimentos", raiz).open), semana: Boolean($("#diario-semana", raiz) && $("#diario-semana", raiz).open) };
    const hoy = hoyISO();
    if (hoy !== hoyPintado) {
      if (fecha === hoyPintado) fecha = hoy;
      hoyPintado = hoy;
    }
    const lista = entradas(), total = totales(lista), obj = objetivos();
    const rec = recientes();
    raiz.innerHTML = `
      <div class="diario__cuerpo">
        <div class="panel diario__hoy">
          <div class="grafica__cabecera">
            <h2>${fecha === hoy ? "Hoy" : esc(fechaCorta(fecha))}</h2>
            <div class="diario__fecha">
              <button type="button" class="icono-btn" data-dia="-1" aria-label="Día anterior">‹</button>
              <input type="date" id="diario-fecha" value="${fecha}" max="${hoy}" aria-label="Fecha">
              <button type="button" class="icono-btn" data-dia="1" aria-label="Día siguiente" ${fecha >= hoy ? "disabled" : ""}>›</button>
            </div>
          </div>
          ${htmlBarras(total, obj)}
          ${!lista.length || !(obj.kcal || obj.proteina) ? `<p class="diario__resumen">${esc(textoResumen(total, obj, lista.length > 0))}</p>` : ""}
        </div>
        <div class="panel diario__anadir">
          <div class="grafica__cabecera">
            <h2>Añadir</h2>
            <div class="pestanas" role="group" aria-label="Forma de añadir">
              ${[["alimentos", "Mis alimentos"], ["plan", "Del plan"], ["rapido", "Rápido"]].map(([k, n]) =>
                `<button type="button" class="pestana" data-pestana="${k}" aria-pressed="${pestana === k}">${n}</button>`).join("")}
            </div>
          </div>
          ${htmlAnadir()}
          ${rec.length ? `
            <div class="diario__recientes">
              <p class="selector"><span>Repetir algo reciente</span></p>
              <div class="chips">
                ${rec.map((e, i) => `<button type="button" class="chip" data-reciente="${i}" title="${esc(e.nombre)} ${esc(e.cantidad)}">${esc(e.nombre)}${e.cantidad ? ` <em>${esc(e.cantidad)}</em>` : ""}</button>`).join("")}
              </div>
            </div>` : ""}
        </div>
        ${lista.length ? `
        <div class="panel diario__registro">
          <div class="grafica__cabecera">
            <h2>${fecha === hoy ? "Anotado hoy" : "Anotado ese día"}</h2>
            <span class="bloque__meta">${lista.length} ${lista.length === 1 ? "entrada" : "entradas"}</span>
          </div>
            <ul class="diario__lista">
              ${lista.map((e) => `
                <li>
                  <span class="alimento__nombre">${esc(e.nombre)}${e.cantidad ? ` <em>${esc(e.cantidad)}</em>` : ""}</span>
                  <span class="alimento__macros">${fmt(e.kcal)} kcal · ${fmt(e.proteina)} g P</span>
                  <button type="button" class="icono-btn icono-btn--peligro" data-quitar="${esc(e.id)}" aria-label="Quitar ${esc(e.nombre)}">${ICONOS.borrar}</button>
                </li>`).join("")}
            </ul>
        </div>` : ""}
      </div>
      <details class="panel consejos" id="diario-semana" ${abiertos.semana ? "open" : ""}>
        <summary><h2>Últimos 7 días</h2></summary>
        ${htmlSemana(obj)}
      </details>
      <details class="panel consejos" id="diario-alimentos" ${abiertos.alimentos || editando ? "open" : ""}>
        <summary><h2>Mis alimentos (${alimentos.length})</h2></summary>
        ${htmlAlimentos()}
      </details>`;
    pintarPrevia();
  }

  // ---------- Eventos ----------
  function irA(nueva) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(nueva) || nueva > hoyISO()) return;
    fecha = nueva;
    pintar();
  }

  raiz.addEventListener("click", (ev) => {
    const t = (s) => ev.target.closest(s);
    let b;
    if ((b = t("[data-dia]"))) { irA(U.sumarDias(fecha, Number(b.dataset.dia))); return; }
    if ((b = t("[data-ir]"))) { irA(b.dataset.ir); raiz.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
    if ((b = t("[data-pestana]"))) { pestana = b.dataset.pestana; pintar(); return; }
    if ((b = t("[data-quitar]"))) {
      diario[fecha] = entradas().filter((e) => e.id !== b.dataset.quitar);
      if (!diario[fecha].length) delete diario[fecha];
      guardarDiario();
      pintar();
      return;
    }
    if ((b = t("[data-comida]"))) {
      const c = window.NM.plan.obtener().dieta.comidas[Number(b.dataset.comida)];
      agregar(c.alimentos.filter((a) => a.kcal != null).map((a) => ({
        nombre: a.nombre, cantidad: a.cantidad, kcal: a.kcal, proteina: a.proteina || 0, carbohidratos: a.carbohidratos || 0, grasas: a.grasas || 0,
      })));
      aviso(`Añadido: ${c.nombre}`);
      return;
    }
    if ((b = t("[data-reciente]"))) {
      const e = recientes()[Number(b.dataset.reciente)];
      if (e) { const { id, ...resto } = e; agregar([resto]); aviso("Añadido"); }
      return;
    }
    if ((b = t("[data-editar-alimento]"))) { editando = b.dataset.editarAlimento; pintar(); $("#n-nombre", raiz).focus(); return; }
    if (t("[data-cancelar-edicion]")) { editando = null; pintar(); return; }
    if ((b = t("[data-borrar-alimento]"))) {
      const a = alimentos.find((x) => x.id === b.dataset.borrarAlimento);
      if (!a || !confirm(`¿Borrar «${a.nombre}» de tus alimentos? Lo que ya anotaste en el diario no cambia.`)) return;
      alimentos = alimentos.filter((x) => x.id !== a.id);
      if (editando === a.id) editando = null;
      guardarAlimentos();
      pintar();
    }
  });

  raiz.addEventListener("change", (ev) => {
    if (ev.target.id === "diario-fecha") { irA(ev.target.value); return; }
    if (ev.target.id === "d-alimento") { sel.alimento = ev.target.value; sel.cantidad = "1"; sel.unidad = "porcion"; pintar(); return; }
    if (ev.target.id === "d-unidad") { sel.unidad = ev.target.value; pintarPrevia(); }
  });
  raiz.addEventListener("input", (ev) => {
    if (ev.target.id === "d-cantidad") { sel.cantidad = ev.target.value; pintarPrevia(); }
  });

  raiz.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const forma = ev.target.dataset.form;
    if (forma === "alimento") {
      const a = alimentos.find((x) => x.id === sel.alimento);
      const cantidad = num(sel.cantidad);
      if (!a || !cantidad) { aviso("Escribe una cantidad"); return; }
      agregar([calcular(a, cantidad, sel.unidad)]);
      aviso("Añadido");
    } else if (forma === "rapido") {
      const nombre = $("#r-nombre", raiz).value.trim();
      const kcal = num($("#r-kcal", raiz).value);
      if (!nombre || kcal == null) return;
      agregar([{ nombre, cantidad: "", kcal: Math.round(kcal), ...Object.fromEntries(["proteina", "carbohidratos", "grasas"].map((k) => [k, r1(num($(`#r-${k}`, raiz).value) || 0)])) }]);
      aviso("Añadido");
    } else if (forma === "nuevo-alimento") {
      const datos = {
        id: editando || nuevoId(),
        nombre: $("#n-nombre", raiz).value.trim(), base: $("#n-base", raiz).value,
        ...Object.fromEntries(["kcal", "proteina", "carbohidratos", "grasas"].map((k) => [k, num($(`#n-${k}`, raiz).value)])),
        porcion: { nombre: $("#n-porcion", raiz).value.trim() || "porción", cantidad: num($("#n-porcion-cantidad", raiz).value) },
      };
      if (!alimentoValido(datos)) { aviso("Revisa los valores del alimento"); return; }
      const nuevo = limpiarAlimento(datos);
      const i = alimentos.findIndex((a) => a.id === nuevo.id);
      if (i >= 0) alimentos[i] = nuevo; else alimentos.push(nuevo);
      editando = null;
      sel.alimento = nuevo.id; sel.cantidad = "1"; sel.unidad = "porcion";
      guardarAlimentos();
      pintar();
      aviso("Alimento guardado");
    }
  });

  pintar();

  window.NM.diario = {
    pintar,
    exportar: () => ({ diario, alimentos }),
    importar(datos) {
      if (!datos || typeof datos !== "object") return;
      if (Array.isArray(datos.alimentos)) { alimentos = datos.alimentos.filter(alimentoValido).map(limpiarAlimento); guardarAlimentos(); }
      if (datos.diario) { diario = limpiarDiario(datos.diario); guardarDiario(); }
      sel.alimento = alimentos[0] ? alimentos[0].id : "";
      pintar();
    },
  };
})();
